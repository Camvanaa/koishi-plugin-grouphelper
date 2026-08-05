/**
 * 欢迎模块 - 入群欢迎语管理
 */
import { Context, Session } from 'koishi'
import { BaseModule, ModuleMeta } from './base.module'
import { DataManager } from '../data'
import { Config, GroupConfig } from '../../types'

export class WelcomeModule extends BaseModule {
  readonly meta: ModuleMeta = {
    name: 'welcome',
    description: '入群欢迎语管理模块',
    version: '1.0.0'
  }

  /**
   * 生成一份全新的默认群配置。
   *
   * 必须每次返回新对象：调用方会直接改写返回值再 setAll 落盘，
   * 若共用同一个静态对象，某个群设置欢迎语会污染所有尚无配置的群。
   */
  private static createDefaultConfig(): GroupConfig {
    return {
      keywords: [],
      approvalKeywords: [],
      welcomeMsg: '',
      goodbyeMsg: '',
      auto: 'false',
      reject: '答案错误，请重新申请',
      levelLimit: 0,
      leaveCooldown: 0
    }
  }

  constructor(ctx: Context, data: DataManager, config: Config) {
    super(ctx, data, config)
  }

  protected async onInit(): Promise<void> {
    this.registerCommands()
    this.registerEventListeners()
    console.log('[WelcomeModule] initialized')
  }

  /**
   * 注册欢迎语相关命令
   */
  private registerCommands(): void {
    this.registerCommand({
      name: 'welcome',
      desc: '入群欢迎语管理',
      permNode: 'welcome',
      permDesc: '管理入群欢迎语',
      usage: '-s 设置欢迎语，-r 移除，-t 测试，-l 设置等级限制，-j 设置退群冷却'
    })
      .option('s', '-s <消息> 设置欢迎语')
      .option('r', '-r 移除欢迎语')
      .option('t', '-t 测试当前欢迎语')
      .option('l', '-l <等级> 设置等级限制')
      .option('j', '-j <天数> 设置退群冷却天数')
      .action(async ({ session, options }) => {
        return this.handleWelcomeCommand(session, options)
      })

      this.registerCommand({
      name: 'goodbye',
      desc: '退群欢送语管理',
      permNode: 'goodbye',
      permDesc: '管理退群欢送语',
      usage: '-s 设置欢送语，-r 移除，-t 测试'
    })
      .option('s', '-s <消息> 设置欢送语')
      .option('r', '-r 移除欢送语')
      .option('t', '-t 测试当前欢送语')
      .action(async ({ session, options }) => {
        return this.handleGoodbyeCommand(session, options)
      })
  }

  /**
   * 注册事件监听器
   */
  private registerEventListeners(): void {
    // 监听入群事件
    // 注意：事件到达与否取决于协议端（LLOneBot/NapCat 等）是否上报 group_increase/group_decrease，
    // 此处的日志用于排查"欢迎语偶尔不触发"时事件是否真正到达（issue #36）
    this.ctx.on('guild-member-added', async (session) => {
      this.ctx.logger('grouphelper').info(`[welcome] 收到入群事件: guild=${session.guildId}, user=${session.userId}`)
      await this.handleMemberJoin(session)
    })

    this.ctx.on('guild-member-removed', async (session) => {
      this.ctx.logger('grouphelper').info(`[welcome] 收到退群事件: guild=${session.guildId}, user=${session.userId}`)
      await this.handleMemberLeave(session)
    })
  }

  /**
   * 处理欢迎语命令
   */
  private async handleWelcomeCommand(session: Session, options: any): Promise<string> {
    if (!session.guildId) return this.reply('common.guildOnly')

    const allConfigs = this.data.groupConfig.getAll()
    const groupConfig: GroupConfig = allConfigs[session.guildId] || WelcomeModule.createDefaultConfig()

    // 设置等级限制
    if (options.l !== undefined) {
      const level = parseInt(options.l)
        if (isNaN(level) || level < 0) return this.reply('welcome.invalidLevel')
      groupConfig.levelLimit = level
      allConfigs[session.guildId] = groupConfig
      this.data.groupConfig.setAll(allConfigs)
      this.log(session, 'welcome', 'set', `已设置等级限制：${level}级`)
      return this.reply('welcome.levelUpdated', { level })
    }

    // 设置退群冷却
    if (options.j !== undefined) {
      const days = parseInt(options.j)
        if (isNaN(days) || days < 0) return this.reply('welcome.invalidCooldown')
      groupConfig.leaveCooldown = days
      allConfigs[session.guildId] = groupConfig
      this.data.groupConfig.setAll(allConfigs)
      this.log(session, 'welcome', 'set', `已设置退群冷却：${days}天`)
      return this.reply('welcome.cooldownUpdated', { days })
    }

    // 设置欢迎语
    if (options.s) {
      groupConfig.welcomeMsg = options.s
      groupConfig.welcomeEnabled = true
      allConfigs[session.guildId] = groupConfig
      this.data.groupConfig.setAll(allConfigs)
      this.log(session, 'welcome', 'set', `已设置欢迎语：${options.s}`)
      return this.reply('welcome.updated')
    }

    // 移除欢迎语
    if (options.r) {
      groupConfig.welcomeMsg = ''
      groupConfig.welcomeEnabled = false
      allConfigs[session.guildId] = groupConfig
      this.data.groupConfig.setAll(allConfigs)
      this.log(session, 'welcome', 'remove', '已移除欢迎语')
      return this.reply('welcome.removed')
    }

    // 测试欢迎语
    if (options.t) {
      const msg = groupConfig.welcomeMsg || this.config.defaultWelcome
      if (!msg) return this.reply('welcome.notSet')

      const testMsg = this.formatWelcomeMessage(msg, session.userId, session.guildId)
      return testMsg
    }

    // 显示当前配置
    const currentMsg = groupConfig.welcomeMsg
    const currentLevelLimit = groupConfig.levelLimit || 0
    const currentLeaveCooldown = groupConfig.leaveCooldown || 0

    return this.reply('welcome.status', {
      message: currentMsg || this.reply('welcome.notSet'),
      level: currentLevelLimit,
      cooldown: currentLeaveCooldown
    })
  }

