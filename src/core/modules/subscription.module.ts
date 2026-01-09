import { Context } from 'koishi'
import { BaseModule, ModuleMeta } from './base.module'
import { DataManager } from '../data'
import { Config, Subscription } from '../../types'

/**
 * 订阅模块 - 管理通知订阅
 */
export class SubscriptionModule extends BaseModule {
  readonly meta: ModuleMeta = {
    name: 'subscription',
    description: '订阅管理模块',
    version: '1.0.0'
  }

  private checkInterval: NodeJS.Timeout | null = null

  protected async onInit(): Promise<void> {
    this.migrateData()
    this.registerCommands()
    this.setupMuteExpireCheck()
  }

  /**
   * 迁移旧数据格式
   * 修复 subscriptions.json 可能是数组格式的问题
   */
  private migrateData(): void {
    const data = this.data.subscriptions.getAll()
    if (Array.isArray(data)) {
      this.ctx.logger('grouphelper').info('检测到旧格式的订阅数据 (Array)，正在迁移...')
      // @ts-ignore
      this.data.subscriptions.setAll({ list: data })
      this.data.subscriptions.flush()
      this.ctx.logger('grouphelper').info('订阅数据已迁移到新格式')
    }
  }

  private registerCommands(): void {
    // 主命令 - 显示帮助（公开命令）
    this.registerCommand({
      name: 'sub',
      desc: '订阅管理',
      permNode: 'sub',
      permDesc: '订阅管理帮助',
      usage: '管理各类通知订阅，使用子命令操作'
    })
      .action(async () => {
        return `使用以下命令管理订阅：
sub log - 操作日志订阅
sub member - 成员变动通知
sub mute - 禁言到期通知
sub blacklist - 黑名单变更通知
sub warning - 警告通知
sub all - 订阅所有通知
sub none - 取消所有订阅
sub status - 查看订阅状态`
      })

    // 订阅操作日志
    this.registerCommand({
      name: 'sub.log',
      desc: '订阅操作日志',
      permNode: 'sub.log',
      permDesc: '订阅操作日志',
      usage: '开启/关闭操作日志推送'
    })
      .action(async ({ session }) => {
        return this.handleSubscription(session, 'log')
      })

    // 订阅成员变动
    this.registerCommand({
      name: 'sub.member',
      desc: '订阅成员变动',
      permNode: 'sub.member',
      permDesc: '订阅成员变动',
      usage: '开启/关闭成员加入退出通知'
    })
      .action(async ({ session }) => {
        return this.handleSubscription(session, 'memberChange')
      })

    // 订阅禁言到期通知
    this.registerCommand({
      name: 'sub.mute',
      desc: '订阅禁言到期通知',
      permNode: 'sub.mute',
      permDesc: '订阅禁言到期通知',
      usage: '开启/关闭禁言到期提醒'
    })
      .action(async ({ session }) => {
        return this.handleSubscription(session, 'muteExpire')
      })

    // 订阅黑名单变更
    this.registerCommand({
      name: 'sub.blacklist',
      desc: '订阅黑名单变更',
      permNode: 'sub.blacklist',
      permDesc: '订阅黑名单变更',
      usage: '开启/关闭黑名单变更通知'
    })
      .action(async ({ session }) => {
        return this.handleSubscription(session, 'blacklist')
      })

    // 订阅警告通知
    this.registerCommand({
      name: 'sub.warning',
      desc: '订阅警告通知',
      permNode: 'sub.warning',
      permDesc: '订阅警告通知',
      usage: '开启/关闭警告处理通知'
    })
      .action(async ({ session }) => {
        return this.handleSubscription(session, 'warning')
      })

    // 订阅所有通知
    this.registerCommand({
      name: 'sub.all',
      desc: '订阅所有通知',
      permNode: 'sub.all',
      permDesc: '订阅所有通知',
      usage: '一键开启所有类型的通知订阅'
    })
      .action(async ({ session }) => {
        return this.handleAllSubscriptions(session, true)
      })

    // 取消所有订阅
    this.registerCommand({
      name: 'sub.none',
      desc: '取消所有订阅',
      permNode: 'sub.none',
      permDesc: '取消所有订阅',
      usage: '一键关闭所有类型的通知订阅'
    })
      .action(async ({ session }) => {
        return this.handleAllSubscriptions(session, false)
      })

    // 查看订阅状态
    this.registerCommand({
      name: 'sub.status',
      desc: '查看订阅状态',
      permNode: 'sub.status',
      permDesc: '查看订阅状态',
      usage: '查看当前群/私聊的订阅状态'
    })
      .action(async ({ session }) => {
        return this.showSubscriptionStatus(session)
      })
  }

