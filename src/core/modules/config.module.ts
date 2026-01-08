/**
 * 配置管理模块
 * 提供配置查看、黑名单管理、警告管理功能
 */

import { Context } from 'koishi'
import { BaseModule, ModuleMeta } from './base.module'
import { DataManager } from '../data'
import { Config, WarnRecord, BlacklistRecord, MuteRecord } from '../../types'
import { formatDuration } from '../../utils'

export class ConfigModule extends BaseModule {
  readonly meta: ModuleMeta = {
    name: 'config',
    description: '配置管理模块',
    version: '1.0.0'
  }

  constructor(ctx: Context, data: DataManager, config: Config) {
    super(ctx, data, config)
  }

  protected async onInit(): Promise<void> {
    this.registerCommands()
    console.log(`[${this.meta.name}] ConfigModule initialized`)
  }

  /**
   * 注册命令
   */
  private registerCommands(): void {
    // 手动注册额外的权限节点
    this.ctx.groupHelper.auth.registerPermission('config.view', '查看配置', '查看所有配置和记录', 'config')
    this.ctx.groupHelper.auth.registerPermission('config.blacklist', '黑名单管理', '管理黑名单（添加/移除）', 'config')
    this.ctx.groupHelper.auth.registerPermission('config.warn', '警告管理', '管理警告记录（添加/移除）', 'config')

    this.registerCommand({
      name: 'config',
      desc: '配置管理',
      permNode: 'config',
      permDesc: '配置管理主命令',
      skipAuth: true  // 主命令跳过权限检查，子功能各自检查
    })
      .option('t', '-t 显示所有记录')
      .option('b', '-b 黑名单管理')
      .option('w', '-w 警告管理')
      .option('a', '-a <内容> 添加')
      .option('r', '-r <内容> 移除')
      .action(async ({ session, options }, content) => {
        if (!session?.guildId) {
          return '喵呜...这个命令只能在群里用喵...'
        }

        // 显示所有配置
        if (options.t) {
          if (!this.ctx.groupHelper.auth.check(session, 'config.view')) {
            return '你没有权限查看配置喵...'
          }
          return await this.showAllConfig(session)
        }

        // 黑名单管理
        if (options.b) {
          if (!this.ctx.groupHelper.auth.check(session, 'config.blacklist')) {
            return '你没有权限管理黑名单喵...'
          }
          return await this.handleBlacklist(session, options, content)
        }

        // 警告管理
        if (options.w) {
          if (!this.ctx.groupHelper.auth.check(session, 'config.warn')) {
            return '你没有权限管理警告喵...'
          }
          return await this.handleWarns(session, options, content)
        }

        // 显示帮助
        return `请使用以下参数：
-t 显示所有配置和记录
-b [-a/-r {QQ号}] 黑名单管理
-w [-a/-r {QQ号} {次数}] 警告管理
使用 verify 命令管理入群审核关键词
使用 forbidden 命令管理禁言关键词
使用 antirepeat 命令管理复读功能`
      })
  }

