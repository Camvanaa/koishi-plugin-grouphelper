import * as fs from 'fs'
import * as path from 'path'
import { Context, Session } from 'koishi'
import { DataService } from './data.service'
import { RecalledMessage, RecallRecord, GroupConfig } from '../types'
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

  private readRecallRecords(): RecallRecord {
    try {
      const content = fs.readFileSync(this.recallRecordsPath, 'utf-8')
      return JSON.parse(content) || {}
    } catch (e) {
      console.error('读取撤回记录失败:', e)
      return {}
    }
  }

  private saveRecallRecords(records: RecallRecord) {
    try {
      fs.writeFileSync(this.recallRecordsPath, JSON.stringify(records, null, 2), 'utf-8')
    } catch (e) {
      console.error('保存撤回记录失败:', e)
    }
  }

  private registerEventListeners() {
    this.ctx.on('message', (session) => {
      if (!this.isAntiRecallEnabled(session.guildId)) return

      if (session.messageId && session.content) {
        const cachedMessage: CachedMessage = {
          content: session.content,
          userId: session.userId,
          username: session.author?.name || session.author?.nick || `用户${session.userId}`,
          timestamp: Date.now()
        }

        this.messageCache.set(session.messageId, cachedMessage)

        setTimeout(() => {
          this.messageCache.delete(session.messageId)
        }, this.CACHE_EXPIRATION_MS)
      }
    })

    this.ctx.on('message-deleted', async (session) => {
      await this.handleMessageRecall(session)
    })
  }

  private isAntiRecallEnabled(guildId?: string): boolean {
    if (!guildId) {
      return this.ctx.config.antiRecall?.enabled || false
    }

    const groupConfigs = readData(this.dataService.groupConfigPath)
    const groupConfig: GroupConfig = groupConfigs[guildId]

    if (groupConfig?.antiRecall !== undefined) {
      return groupConfig.antiRecall.enabled
    }

    return this.ctx.config.antiRecall?.enabled || false
  }

  private async handleMessageRecall(session: Session) {
    try {
      if (session.userId === session.selfId) {
        return
      }

      if (!session.guildId || !this.isAntiRecallEnabled(session.guildId)) return

      const messageId = session.messageId

      const cachedMessage = this.messageCache.get(messageId)

      let content: string
      let username: string
      let originalTimestamp: number

      if (cachedMessage) {
        content = cachedMessage.content
        username = cachedMessage.username
        originalTimestamp = cachedMessage.timestamp
        this.messageCache.delete(messageId)
      } else if (session.content) {
        content = session.content
        username = session.author?.name || session.author?.nick || `用户${session.userId}` || 'Unknown'
        originalTimestamp = Date.now()
      } else {
        content = '[无法获取消息内容 - 消息发送时间过久或在机器人离线/重启期间发送]'
        username = session.author?.name || session.author?.nick || `用户${session.userId}` || 'Unknown'
        originalTimestamp = Date.now()
      }

      const recalledMessage: RecalledMessage = {
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        messageId: messageId,
        userId: session.userId || 'unknown',
        username: username,
        guildId: session.guildId,
        channelId: session.channelId,
        content: content,
        timestamp: originalTimestamp,
        recallTime: Date.now(),
        elements: session.elements || []
      }

      this.saveRecalledMessage(recalledMessage)

      await this.sendRecallNotification(session, recalledMessage)

    } catch (e) {
      console.error('处理消息撤回失败:', e)
    }
  }

  private saveRecalledMessage(recalledMessage: RecalledMessage) {
    const records = this.readRecallRecords()
    
    if (!records[recalledMessage.guildId]) {
      records[recalledMessage.guildId] = {}
    }
    
    if (!records[recalledMessage.guildId][recalledMessage.userId]) {
      records[recalledMessage.guildId][recalledMessage.userId] = []
    }

    records[recalledMessage.guildId][recalledMessage.userId].unshift(recalledMessage)

    const maxRecords = this.ctx.config.antiRecall.maxRecordsPerUser || 50
    if (records[recalledMessage.guildId][recalledMessage.userId].length > maxRecords) {
      records[recalledMessage.guildId][recalledMessage.userId] = 
        records[recalledMessage.guildId][recalledMessage.userId].slice(0, maxRecords)
    }

    this.saveRecallRecords(records)
  }

  private async sendRecallNotification(session: Session, recalledMessage: RecalledMessage) {
    try {
      const showTime = this.ctx.config.antiRecall.showOriginalTime
      const timeStr = showTime ? new Date(recalledMessage.timestamp).toLocaleString('zh-CN') : ''
      
      let notification = `检测到撤回消息\n`
      notification += `用户: ${recalledMessage.username}(${recalledMessage.userId})\n`
      if (showTime) {
        notification += `发送时间: ${timeStr}\n`
      }
      notification += `内容: ${recalledMessage.content}`

      await this.dataService.pushMessage(session.bot, notification, 'antiRecall')
    } catch (e) {
      console.error('发送撤回通知失败:', e)
    }
  }

  /**
   * 检查指定群组是否启用防撤回功能（公共方法）
   */
  isEnabledForGuild(guildId: string): boolean {
    return this.isAntiRecallEnabled(guildId)
  }

  /**
   * 获取用户的撤回记录
   */
  getUserRecallRecords(guildId: string, userId: string, limit: number = 10): RecalledMessage[] {
    const records = this.readRecallRecords()
    const userRecords = records[guildId]?.[userId] || []
    return userRecords.slice(0, limit)
  }

  /**
   * 清理过期记录
   */
  private scheduleCleanup() {
    setInterval(() => {
      this.cleanExpiredRecords()
    }, 24 * 60 * 60 * 1000)

    this.cleanExpiredRecords()
  }

  private cleanExpiredRecords() {
    try {
      const records = this.readRecallRecords()
      const retentionDays = this.ctx.config.antiRecall.retentionDays || 7
      const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000)
      
      let hasChanges = false

      Object.keys(records).forEach(guildId => {
        Object.keys(records[guildId]).forEach(userId => {
          const originalLength = records[guildId][userId].length
          records[guildId][userId] = records[guildId][userId].filter(
            record => record.recallTime > cutoffTime
          )
          
          if (records[guildId][userId].length !== originalLength) {
            hasChanges = true
          }

          if (records[guildId][userId].length === 0) {
            delete records[guildId][userId]
          }
        })

        if (Object.keys(records[guildId]).length === 0) {
          delete records[guildId]
        }
      })

      if (hasChanges) {
        this.saveRecallRecords(records)
        console.log('已清理过期的撤回记录')
      }
    } catch (e) {
      console.error('清理过期撤回记录失败:', e)
    }
  }

  /**
   * 清除所有撤回记录
   */
  clearAllRecords() {
    this.saveRecallRecords({})
    this.messageCache.clear()
  }

  /**
   * 获取统计信息
   */
  getStatistics(): { totalRecords: number, totalUsers: number, totalGuilds: number } {
    const records = this.readRecallRecords()
    let totalRecords = 0
    let totalUsers = 0
    const totalGuilds = Object.keys(records).length

    Object.values(records).forEach(guildRecords => {
      const users = Object.keys(guildRecords)
      totalUsers += users.length
      users.forEach(userId => {
        totalRecords += guildRecords[userId].length
      })
    })

    return { totalRecords, totalUsers, totalGuilds }
  }

  dispose() {
    this.messageCache.clear()
  }
}
