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
      permDesc: '管理入群欢迎语'
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
      permDesc: '管理退群欢送语'
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
    this.ctx.on('guild-member-added', async (session) => {
      await this.handleMemberJoin(session)
    })

    this.ctx.on('guild-member-removed', async (session) => {
      await this.handleMemberLeave(session)
    })
  }

  /**
   * 处理欢迎语命令
   */
  private async handleWelcomeCommand(session: Session, options: any): Promise<string> {
    if (!session.guildId) return '喵呜...这个命令只能在群里用喵...'

    const allConfigs = this.data.groupConfig.getAll()
    const groupConfig: GroupConfig = allConfigs[session.guildId] || {
      keywords: [],
      approvalKeywords: [],
      welcomeMsg: '',
      goodbyeMsg: '',
      auto: 'false',
      reject: '答案错误，请重新申请',
      levelLimit: 0,
      leaveCooldown: 0
    }

    // 设置等级限制
    if (options.l !== undefined) {
      const level = parseInt(options.l)
      if (isNaN(level) || level < 0) {
        return '等级限制必须是非负整数喵~'
      }
      groupConfig.levelLimit = level
      allConfigs[session.guildId] = groupConfig
      this.data.groupConfig.setAll(allConfigs)
      this.log(session, 'welcome', 'set', `已设置等级限制：${level}级`)
      return `已经设置好等级限制为${level}级啦喵~`
    }

    // 设置退群冷却
    if (options.j !== undefined) {
      const days = parseInt(options.j)
      if (isNaN(days) || days < 0) {
        return '冷却天数必须是非负整数喵~'
      }
      groupConfig.leaveCooldown = days
      allConfigs[session.guildId] = groupConfig
      this.data.groupConfig.setAll(allConfigs)
      this.log(session, 'welcome', 'set', `已设置退群冷却：${days}天`)
      return `已经设置好退群冷却为${days}天啦喵~`
    }

    // 设置欢迎语
    if (options.s) {
      groupConfig.welcomeMsg = options.s
      allConfigs[session.guildId] = groupConfig
      this.data.groupConfig.setAll(allConfigs)
      this.log(session, 'welcome', 'set', `已设置欢迎语：${options.s}`)
      return `已经设置好欢迎语啦喵，要不要用 -t 试试看效果呀？`
    }

    // 移除欢迎语
    if (options.r) {
      delete groupConfig.welcomeMsg
      allConfigs[session.guildId] = groupConfig
      this.data.groupConfig.setAll(allConfigs)
      this.log(session, 'welcome', 'remove', '已移除欢迎语')
      return `欢迎语已经被我吃掉啦喵~`
    }

    // 测试欢迎语
    if (options.t) {
      const msg = groupConfig.welcomeMsg || this.config.defaultWelcome
      if (!msg) return '未设置欢迎语'

      const testMsg = this.formatWelcomeMessage(msg, session.userId, session.guildId)
      return testMsg
    }

    // 显示当前配置
    const currentMsg = groupConfig.welcomeMsg
    const currentLevelLimit = groupConfig.levelLimit || 0
    const currentLeaveCooldown = groupConfig.leaveCooldown || 0

    return `当前欢迎语：${currentMsg || '未设置'}
当前等级限制：${currentLevelLimit}级
当前退群冷却：${currentLeaveCooldown}天

可用变量：
{at} - @新成员
{user} - 新成员QQ号
{group} - 群号

使用方法：
welcome -s <欢迎语>  设置欢迎语
welcome -r  移除欢迎语
welcome -t  测试当前欢迎语
welcome -l <等级>  设置等级限制（0表示不限制）
welcome -j <天数>  设置退群冷却天数（0表示不限制）`
  }

  /**
   * 处理欢送语命令
   */

  private async handleGoodbyeCommand(session: Session, options: any): Promise<string> {
    if (!session.guildId) return '喵呜...这个命令只能在群里用喵...'

    const allConfigs = this.data.groupConfig.getAll()
    const groupConfig: GroupConfig = allConfigs[session.guildId] || {
      keywords: [],
      approvalKeywords: [],
      welcomeMsg: '',
      goodbyeMsg: '',
      auto: 'false',
      reject: '答案错误，请重新申请',
      levelLimit: 0,
      leaveCooldown: 0
    }
    // 设置欢送语
    if (options.s) {
      groupConfig.goodbyeMsg = options.s
      allConfigs[session.guildId] = groupConfig
      this.data.groupConfig.setAll(allConfigs)
      this.log(session, 'goodbye', 'set', `已设置欢送语：${options.s}`)
      return `已经设置好欢送语啦喵，要不要用 -t 试试看效果呀？`
    }

    // 移除欢送语
    if (options.r) {
      delete groupConfig.goodbyeMsg
      allConfigs[session.guildId] = groupConfig
      this.data.groupConfig.setAll(allConfigs)
      this.log(session, 'goodbye', 'remove', '已移除欢送语')
      return `欢送语已经被我吃掉啦喵~`
    }

    // 测试欢送语
    if (options.t) {
      const msg = groupConfig.goodbyeMsg || this.config.defaultGoodbye
      if (!msg) return '未设置欢送语'

      const testMsg = this.formatWelcomeMessage(msg, session.userId, session.guildId)
      return testMsg
    }

    // 显示当前配置
    const currentMsg = groupConfig.goodbyeMsg
    const currentLevelLimit = groupConfig.levelLimit || 0
    const currentLeaveCooldown = groupConfig.leaveCooldown || 0

    return `当前欢送语：${currentMsg || '未设置'}

可用变量：
{at} - @退群成员
{user} - 退群成员QQ号
{group} - 群号

使用方法：
goodbye -s <欢送语>  设置欢送语
goodbye -r  移除欢送语
goodbye -t  测试当前欢送语`
  }
    

  /**
   * 处理成员入群事件
   */
  private async handleMemberJoin(session: Session): Promise<void> {
    if (!session.guildId || !session.userId) return

    const allConfigs = this.data.groupConfig.getAll()
    const groupConfig = allConfigs[session.guildId] || {}
    
    // 检查开关状态：明确禁用或（未定义且无自定义消息）时视为禁用
    if (groupConfig.welcomeEnabled === false) return
    if (groupConfig.welcomeEnabled === undefined && !groupConfig.welcomeMsg) return

    const welcomeMsg = groupConfig.welcomeMsg || this.config.defaultWelcome

    if (!welcomeMsg) return

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