  /**
   * 显示所有配置
   */
  private async showAllConfig(session: any): Promise<string> {
    const guildWarns = this.data.warns.get(session.guildId) || {}
    const blacklist = this.data.blacklist.getAll()
    const groupConfigs = this.data.groupConfig.getAll()
    const mutes = this.data.mutes.getAll()
    const banMeRecords = this.data.banmeRecords.getAll()

    // 清理无效警告记录
    let hasChanges = false
    for (const userId in guildWarns) {
      if (guildWarns[userId].count <= 0) {
        delete guildWarns[userId]
        hasChanges = true
      }
    }
    if (hasChanges) {
      // @ts-ignore
      this.data.warns.set(session.guildId, guildWarns)
      this.data.warns.flush()
    }

    // 格式化警告记录
    const formatWarns = Object.entries(guildWarns)
      .filter(([, data]) => data.count > 0)
      .map(([userId, data]) => {
        return `用户 ${userId}：${data.count} 次 (${new Date(data.timestamp).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })})`
      })
      .filter(Boolean)
      .join('\n')

    // 格式化黑名单
    const formatBlacklist = Object.entries(blacklist).map(([userId, data]: [string, BlacklistRecord]) =>
      `用户 ${userId}：${new Date(data.timestamp).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`
    ).join('\n')

    // 获取群配置
    const currentGroupKeywords = groupConfigs[session.guildId]?.keywords || []
    const currentGroupApprovalKeywords = groupConfigs[session.guildId]?.approvalKeywords || []
    const currentGroupAuto = groupConfigs[session.guildId]?.auto || 'false'
    const currentGroupReject = groupConfigs[session.guildId]?.reject || '答案错误，请重新申请'
    const currentGroupAutoDelete = groupConfigs[session.guildId]?.forbidden?.autoDelete || false
    const currentWelcome = groupConfigs[session.guildId]?.welcomeMsg || '未设置'

    // 格式化禁言记录
    const currentMutes = mutes[session.guildId] || {}
    const formatMutes = Object.entries(currentMutes)
      .filter(([, data]) => !(data as MuteRecord).leftGroup && Date.now() - (data as MuteRecord).startTime < (data as MuteRecord).duration)
      .map(([userId, data]: [string, MuteRecord]) => {
        const remainingTime = data.duration - (Date.now() - data.startTime)
        return `用户 ${userId}：剩余 ${formatDuration(remainingTime)}`
      })
      .join('\n')

    // BanMe 统计
    const currentBanMe = banMeRecords[session.guildId] || {
      count: 0,
      lastResetTime: Date.now(),
      pity: 0,
      guaranteed: false
    }

    if (Date.now() - currentBanMe.lastResetTime > 3600000) {
      currentBanMe.count = 0
    }

    const baseMaxMillis = this.config.banme.baseMax * 60 * 1000
    const additionalMinutes = Math.floor(Math.pow(currentBanMe.count, 1/3) * this.config.banme.growthRate)
    const maxDuration = formatDuration(baseMaxMillis + (additionalMinutes * 60 * 1000))

    // 计算当前概率
    let currentProb = this.config.banme.jackpot.baseProb
    if (currentBanMe.pity >= this.config.banme.jackpot.softPity) {
      currentProb = this.config.banme.jackpot.baseProb +
        (currentBanMe.pity - this.config.banme.jackpot.softPity + 1) * 0.06
    }
    currentProb = Math.min(currentProb, 1)

    // 获取复读配置
    const antiRepeatConfig = groupConfigs[session.guildId]?.antiRepeat

    const safeDefaultWelcome = this.config.defaultWelcome || '未设置'
    const safeWelcome = currentWelcome || '未设置'

    return `=== 入群欢迎 ===
默认欢迎语：${safeDefaultWelcome}
本群欢迎语：${safeWelcome}

=== 入群审核关键词 ===
全局关键词：${this.config.keywords.join('、') || '无'}
本群关键词：${currentGroupApprovalKeywords.join('、') || '无'}
自动拒绝：${currentGroupAuto === 'true' ? '已启用' : '未启用'}
拒绝词：${currentGroupReject}

=== 禁言关键词 ===
全局关键词：${this.config.forbidden?.keywords?.join('、') || '无'}
本群关键词：${currentGroupKeywords.join('、') || '无'}
自动撤回：${currentGroupAutoDelete ? '已启用' : '未启用'}
自动禁言：${this.config.forbidden?.autoBan ? '已启用' : '未启用'}
禁言时长：${this.config.forbidden?.muteDuration || 0} 分钟

=== 自动禁言配置 ===
警告限制：${this.config.warnLimit} 次
禁言时长表达式：${this.config.banTimes.expression}
（{t}代表警告次数）

=== 复读管理 ===
全局状态：${this.config.antiRepeat.enabled ? '已启用' : '未启用'}
全局阈值：${this.config.antiRepeat.threshold} 条
本群状态：${antiRepeatConfig?.enabled ? '已启用' : '未启用'}
本群阈值：${antiRepeatConfig?.threshold || '未设置'} 条

=== AI功能 ===
全局状态：${this.config.openai?.enabled ? '已启用' : '未启用'}
使用模型：${this.config.openai?.model || 'gpt-3.5-turbo'}
API地址：${this.config.openai?.apiUrl || 'https://api.openai.com/v1'}
本群状态：${groupConfigs[session.guildId]?.openai?.enabled === undefined ? '跟随全局' : groupConfigs[session.guildId]?.openai?.enabled ? '已启用' : '已禁用'}

=== 精华消息 ===
状态：${this.config.setEssenceMsg.enabled ? '已启用' : '未启用'}
权限要求：${this.config.setEssenceMsg.authority} 级

=== 头衔管理 ===
状态：${this.config.setTitle.enabled ? '已启用' : '未启用'}
权限要求：${this.config.setTitle.authority} 级
最大长度：${this.config.setTitle.maxLength} 字节

=== 警告记录 ===
${formatWarns || '无记录'}

=== 黑名单 ===
${formatBlacklist || '无记录'}

=== Banme 统计 ===
状态：${this.config.banme.enabled ? '已启用' : '未启用'}
本群1小时内使用：${currentBanMe.count} 次
当前抽数：${currentBanMe.pity}
当前概率：${(currentProb * 100).toFixed(2)}%
状态：${currentBanMe.guaranteed ? '大保底' : '普通'}
当前最大禁言：${maxDuration}
自动禁言：${this.config.banme.autoBan ? '已启用' : '未启用'}

=== 当前禁言 ===
${formatMutes || '无记录'}`
  }

