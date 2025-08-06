import * as fs from 'fs'
import * as path from 'path'
import { Context, Session } from 'koishi'
import { DataService } from './data.service'
import { RecalledMessage, RecallRecord, GroupConfig, Config } from '../types'
import { readData, saveData } from '../utils'

interface CachedMessage {
  content: string
  userId: string
  username: string
  timestamp: number
}

export class AntiRecallService {
  private recallRecordsPath: string
  private messageCache: Map<string, CachedMessage> = new Map()
  private readonly CACHE_EXPIRATION_MS = 5 * 60 * 1000 // 5分钟

  constructor(private ctx: Context, private dataService: DataService) {
    this.recallRecordsPath = path.resolve(dataService.dataPath, 'recall_records.json')
    this.init()
    this.registerEventListeners()
  }

  private init() {
    if (!fs.existsSync(this.recallRecordsPath)) {
      this.saveRecallRecords({})
    }
    this.scheduleCleanup()
  }

  private registerEventListeners() {
    this.ctx.on('message', (session) => {
      if (!this.getGuildConfig(session.guildId).enabled) return

      if (session.messageId && session.content) {
        this.messageCache.set(session.messageId, {
          content: session.content,
          userId: session.userId,
          username: session.author?.name || session.author?.nick || `用户${session.userId}`,
          timestamp: Date.now()
        })

        setTimeout(() => this.messageCache.delete(session.messageId), this.CACHE_EXPIRATION_MS)
      }
    })

    this.ctx.on('message-deleted', async (session) => {
      await this.handleMessageRecall(session)
    })
  }

  private async handleMessageRecall(session: Session) {
    if (session.userId === session.selfId) return
    if (!session.guildId || !this.getGuildConfig(session.guildId).enabled) return

    const messageId = session.messageId
    const cachedMessage = this.messageCache.get(messageId)

    let content: string, username: string, originalTimestamp: number

    if (cachedMessage) {
      content = cachedMessage.content;
      username = cachedMessage.username;
      originalTimestamp = cachedMessage.timestamp; 
      
      this.messageCache.delete(messageId)
    } else {
      content = '[无法获取消息内容 - 消息发送时间过久或在机器人离线/重启期间发送]'
      username = session.author?.name || session.author?.nick || `用户${session.userId}` || 'Unknown'
      originalTimestamp = Date.now()
    }

    const recalledMessage: RecalledMessage = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      messageId,
      userId: session.userId || 'unknown',
      username,
      guildId: session.guildId,
      channelId: session.channelId,
      content,
      timestamp: originalTimestamp,
      recallTime: Date.now(),
      elements: session.elements || []
    }