  /**
   * 处理欢送语命令
   */

  private async handleGoodbyeCommand(session: Session, options: any): Promise<string> {
    if (!session.guildId) return this.reply('common.guildOnly')

    const allConfigs = this.data.groupConfig.getAll()
    const groupConfig: GroupConfig = allConfigs[session.guildId] || WelcomeModule.createDefaultConfig()
    
    // 设置欢送语
    if (options.s) {
      groupConfig.goodbyeMsg = options.s
      groupConfig.goodbyeEnabled = true
      allConfigs[session.guildId] = groupConfig
      this.data.groupConfig.setAll(allConfigs)
      this.log(session, 'goodbye', 'set', `已设置欢送语：${options.s}`)
      return this.reply('goodbye.updated')
    }

    // 移除欢送语
    if (options.r) {
      groupConfig.goodbyeMsg = ''
      groupConfig.goodbyeEnabled = false
      allConfigs[session.guildId] = groupConfig
      this.data.groupConfig.setAll(allConfigs)
      this.log(session, 'goodbye', 'remove', '已移除欢送语')
      return this.reply('goodbye.removed')
    }

    // 测试欢送语
    if (options.t) {
      const msg = groupConfig.goodbyeMsg || this.config.defaultGoodbye
      if (!msg) return this.reply('goodbye.notSet')

      const testMsg = this.formatWelcomeMessage(msg, session.userId, session.guildId)
      return testMsg
    }

    // 显示当前配置
    const currentMsg = groupConfig.goodbyeMsg
    const currentLevelLimit = groupConfig.levelLimit || 0
    const currentLeaveCooldown = groupConfig.leaveCooldown || 0

    return this.reply('goodbye.status', {
      message: currentMsg || this.reply('goodbye.notSet')
    })
  }
    

  /**
   * 处理成员入群事件
   */
  private async handleMemberJoin(session: Session): Promise<void> {
    if (!session.guildId || !session.userId) return

    const allConfigs = this.data.groupConfig.getAll()
    const groupConfig = allConfigs[session.guildId] || {}

    // 检查开关状态：明确禁用或（未定义且无自定义消息）时视为禁用
    // 以下拦截分支记录日志，便于区分"事件未到达"与"配置拦截未发送"（issue #36）
    if (groupConfig.welcomeEnabled === false) {
      this.ctx.logger('grouphelper').debug(`[welcome] 群 ${session.guildId} 欢迎语已禁用，跳过`)
      return
    }
    if (groupConfig.welcomeEnabled === undefined && !groupConfig.welcomeMsg) {
      this.ctx.logger('grouphelper').debug(`[welcome] 群 ${session.guildId} 未设置欢迎语，跳过`)
      return
    }

    const welcomeMsg = groupConfig.welcomeMsg || this.config.defaultWelcome

    if (!welcomeMsg) {
      this.ctx.logger('grouphelper').debug(`[welcome] 群 ${session.guildId} 欢迎语为空，跳过`)
      return
    }

    try {
      const formattedMsg = this.formatWelcomeMessage(welcomeMsg, session.userId, session.guildId)
      await session.send(formattedMsg)
      console.log(`[WelcomeModule] Sent welcome message to ${session.userId} in ${session.guildId}`)
    } catch (e) {
      console.error(`[WelcomeModule] Failed to send welcome message: ${e}`)
    }
  }

  /**
   * 处理成员退群事件
   */
  private async handleMemberLeave(session: Session): Promise<void> {
    if (!session.guildId || !session.userId) return

    const allConfigs = this.data.groupConfig.getAll()
    const groupConfig = allConfigs[session.guildId] || {}
    
    // 检查开关状态：明确禁用或（未定义且无自定义消息）时视为禁用
    if (groupConfig.goodbyeEnabled === false) return
    if (groupConfig.goodbyeEnabled === undefined && !groupConfig.goodbyeMsg) return

    const goodbyeMsg = groupConfig.goodbyeMsg || this.config.defaultGoodbye

    if (!goodbyeMsg) return

    try {
      const formattedMsg = this.formatWelcomeMessage(goodbyeMsg, session.userId, session.guildId)
      await session.send(formattedMsg)
      console.log(`[WelcomeModule] Sent goodbye message to ${session.userId} in ${session.guildId}`)
    } catch (e) {
      console.error(`[WelcomeModule] Failed to send goodbye message: ${e}`)
    }
  }

  /**
   * 格式化欢迎消息
   */
  private formatWelcomeMessage(template: string, userId: string, guildId: string): string {
    return template
      .replace(/{at}/g, `<at id="${userId}"/>`)
      .replace(/{user}/g, userId)
      .replace(/{group}/g, guildId)
  }
}