  /**
   * 处理单个订阅切换
   */
  private handleSubscription(session: any, feature: keyof Subscription['features']): string {
    if (!session) return '无法获取会话信息'

    const id = session.guildId || session.userId
    if (!id) return '无法获取订阅ID'

    const type = session.guildId ? 'group' : 'private'
    const data = this.data.subscriptions.getAll()
    const subscriptions = data.list

    let sub = subscriptions.find(s => s.id === id && s.type === type)

    if (!sub) {
      sub = {
        type: type as 'group' | 'private',
        id,
        features: {}
      }
      subscriptions.push(sub)
    }

    if (!sub.features) {
      sub.features = {}
    }

    sub.features[feature] = !sub.features[feature]
    this.data.subscriptions.flush()

    return sub.features[feature]
      ? `已订阅${this.getFeatureName(feature)}喵~`
      : `已取消订阅${this.getFeatureName(feature)}喵~`
  }

  /**
   * 处理所有订阅
   */
  private handleAllSubscriptions(session: any, enabled: boolean): string {
    if (!session) return '无法获取会话信息'

    const id = session.guildId || session.userId
    if (!id) return '无法获取订阅ID'

    const type = (session.guildId ? 'group' : 'private') as ('group' | 'private')
    const data = this.data.subscriptions.getAll()
    const subscriptions = data.list

    const index = subscriptions.findIndex(s => s.id === id && s.type === type)

    if (!enabled && index >= 0) {
      subscriptions.splice(index, 1)
      this.data.subscriptions.flush()
      return '已取消所有订阅喵~'
    }

    if (enabled) {
      const sub: Subscription = index >= 0 ? subscriptions[index] : {
        type,
        id,
        features: {}
      }

      if (index < 0) {
        subscriptions.push(sub)
      }

      sub.features = {
        log: true,
        memberChange: true,
        muteExpire: true,
        blacklist: true,
        warning: true
      }

      this.data.subscriptions.flush()
      return '已订阅所有通知喵~'
    }

    return '无需操作喵~'
  }

  /**
   * 显示订阅状态
   */
  private showSubscriptionStatus(session: any): string {
    if (!session) return '无法获取会话信息'

    const id = session.guildId || session.userId
    if (!id) return '无法获取订阅ID'

    const type = session.guildId ? 'group' : 'private'
    const data = this.data.subscriptions.getAll()
    const subscriptions = data.list

    const sub = subscriptions.find(s => s.id === id && s.type === type)

    if (!sub || !sub.features) {
      return '当前没有任何订阅喵~'
    }

    const status = [
      `当前订阅状态：`,
      `- 操作日志: ${sub.features.log ? '✅' : '❌'}`,
      `- 成员变动: ${sub.features.memberChange ? '✅' : '❌'}`,
      `- 禁言到期: ${sub.features.muteExpire ? '✅' : '❌'}`,
      `- 黑名单变更: ${sub.features.blacklist ? '✅' : '❌'}`,
      `- 警告通知: ${sub.features.warning ? '✅' : '❌'}`
    ]

    return status.join('\n')
  }

  /**
   * 获取功能名称
   */
  private getFeatureName(feature: keyof Subscription['features']): string {
    const names: Record<string, string> = {
      log: '操作日志',
      memberChange: '成员变动',
      muteExpire: '禁言到期',
      blacklist: '黑名单变更',
      warning: '警告通知'
    }
    return names[feature] || feature
  }

  /**
   * 设置禁言过期检查定时任务
   */
  private setupMuteExpireCheck(): void {
    this.checkInterval = setInterval(() => {
      const bot = this.ctx.bots.values().next().value
      if (bot) {
        this.checkMuteExpires(bot).catch(console.error)
      }
    }, 60000)

    // 注册清理
    this.ctx.on('dispose', () => {
      if (this.checkInterval) {
        clearInterval(this.checkInterval)
        this.checkInterval = null
      }
    })
  }

  /**
   * 检查禁言过期并发送通知
   */
  private async checkMuteExpires(bot: any): Promise<void> {
    const now = Date.now()
    const allMutes = this.data.mutes.getAll()
    const expiredMutes: Array<{ guildId: string; userId: string }> = []

    // 找出过期的禁言 - mutes 结构是 Record<guildId, Record<odId, MuteRecord>>
    for (const [guildId, guildMutes] of Object.entries(allMutes)) {
      for (const [odId, mute] of Object.entries(guildMutes)) {
        // MuteRecord 有 startTime 和 duration，计算过期时间
        const expireAt = mute.startTime + mute.duration * 1000
        if (expireAt <= now && !mute.notified) {
          expiredMutes.push({
            guildId,
            userId: odId
          })
          // 标记为已通知
          mute.notified = true
        }
      }
    }

    if (expiredMutes.length === 0) return

    // 保存更新后的禁言记录
    this.data.mutes.flush()

    // 发送通知给订阅者
    const subData = this.data.subscriptions.getAll()
    const subscriptions = subData.list
    for (const sub of subscriptions) {
      if (sub.features?.muteExpire) {
        for (const expired of expiredMutes) {
          if (sub.type === 'group' && sub.id === expired.guildId) {
            try {
              await bot.sendMessage(expired.guildId, `用户 ${expired.userId} 的禁言已到期喵~`)
            } catch (e) {
              console.error('发送禁言到期通知失败:', e)
            }
          }
        }
      }
    }
  }
}