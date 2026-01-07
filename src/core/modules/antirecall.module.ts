import { Context, Session, Element } from 'koishi'
import { BaseModule, ModuleMeta } from './base.module'
import { DataManager } from '../data'
import { Config, RecalledMessage, GroupConfig } from '../../types'

interface CachedMessage {
  content: string
  userId: string
  username: string
  timestamp: number
}

/**
 * 防撤回模块
 * - 缓存消息，撤回时记录
 * - 发送撤回通知
 * - 查询撤回记录
 */
export class AntiRecallModule extends BaseModule {
  readonly meta: ModuleMeta = {
    name: 'antirecall',
    description: '防撤回功能'
  }

  private messageCache: Map<string, CachedMessage> = new Map()
  private readonly CACHE_EXPIRATION_MS = 5 * 60 * 1000 // 5分钟
  private cleanupInterval: ReturnType<typeof setInterval> | null = null

  constructor(ctx: Context, data: DataManager, config: Config) {
    super(ctx, data, config)
  }

  async onInit(): Promise<void> {
    this.registerEventListeners()
    this.registerCommands()
    this.scheduleCleanup()
    this.logInfo('AntiRecall module initialized')
  }

  /**
   * 内部日志方法
   */
  private logInfo(message: string): void {
    this.data.writeLog(`[antirecall] ${message}`)
  }

  /**
   * 获取群组防撤回配置
   */
  getAntiRecallConfig(guildId: string): Config['antiRecall'] {
    const globalConfig = this.config.antiRecall || {}
    const groupConfigs = this.data.groupConfig.getAll()
    const groupConfig = groupConfigs[guildId]?.antiRecall || {}
    return { ...globalConfig, ...groupConfig } as Config['antiRecall']
  }

  /**
   * 更新群组配置
   */
  updateGuildConfig(guildId: string, updates: Partial<Config['antiRecall']>): void {
    const groupConfigs = this.data.groupConfig.getAll()
    if (!groupConfigs[guildId]) {
      groupConfigs[guildId] = {} as GroupConfig
    }
    if (!groupConfigs[guildId].antiRecall) {
      groupConfigs[guildId].antiRecall = { enabled: false }
    }
    
    groupConfigs[guildId].antiRecall = {
      ...groupConfigs[guildId].antiRecall,
      ...updates
    }
    
    this.data.groupConfig.setAll(groupConfigs)
  }

  /**
   * 检查群组是否启用
   */
  isEnabledForGuild(guildId: string): boolean {
    return this.getAntiRecallConfig(guildId)?.enabled || false
  }

  /**
   * 获取用户撤回记录
   */
  getUserRecallRecords(guildId: string, userId: string, limit: number = 10): RecalledMessage[] {
    const records = this.data.recallRecords.getAll()
    return (records[guildId]?.[userId] || []).slice(0, limit)
  }

  /**
   * 获取防撤回状态统计
   */
  getStatus(guildId: string) {
    const records = this.data.recallRecords.getAll()
    let totalRecords = 0, totalUsers = 0
    const totalGuilds = Object.keys(records).length

    Object.values(records).forEach(guildRecords => {
      const users = Object.keys(guildRecords)
      totalUsers += users.length
      users.forEach(userId => totalRecords += guildRecords[userId].length)
    })

    const effectiveConfig = this.getAntiRecallConfig(guildId)
    const globalEnabled = this.config.antiRecall?.enabled || false
    const groupConfigs = this.data.groupConfig.getAll()
    const groupSpecificEnabled = groupConfigs[guildId]?.antiRecall?.enabled

    return {
      globalEnabled,
      groupSpecificEnabled,
      effectiveConfig,
      statistics: { totalRecords, totalUsers, totalGuilds }
    }
  }

  /**
   * 清理所有记录
   */
  clearAllRecords(): void {
    this.data.recallRecords.setAll({})
    this.messageCache.clear()
  }

  /**
   * 注册事件监听器
   */
  private registerEventListeners(): void {
    // 缓存消息
    this.ctx.on('message', (session) => {
      if (!session.guildId) return
      if (!this.isEnabledForGuild(session.guildId)) return

      if (session.messageId && session.content) {
        this.messageCache.set(session.messageId, {
          content: session.content,
          userId: session.userId,
          username: session.author?.name || session.author?.nick || `用户${session.userId}`,
          timestamp: Date.now()
        })

        // 设置过期清理
        setTimeout(() => this.messageCache.delete(session.messageId), this.CACHE_EXPIRATION_MS)
      }
    })

    // 处理撤回事件
    this.ctx.on('message-deleted', async (session) => {
      await this.handleMessageRecall(session)
    })
  }

