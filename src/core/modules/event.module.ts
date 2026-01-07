import { Context, Logger, Time } from 'koishi'
import { BaseModule, ModuleMeta } from './base.module'
import { DataManager } from '../data'
import { Config } from '../../types'
import { formatDuration } from '../../utils'

const logger = new Logger('grouphelper:event')

/**
 * 事件监听模块 - 处理各类事件和定时任务
 */
export class EventModule extends BaseModule {
  readonly meta: ModuleMeta = {
    name: 'event',
    description: '事件监听模块 - 处理各类事件和定时任务'
  }

  protected async onInit(): Promise<void> {
    this.registerEventListeners()
    this.setupScheduledTasks()
  }

  /**
   * 注册事件监听器
   */
  private registerEventListeners(): void {
    // 好友请求处理
    this.ctx.on('friend-request', async (session) => {
      const { userId } = session
      const { _data: data } = session.event as any

      // 检查黑名单
      const blacklist = this.data.blacklist.getAll()
      if (blacklist[userId]) {
        try {
          await session.bot.internal.setFriendAddRequest(data.flag, false, '您在黑名单中')
        } catch (e) {
          logger.error('拒绝好友请求失败:', e)
        }
        return
      }

      // 检查是否启用好友请求处理
      if (!this.config.friendRequest?.enabled) return

      // 检查关键词
      if (this.config.friendRequest.keywords?.length > 0 && data.comment) {
        for (const keyword of this.config.friendRequest.keywords) {
          try {
            const regex = new RegExp(keyword, 'i')
            if (regex.test(data.comment)) {
              await session.bot.internal.setFriendAddRequest(data.flag, true)
              return
            }
          } catch (e) {
            if (data.comment.toLowerCase().includes(keyword.toLowerCase())) {
              await session.bot.internal.setFriendAddRequest(data.flag, true)
              return
            }
          }
        }

        // 关键词不匹配，拒绝
        await session.bot.internal.setFriendAddRequest(
          data.flag, 
          false, 
          this.config.friendRequest.rejectMessage || '验证信息不正确'
        )
      }
    })

    // 群邀请请求处理
    this.ctx.on('guild-request', async (session) => {
      const { userId } = session
      const { _data: data } = session.event as any

      // 检查黑名单
      const blacklist = this.data.blacklist.getAll()
      if (blacklist[userId]) {
        try {
          await session.bot.internal.setGroupAddRequest(data.flag, data.sub_type, false, '您在黑名单中')
        } catch (e) {
          logger.error('拒绝群邀请失败:', e)
        }
        return
      }

      // 根据配置处理
      if (this.config.guildRequest?.enabled) {
        await session.bot.internal.setGroupAddRequest(data.flag, data.sub_type, true)
      } else {
        await session.bot.internal.setGroupAddRequest(
          data.flag, 
          data.sub_type, 
          false, 
          this.config.guildRequest?.rejectMessage || '暂不接受群邀请'
        )
      }
    })

    // 入群申请处理
    this.ctx.on('guild-member-request', async (session) => {
      const { userId, guildId } = session
      const { _data: data } = session.event as any

      // 检查黑名单
      const blacklist = this.data.blacklist.getAll()
      if (blacklist[userId]) {
        try {
          await session.bot.internal.setGroupAddRequest(data.flag, data.sub_type, false, '您在黑名单中')
        } catch (e) {
          logger.error('拒绝入群申请失败:', e)
        }
        return
      }

      // 检查退群冷却
      const leaveRecords = this.data.leaveRecords.getAll()
      const record = leaveRecords[`${guildId}_${userId}`]
      if (record && Date.now() < record.expireTime) {
        try {
          await session.bot.internal.setGroupAddRequest(
            data.flag, 
            data.sub_type, 
            false, 
            '退群后需要等待冷却时间才能重新加入'
          )
        } catch (e) {
          logger.error('拒绝入群申请失败:', e)
        }
        return
      }

      // 获取群配置
      const groupConfigs = this.data.groupConfig.getAll()
      const groupConfig = groupConfigs[guildId] || { keywords: [], approvalKeywords: [], levelLimit: 0 }

      // 检查等级限制
      if (groupConfig.levelLimit > 0) {
        try {
          const userInfo = await session.bot.internal.getStrangerInfo(userId, true)
          if (userInfo.level < groupConfig.levelLimit) {
            await session.bot.internal.setGroupAddRequest(
              data.flag, 
              data.sub_type, 
              false, 
              `等级不足${groupConfig.levelLimit}级`
            )
            return
          }
        } catch (e) {
          logger.error('获取用户信息失败:', e)
        }
      }

      // 检查关键词
      const approvalKeywords = Array.isArray(groupConfig.approvalKeywords) ? groupConfig.approvalKeywords : []
      const globalKeywords = this.config.keywords || []
      const keywords = [...globalKeywords, ...approvalKeywords]
      
      if (keywords.length > 0 && data.comment) {
        for (const keyword of keywords) {
          try {
            const regex = new RegExp(keyword, 'i')
            if (regex.test(data.comment)) {
              await session.bot.internal.setGroupAddRequest(data.flag, data.sub_type, true)
              return
            }
          } catch (e) {
            if (data.comment.toLowerCase().includes(keyword.toLowerCase())) {
              await session.bot.internal.setGroupAddRequest(data.flag, data.sub_type, true)
              return
            }
          }
        }
      }
    })

    // 成员加入处理
    this.ctx.on('guild-member-added', async (session) => {
      const { guildId, userId } = session

      // 处理禁言恢复
      const mutes = this.data.mutes.getAll()
      if (mutes[guildId]?.[userId]?.leftGroup) {
        const muteRecord = mutes[guildId][userId]

        try {
          // 恢复禁言
          await session.bot.muteGuildMember(guildId, userId, muteRecord.remainingTime)

          // 更新记录
          muteRecord.startTime = Date.now()
          muteRecord.duration = muteRecord.remainingTime
          delete muteRecord.remainingTime
          muteRecord.leftGroup = false
          this.data.mutes.set(guildId, mutes[guildId])

          await session.send(`检测到未完成的禁言，继续执行剩余 ${formatDuration(muteRecord.duration)} 的禁言`)
        } catch (e) {
          logger.error('恢复禁言失败:', e)
        }
      }

      // 发送欢迎消息
      const groupConfigs = this.data.groupConfig.getAll()
      const groupConfig = groupConfigs[guildId] || {}

      if (groupConfig.welcomeMsg) {
        const msg = groupConfig.welcomeMsg
          .replace(/{at}/g, `<at id="${userId}"/>`)
          .replace(/{user}/g, userId)
          .replace(/{group}/g, guildId)
        await session.send(msg)
      } else if (this.config.defaultWelcome) {
        const msg = this.config.defaultWelcome
          .replace(/{at}/g, `<at id="${userId}"/>`)
          .replace(/{user}/g, userId)
          .replace(/{group}/g, guildId)
        await session.send(msg)
      }

      // 推送消息
      const message = `[成员加入] 用户 ${userId} 加入了群 ${guildId}`
      await this.pushMessage(session.bot, message, 'memberChange')
    })

    // 成员退出处理
    this.ctx.on('guild-member-removed', async (session) => {
      const { guildId, userId } = session

      // 设置退群冷却
      const groupConfigs = this.data.groupConfig.getAll()
      const groupConfig = groupConfigs[guildId] || { leaveCooldown: 0 }

      if (groupConfig.leaveCooldown > 0) {
        const leaveRecords = this.data.leaveRecords.getAll()
        leaveRecords[`${guildId}_${userId}`] = {
          expireTime: Date.now() + groupConfig.leaveCooldown * Time.day
        }
        this.data.leaveRecords.set(`${guildId}_${userId}`, leaveRecords[`${guildId}_${userId}`])
      }

      // 处理禁言记录
      const mutes = this.data.mutes.getAll()
      if (mutes[guildId]?.[userId]) {
        const muteRecord = mutes[guildId][userId]
        const elapsedTime = Date.now() - muteRecord.startTime

        if (elapsedTime < muteRecord.duration) {
          // 保存剩余时间
          muteRecord.remainingTime = muteRecord.duration - elapsedTime
          muteRecord.leftGroup = true
          this.data.mutes.set(guildId, mutes[guildId])
        } else {
          // 禁言已过期，删除记录
          delete mutes[guildId][userId]
          this.data.mutes.set(guildId, mutes[guildId])
        }
      }

      // 推送消息
      const message = `[成员退出] 用户 ${userId} 退出了群 ${guildId}`
      await this.pushMessage(session.bot, message, 'memberChange')
    })
  }

