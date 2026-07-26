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


  protected async onInit(): Promise<void> {
    this.migrateData()
    this.registerCommands()
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
sub antirecall [群号...] - 防撤回通知（可指定来源群过滤）
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

    // 订阅防撤回通知
    this.registerCommand({
      name: 'sub.antirecall',
      desc: '订阅防撤回通知',
      args: '[guilds:text]',
      permNode: 'sub.antirecall',
      permDesc: '订阅防撤回通知',
      usage: '开启/关闭防撤回消息推送；可附带群号（空格/逗号分隔）仅接收指定来源群的推送，不带参数为开关切换'
    })
      .action(async ({ session }, guilds) => {
        // 解析来源群过滤参数
        const raw = (guilds || '').trim()
        const guildIds = raw.split(/[,，\s]+/).filter(s => /^\d+$/.test(s))
        // 带了参数但没有一个合法群号时，提示格式错误而不是退化为开关切换（防误取消订阅）
        if (raw && guildIds.length === 0) {
          return '群号格式不正确喵~ 请使用空格或逗号分隔的纯数字群号，例如：sub.antirecall 123456 789012'
        }

        // 防撤回推送会带出被撤回消息的原文，因此来源群必须在订阅者的权限范围内，
        // 否则任何人都能把无关群的撤回内容拉到自己的群里
        const denied = guildIds.filter(id => this.checkGuildScope(session, 'sub-antirecall', id))
        if (denied.length) {
          return `你没有权限接收这些群的撤回消息喵：${denied.join('、')}`
        }

        return this.handleSubscription(session, 'antiRecall', guildIds)
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
   * @param sourceGuildIds 防撤回等推送的来源群过滤；非空时开启订阅并设置过滤
   */
  private handleSubscription(session: any, feature: keyof Subscription['features'], sourceGuildIds?: string[]): string {
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

    // 携带来源群列表时：强制开启订阅并设置过滤，而不是开关切换
    if (sourceGuildIds && sourceGuildIds.length > 0) {
      sub.features[feature] = true
      sub.sourceGuildIds = sourceGuildIds
      this.data.subscriptions.flush()
      return `已订阅${this.getFeatureName(feature)}，仅接收来源群: ${sourceGuildIds.join(', ')} 喵~`
    }

    sub.features[feature] = !sub.features[feature]
    // 取消订阅时同时清除来源群过滤
    if (!sub.features[feature] && feature === 'antiRecall') {
      delete sub.sourceGuildIds
    }
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
        warning: true,
        antiRecall: true
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

    const antiRecallFilter = sub.features.antiRecall && sub.sourceGuildIds?.length
      ? `（仅来源群: ${sub.sourceGuildIds.join(', ')}）`
      : ''

    const status = [
      `当前订阅状态：`,
      `- 操作日志: ${sub.features.log ? '✅' : '❌'}`,
      `- 成员变动: ${sub.features.memberChange ? '✅' : '❌'}`,
      `- 禁言到期: ${sub.features.muteExpire ? '✅' : '❌'}`,
      `- 黑名单变更: ${sub.features.blacklist ? '✅' : '❌'}`,
      `- 警告通知: ${sub.features.warning ? '✅' : '❌'}`,
      `- 防撤回通知: ${sub.features.antiRecall ? '✅' : '❌'}${antiRecallFilter}`
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
      warning: '警告通知',
      antiRecall: '防撤回通知'
    }
    return names[feature] || feature
  }
}