import { Context, Session } from 'koishi'
import { BaseModule, ModuleMeta } from './base.module'
import { DataManager } from '../data'
import { sleep } from '../../utils'

/**
 * 复读记录接口
 */
interface RepeatRecord {
  content: string
  count: number
  firstMessageId: string
  messages: Array<{
    id: string
    userId: string
    timestamp: number
  }>
}

/**
 * 复读机检测模块
 * 检测并处理群内复读消息
 */
export class RepeatModule extends BaseModule {
  readonly meta: ModuleMeta = {
    name: 'repeat',
    description: '复读机检测模块',
    version: '1.0.0'
  }

  /** 复读记录映射表 */
  private repeatMap = new Map<string, RepeatRecord>()

  /** 清理定时器 */
  private cleanupTimer: NodeJS.Timeout | null = null

  protected async onInit(): Promise<void> {
    this.registerMiddleware()
    this.setupCleanupTask()
    this.ctx.logger.info('[RepeatModule] initialized')
  }

  /**
   * 注册复读检测中间件
   */
  private registerMiddleware(): void {
    this.ctx.middleware(async (session, next) => {
      if (!session.content || !session.guildId) return next()

      const groupConfig = this.getGroupConfig(session.guildId)
      const antiRepeatConfig = groupConfig?.antiRepeat
      if (!antiRepeatConfig?.enabled) return next()

      const currentContent = session.content
      const currentMessageId = session.messageId
      const currentGuildId = session.guildId
      const currentUserId = session.userId

      const record = this.repeatMap.get(currentGuildId)

      // 如果是新内容或内容不同，重置记录
      if (!record || record.content !== currentContent) {
        this.repeatMap.set(currentGuildId, {
          content: currentContent,
          count: 1,
          firstMessageId: currentMessageId,
          messages: [{
            id: currentMessageId,
            userId: currentUserId,
            timestamp: Date.now()
          }]
        })
        return next()
      }

      // 累加复读计数
      record.count++
      record.messages.push({
        id: currentMessageId,
        userId: currentUserId,
        timestamp: Date.now()
      })

      // 超过阈值，撤回消息
      const threshold = antiRepeatConfig.threshold || 3
      if (record.count > threshold) {
        try {
          this.log(session, 'antirepeat', 'messages',
            `已删除 ${record.count - 1} 条复读消息`)

          // 撤回除第一条以外的所有消息
          for (let i = 1; i < record.messages.length; i++) {
            const msg = record.messages[i]
            try {
              await session.bot.deleteMessage(session.channelId, msg.id)
            } catch (e) {
              this.ctx.logger.error(`[RepeatModule] 撤回消息 ${msg.id} 失败:`, e)
            }
            await sleep(300)
          }

          this.repeatMap.delete(currentGuildId)
        } catch (e) {
          this.ctx.logger.error('[RepeatModule] 处理复读消息时出错:', e)
        }
      }

      return next()
    })
  }

  /**
   * 设置定期清理任务
   */
  private setupCleanupTask(): void {
    // 每小时清理过期记录
    this.cleanupTimer = setInterval(() => {
      const now = Date.now()
      for (const [guildId, record] of this.repeatMap.entries()) {
        // 超过1小时未更新的记录将被清理
        if (now - record.messages[record.messages.length - 1].timestamp > 3600000) {
          this.repeatMap.delete(guildId)
        }
      }
    }, 3600000)

    // 插件卸载时清理定时器
    this.ctx.on('dispose', () => {
      if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer)
        this.cleanupTimer = null
      }
    })
  }

  /**
   * 获取复读记录映射表
   */
  getRepeatMap(): Map<string, RepeatRecord> {
    return this.repeatMap
  }

  /**
   * 获取指定群组的复读记录
   */
  getRepeatRecord(guildId: string): RepeatRecord | undefined {
    return this.repeatMap.get(guildId)
  }

  /**
   * 清除指定群组的复读记录
   */
  clearRepeatRecord(guildId: string): void {
    this.repeatMap.delete(guildId)
  }
}