  /**
   * 设置定时任务
   */
  private setupScheduledTasks(): void {
    // 禁言到期检查
    this.ctx.setInterval(async () => {
      const bot = this.ctx.bots.values().next().value
      if (bot) {
        await this.checkMuteExpires(bot)
      }
    }, 60000)
  }

  /**
   * 检查禁言到期
   */
  private async checkMuteExpires(bot: any): Promise<void> {
    try {
      const mutes = this.data.mutes.getAll()
      const now = Date.now()
      const expiredMutes: { guildId: string; userId: string }[] = []

      for (const guildId in mutes) {
        for (const userId in mutes[guildId]) {
          const record = mutes[guildId][userId]
          if (!record.leftGroup && record.startTime + record.duration <= now) {
            expiredMutes.push({ guildId, userId })
          }
        }
      }

      // 推送禁言到期消息
      for (const { guildId, userId } of expiredMutes) {
        const message = `[禁言到期] 群 ${guildId} 用户 ${userId} 的禁言已到期`
        await this.pushMessage(bot, message, 'muteExpire')
        
        // 删除记录
        delete mutes[guildId][userId]
        this.data.mutes.set(guildId, mutes[guildId])
      }
    } catch (e) {
      logger.error('检查禁言到期失败:', e)
    }
  }

  /**
   * 推送消息
   */
  private async pushMessage(bot: any, message: string, type: string): Promise<void> {
    try {
      const subscriptions = this.data.subscriptions.getAll()
      const list = subscriptions.list || []

      for (const sub of list) {
        const featureKey = type as keyof typeof sub.features
        if (sub.features[featureKey]) {
          if (sub.type === 'group') {
            await bot.sendMessage(sub.id, message)
          } else {
            await bot.sendPrivateMessage(sub.id, message)
          }
        }
      }
    } catch (e) {
      logger.error('推送消息失败:', e)
    }
  }
}