  /**
   * 处理黑名单管理
   */
  private async handleBlacklist(session: any, options: any, content: string): Promise<string> {
    const blacklist = this.data.blacklist.getAll()

    // 添加黑名单
    if (options.a) {
      blacklist[options.a] = { userId: options.a, timestamp: Date.now() }
      this.data.blacklist.setAll(blacklist)
      await this.log(session, 'config -b -a', options.a, '添加成功')
      await this.ctx.groupHelper.pushMessage(session.bot, `[黑名单] 用户 ${options.a} 被加入黑名单`, 'blacklist')
      return `已将 ${options.a} 加入黑名单喵~`
    }

    // 移除黑名单
    if (options.r) {
      delete blacklist[options.r]
      this.data.blacklist.setAll(blacklist)
      await this.log(session, 'config -b -r', options.r, '移除成功')
      await this.ctx.groupHelper.pushMessage(session.bot, `[黑名单] 用户 ${options.r} 被移出黑名单`, 'blacklist')
      return `已将 ${options.r} 从黑名单移除啦！`
    }

    // 显示黑名单列表
    const formatBlacklist = Object.entries(blacklist).map(([userId, data]: [string, BlacklistRecord]) =>
      `用户 ${userId}：${new Date(data.timestamp).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`
    ).join('\n')
    return `=== 当前黑名单 ===\n${formatBlacklist || '无记录'}`
  }

  /**
   * 处理警告管理
   */
  private async handleWarns(session: any, options: any, content: string): Promise<string> {
    const guildWarns = this.data.warns.get(session.guildId) || {}

    // 添加警告
    if (options.a) {
      if (!guildWarns[options.a]) {
        guildWarns[options.a] = { count: 0, timestamp: 0 }
      }
      guildWarns[options.a].count += parseInt(content) || 1
      guildWarns[options.a].timestamp = Date.now()
      
      // @ts-ignore
      this.data.warns.set(session.guildId, guildWarns)
      this.data.warns.flush()
      
      this.log(session, 'config -w -a', options.a, `增加到 ${guildWarns[options.a].count} 次`)
      return `已增加 ${options.a} 的警告次数，当前为：${guildWarns[options.a].count}`
    }

    // 减少/移除警告
    if (options.r) {
      if (guildWarns[options.r]) {
        guildWarns[options.r].count -= parseInt(content) || 1
        
        let resultMsg = ''
        if (guildWarns[options.r].count <= 0) {
          delete guildWarns[options.r]
          resultMsg = `已移除 ${options.r} 的警告记录`
          this.log(session, 'config -w -r', options.r, '记录已移除')
        } else {
          guildWarns[options.r].timestamp = Date.now()
          resultMsg = `已减少 ${options.r} 的警告次数，当前为：${guildWarns[options.r].count}`
          this.log(session, 'config -w -r', options.r, `减少到 ${guildWarns[options.r].count} 次`)
        }
        
        if (Object.keys(guildWarns).length === 0) {
          this.data.warns.delete(session.guildId)
        } else {
          // @ts-ignore
          this.data.warns.set(session.guildId, guildWarns)
        }
        this.data.warns.flush()
        
        return resultMsg
      }
      return '未找到该用户的警告记录'
    }

    // 显示警告列表
    const formatWarns = Object.entries(guildWarns)
      .filter(([, data]) => data.count > 0)
      .map(([userId, data]) => {
        return `用户 ${userId}：${data.count} 次 (${new Date(data.timestamp).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })})`
      })
      .filter(Boolean)
      .join('\n')
    return `=== 当前群警告记录 ===\n${formatWarns || '无记录'}`
  }
}