  /**
   * 处理消息撤回
   */
  private async handleMessageRecall(session: Session): Promise<void> {
    if (session.userId === session.selfId) return
    if (!session.guildId || !this.isEnabledForGuild(session.guildId)) return

    const messageId = session.messageId
    const cachedMessage = this.messageCache.get(messageId)

    let content: string, username: string, originalTimestamp: number

    if (cachedMessage) {
      content = cachedMessage.content
      username = cachedMessage.username
      originalTimestamp = cachedMessage.timestamp
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

  /**
   * 保存撤回消息记录
   */
  private saveRecalledMessage(recalledMessage: RecalledMessage): void {
    const records = this.data.recallRecords.getAll()
    const { guildId, userId } = recalledMessage
    const config = this.getAntiRecallConfig(guildId)

    if (!records[guildId]) records[guildId] = {}
    if (!records[guildId][userId]) records[guildId][userId] = []

    records[guildId][userId].unshift(recalledMessage)

    // 限制最大记录数
    const maxRecords = config?.maxRecordsPerUser || 100
    if (records[guildId][userId].length > maxRecords) {
      records[guildId][userId] = records[guildId][userId].slice(0, maxRecords)
    }

    this.data.recallRecords.setAll(records)
  }

  /**
   * 发送撤回通知
   */
  private async sendRecallNotification(session: Session, recalledMessage: RecalledMessage): Promise<void> {
    try {
      const config = this.getAntiRecallConfig(session.guildId)
      const timeStr = config?.showOriginalTime ? new Date(recalledMessage.timestamp).toLocaleString('zh-CN') : ''

      let notification = `检测到撤回消息\n`
      notification += `用户: ${recalledMessage.username}(${recalledMessage.userId})\n`
      if (timeStr) {
        notification += `发送时间: ${timeStr}\n`
      }
      notification += `内容: ${recalledMessage.content}`

      // 推送消息到订阅频道
      const subscriptionsData = this.data.subscriptions.getAll()
      const antiRecallSubs = subscriptionsData.list?.filter(
        sub => sub.features?.antiRecall === true
      ) || []

      for (const sub of antiRecallSubs) {
        // sub.id 是订阅的频道ID
        if (sub.id) {
          await session.bot.sendMessage(sub.id, notification)
        }
      }
    } catch (e) {
      this.data.writeLog(`[antirecall] 发送撤回通知失败: ${e}`)
    }
  }

  /**
   * 定时清理过期记录
   */
  private scheduleCleanup(): void {
    this.cleanExpiredRecords()
    this.cleanupInterval = setInterval(() => this.cleanExpiredRecords(), 24 * 60 * 60 * 1000)
  }

  /**
   * 清理过期记录
   */
  private cleanExpiredRecords(): void {
    try {
      const records = this.data.recallRecords.getAll()
      let hasChanges = false

      for (const guildId in records) {
        const config = this.getAntiRecallConfig(guildId)
        const retentionDays = config?.retentionDays || 7
        const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000)

        for (const userId in records[guildId]) {
          const originalLength = records[guildId][userId].length
          records[guildId][userId] = records[guildId][userId].filter(r => r.recallTime > cutoffTime)
          if (records[guildId][userId].length !== originalLength) hasChanges = true
          if (records[guildId][userId].length === 0) delete records[guildId][userId]
        }
        if (Object.keys(records[guildId]).length === 0) delete records[guildId]
      }

      if (hasChanges) {
        this.data.recallRecords.setAll(records)
        this.logInfo('已清理过期的撤回记录')
      }
    } catch (e) {
      this.data.writeLog(`[antirecall] 清理过期撤回记录失败: ${e}`)
    }
  }

  /**
   * 转换消息内容为纯文本显示
   */
  private sanitizeContentForDisplay(content: string): string {
    if (!content) return '[空消息]'

    try {
      const elements = Element.parse(content)
      return elements.map(el => {
        switch (el.type) {
          case 'text':
            return el.attrs.content
          case 'face':
            return `[表情:${el.attrs.name || el.attrs.id}]`
          case 'img':
            return '[图片]'
          case 'at':
            return `[@${el.attrs.name || el.attrs.id}]`
          case 'video':
            return '[视频]'
          case 'audio':
            return '[语音]'
          case 'file':
            return '[文件]'
          default:
            return `[${el.type}]`
        }
      }).join('').trim()
    } catch (e) {
      return content.replace(/<[^>]+>/g, '').trim() || '[消息内容解析失败]'
    }
  }

  /**
   * 解析用户ID
   */
  private parseUserId(input: string): string | null {
    if (!input) return null
    // 移除 @ 符号
    const cleaned = input.replace(/^@/, '').trim()
    // 如果是纯数字，直接返回
    if (/^\d+$/.test(cleaned)) return cleaned
    return null
  }

  /**
   * 注册命令
   */
  private registerCommands(): void {
    // antirecall 命令 - 查询撤回记录
    this.ctx.command('antirecall <input:text>', '查询用户撤回消息记录', { authority: 3 })
      .alias('撤回查询')
      .usage('查询用户的撤回消息记录\n示例：\nantirecall @用户\nantirecall 123456789\nantirecall @用户 5\nantirecall 123456789 10 群号')
      .example('antirecall @用户')
      .action(async ({ session }, input) => {
        try {
          if (!input) {
            return '请指定要查询的用户\n用法：antirecall @用户 [数量] [群号]'
          }

          // 解析参数
          let args: string[]
          if (input.includes('<at')) {
            const atMatch = input.match(/<at[^>]+>/)
            if (atMatch) {
              const atPart = atMatch[0]
              const restPart = input.replace(atPart, '').trim()
              args = [atPart, ...restPart.split(/\s+/).filter(arg => arg)]
            } else {
              args = input.split(/\s+/).filter(arg => arg)
            }
          } else {
            args = input.split(/\s+/).filter(arg => arg)
          }

          let targetUser = args[0]
          let count = 10
          let targetGuildId = session.guildId

          if (args[1] && !isNaN(parseInt(args[1]))) {
            count = Math.min(parseInt(args[1]), 50)
          }

          if (args[2] && /^\d+$/.test(args[2])) {
            targetGuildId = args[2]
          } else if (args[1] && /^\d+$/.test(args[1]) && args[1].length > 5) {
            if (!args[2]) {
              targetGuildId = args[1]
              count = 10
            }
          }

          if (!targetGuildId) {
            return '请在群聊中使用此命令，或指定群号'
          }

          // 解析用户ID
          let userId: string
          if (targetUser.startsWith('<at')) {
            const match = targetUser.match(/id="([^"]+)"/)
            userId = match ? match[1] : null
          } else {
            userId = this.parseUserId(targetUser)
          }

          if (!userId) {
            return '无法解析用户ID，请@用户或使用QQ号，并确保格式正确'
          }

          if (!this.isEnabledForGuild(targetGuildId)) {
            return `该群组（${targetGuildId}）未启用防撤回功能`
          }

          const records = this.getUserRecallRecords(targetGuildId, userId, count)

          if (records.length === 0) {
            this.log(session, 'antirecall', userId, `成功：查询到 ${targetGuildId} 无记录`)
            return `用户 ${userId} 在群 ${targetGuildId} 暂无撤回记录`
          }

          const config = this.getAntiRecallConfig(targetGuildId)
          let message = `用户 ${records[0].username} (${userId}) 的撤回记录 (${records.length} 条)\n\n`

          records.forEach((record, index) => {
            const recallTime = new Date(record.recallTime).toLocaleString('zh-CN')
            const sanitizedContent = this.sanitizeContentForDisplay(record.content)

            message += `${index + 1}. 内容: ${sanitizedContent}\n`

            if (config?.showOriginalTime) {
              const originalTime = new Date(record.timestamp).toLocaleString('zh-CN')
              message += `   发送于: ${originalTime}\n`
            }
            message += `   撤回于: ${recallTime}\n\n`
          })

          this.log(session, 'antirecall', userId, `成功：查询到 ${targetGuildId} 撤回记录数 ${records.length}`)
          return message.trim()
        } catch (error) {
          this.data.writeLog(`[antirecall] 查询撤回记录失败: ${error}`)
          this.log(session, 'antirecall', input, `失败: ${error.message}`)
          return `查询撤回记录失败: ${error.message}`
        }
      })

    // antirecall-config 命令 - 配置防撤回
    this.ctx.command('antirecall-config', '防撤回功能配置', { authority: 3 })
      .alias('防撤回配置')
      .usage('配置群组防撤回功能\n选项：\n  -e <true/false> 启用/禁用\n  -d <days> 设置消息保留天数\n  -m <count> 设置每人最大记录数')
      .option('enabled', '-e <enabled:string> 启用或禁用防撤回功能')
      .option('days', '-d <days:number> 设置保留天数')
      .option('max', '-m <max:number> 设置每用户最大记录数')
      .action(async ({ session, options }) => {
        if (!session.guildId) return '此命令只能在群聊中使用'
        
        if (Object.keys(options).length === 0) {
          return '请指定要配置的选项：-e (启用/禁用), -d (天数), -m (最大条数)'
        }

        const updates: any = {}
        const messages: string[] = []

        if (options.enabled !== undefined) {
          const enabledStr = options.enabled.toString().toLowerCase()
          if (['true', '1', 'yes', 'y', 'on'].includes(enabledStr)) {
            updates.enabled = true
            messages.push('已启用防撤回')
          } else if (['false', '0', 'no', 'n', 'off'].includes(enabledStr)) {
            updates.enabled = false
            messages.push('已禁用防撤回')
          }
        }

        if (options.days !== undefined) {
          if (options.days > 0 && options.days <= 365) {
            updates.retentionDays = options.days
            messages.push(`保留天数设为 ${options.days} 天`)
          } else {
            messages.push('保留天数无效 (需 1-365)')
          }
        }

        if (options.max !== undefined) {
          if (options.max > 0 && options.max <= 1000) {
            updates.maxRecordsPerUser = options.max
            messages.push(`最大记录数设为 ${options.max} 条`)
          } else {
            messages.push('最大记录数无效 (需 1-1000)')
          }
        }

        if (Object.keys(updates).length > 0) {
          this.updateGuildConfig(session.guildId, updates)
          this.log(session, 'antirecall-config', session.guildId, `更新配置: ${JSON.stringify(updates)}`)
          return `配置已更新：\n${messages.join('\n')}`
        }

        return '未进行任何更改'
      })

    // antirecall.status 命令 - 查看状态
    this.ctx.command('antirecall.status', '查看防撤回功能状态', { authority: 3 })
      .action(async ({ session }) => {
        const status = this.getStatus(session.guildId)
        const { globalEnabled, groupSpecificEnabled, effectiveConfig, statistics } = status

        const formatBool = (b: boolean) => b ? '已启用' : '已禁用'

        let groupStatusText: string
        if (groupSpecificEnabled === undefined) {
          groupStatusText = `未单独设置 (跟随全局)`
        } else {
          groupStatusText = `已单独设置为: ${formatBool(groupSpecificEnabled)}`
        }

        const message = [
          `防撤回功能状态`,
          `全局默认: ${formatBool(globalEnabled)}`,
          `本群设置: ${groupStatusText}`,
          `---`,
          `当前生效状态: ${formatBool(effectiveConfig?.enabled || false)}`,
          `生效配置:`,
          `  - 保存天数: ${effectiveConfig?.retentionDays || 'N/A'} 天`,
          `  - 每用户最大记录: ${effectiveConfig?.maxRecordsPerUser || 'N/A'} 条`,
          `---`,
          `统计信息:`,
          `  - 总记录数: ${statistics.totalRecords}`,
          `  - 涉及用户数: ${statistics.totalUsers}`,
          `  - 涉及群组数: ${statistics.totalGuilds}`
        ].join('\n')

        this.log(session, 'antirecall.status', session.guildId, `成功：查询防撤回状态`)
        return message
      })

    // antirecall.clear 命令 - 清理记录
    this.ctx.command('antirecall.clear', '清理所有撤回记录', { authority: 4 })
      .action(async ({ session }) => {
        this.clearAllRecords()
        this.log(session, 'antirecall.clear', '', '成功：清理所有撤回记录')
        return '已清理所有撤回记录'
      })
  }

  /**
   * 模块销毁时清理资源
   */
  protected async onDispose(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.messageCache.clear()
  }
}