    this.saveRecalledMessage(recalledMessage)
    await this.sendRecallNotification(session, recalledMessage)
  }

  private async sendRecallNotification(session: Session, recalledMessage: RecalledMessage) {
    try {
      const config = this.getGuildConfig(session.guildId)

      const timeStr = config.showOriginalTime ? new Date(recalledMessage.timestamp).toLocaleString('zh-CN') : ''
      
      let notification = `检测到撤回消息\n`
      notification += `用户: ${recalledMessage.username}(${recalledMessage.userId})\n`
      if (timeStr) {
        notification += `发送时间: ${timeStr}\n`
      }
      notification += `内容: ${recalledMessage.content}`

      await this.dataService.pushMessage(session.bot, notification, 'antiRecall')
    } catch (e) {
      this.ctx.logger('anti-recall').error('发送撤回通知失败:', e)
    }
  }
  
  private readRecallRecords(): RecallRecord {
    return readData(this.recallRecordsPath) || {}
  }

  private saveRecallRecords(records: RecallRecord) {
    saveData(this.recallRecordsPath, records)
  }

  private saveRecalledMessage(recalledMessage: RecalledMessage) {
    const records = this.readRecallRecords()
    const { guildId, userId } = recalledMessage
    const config = this.getGuildConfig(guildId)

    if (!records[guildId]) records[guildId] = {}
    if (!records[guildId][userId]) records[guildId][userId] = []

    records[guildId][userId].unshift(recalledMessage)

    const maxRecords = config.maxRecordsPerUser
    if (records[guildId][userId].length > maxRecords) {
      records[guildId][userId] = records[guildId][userId].slice(0, maxRecords)
    }

    this.saveRecallRecords(records)
  }

  public getGuildConfig(guildId?: string): Config['antiRecall'] {
    const globalConfig = this.ctx.config.antiRecall || {}
    if (!guildId) return globalConfig as Config['antiRecall']

    const groupConfigs = readData(this.dataService.groupConfigPath) as { [key: string]: GroupConfig }
    const groupConfig = groupConfigs[guildId]?.antiRecall || {}

    return { ...globalConfig, ...groupConfig } as Config['antiRecall']
  }

  public setGuildEnabled(guildId: string, enabled: boolean) {
    const groupConfigs = readData(this.dataService.groupConfigPath) as { [key: string]: GroupConfig }
    if (!groupConfigs[guildId]) groupConfigs[guildId] = {} as GroupConfig
    if (!groupConfigs[guildId].antiRecall) groupConfigs[guildId].antiRecall = { enabled: false }
    
    groupConfigs[guildId].antiRecall.enabled = enabled
    saveData(this.dataService.groupConfigPath, groupConfigs)
  }
  
  public isEnabledForGuild(guildId: string): boolean {
    return this.getGuildConfig(guildId).enabled
  }

  public getUserRecallRecords(guildId: string, userId: string, limit: number = 10): RecalledMessage[] {
    const records = this.readRecallRecords()
    return (records[guildId]?.[userId] || []).slice(0, limit)
  }

  public getStatus(guildId: string) {
    const records = this.readRecallRecords()
    let totalRecords = 0, totalUsers = 0
    const totalGuilds = Object.keys(records).length

    Object.values(records).forEach(guildRecords => {
      const users = Object.keys(guildRecords)
      totalUsers += users.length
      users.forEach(userId => totalRecords += guildRecords[userId].length)
    })

    const effectiveConfig = this.getGuildConfig(guildId)
    const globalEnabled = this.ctx.config.antiRecall?.enabled || false
    const groupConfigs = readData(this.dataService.groupConfigPath) as { [key: string]: GroupConfig }
    const groupSpecificEnabled = groupConfigs[guildId]?.antiRecall?.enabled

    return {
      globalEnabled,
      groupSpecificEnabled,
      effectiveConfig,
      statistics: { totalRecords, totalUsers, totalGuilds }
    }
  }

  public clearAllRecords() {
    this.saveRecallRecords({})
    this.messageCache.clear()
  }

  private scheduleCleanup() {
    this.cleanExpiredRecords()
    setInterval(() => this.cleanExpiredRecords(), 24 * 60 * 60 * 1000)
  }

  private cleanExpiredRecords() {
    try {
      const records = this.readRecallRecords()
      const globalRetentionDays = this.ctx.config.antiRecall?.retentionDays || 7
      const cutoffTime = Date.now() - (globalRetentionDays * 24 * 60 * 60 * 1000)
      let hasChanges = false

      for (const guildId in records) {
        for (const userId in records[guildId]) {
          const originalLength = records[guildId][userId].length
          records[guildId][userId] = records[guildId][userId].filter(r => r.recallTime > cutoffTime)
          if (records[guildId][userId].length !== originalLength) hasChanges = true
          if (records[guildId][userId].length === 0) delete records[guildId][userId]
        }
        if (Object.keys(records[guildId]).length === 0) delete records[guildId]
      }

      if (hasChanges) {
        this.saveRecallRecords(records)
        this.ctx.logger('anti-recall').info('已清理过期的撤回记录')
      }
    } catch (e) {
      this.ctx.logger('anti-recall').error('清理过期撤回记录失败:', e)
    }
  }

  dispose() {
    this.messageCache.clear()
  }
}