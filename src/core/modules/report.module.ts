import { Context, h, Logger } from 'koishi'
import { BaseModule, ModuleMeta } from './base.module'
import { DataManager } from '../data'
import { Config } from '../../types'
import type { WarnModule } from './warn.module'
import { DEFAULT_REPORT_PROMPT, CONTEXT_REPORT_PROMPT } from '../prompts'


const logger = new Logger('grouphelper:report')

/**
 * 一次扫描填充 Prompt 模板中的占位符。
 *
 * 必须单次扫描：链式 replace 会把上一轮填进去的内容再扫一遍，
 * 群成员只要在消息里写上字面量 {content}，被举报内容就会被塞到
 * 由他控制的位置上。函数式替换同时规避了替换串中 $& / $' 的特殊语义。
 */
function fillPromptTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(context|content)\}/g, (match, key: string) =>
    key in values ? values[key] : match
  )
}

/**
 * 违规等级枚举
 */
export enum ViolationLevel {
  NONE = 0,
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  CRITICAL = 4,
}

/**
 * 违规信息接口
 */
interface ViolationInfo {
  level: ViolationLevel
  reason: string
  action: ViolationAction[]
  // AI 对举报者的判断
  reporterPenalty?: {
    shouldLimit: boolean      // 是否限制举报者
    duration?: number         // 限制时长（分钟）
    reason?: string           // 限制原因
  }
}

/**
 * 违规处理操作
 */
interface ViolationAction {
  type: 'ban' | 'warn' | 'kick' | 'kick_blacklist'
  time?: number
  count?: number
}

/**
 * 举报冷却记录
 */
interface ReportBanRecord {
  userId: string
  guildId: string
  timestamp: number
  expireTime: number
}

/**
 * 消息记录（用于上下文）
 */
interface MessageRecord {
  userId: string
  content: string
  timestamp: number
}

/**
 * 举报模块 - AI 内容审核
 */
export class ReportModule extends BaseModule {
  readonly meta: ModuleMeta = {
    name: 'report',
    description: '举报模块 - AI 内容审核'
  }

  // 举报冷却记录
  private reportBans: Record<string, ReportBanRecord> = {}
  // 群消息记录（用于上下文）
  private guildMessages: Record<string, MessageRecord[]> = {}
  // 已举报消息记录
  private reportedMessages: Record<string, { messageId: string; timestamp: number; result: string }> = {}

  protected async onInit(): Promise<void> {
    this.registerMessageListener()
    this.registerCommands()
    this.setupCleanupTask()
  }

  /**
   * 获取配置值
   */
  private getReportCooldownDuration(): number {
    return (this.config.report?.maxReportCooldown || 60) * 60 * 1000
  }

  private getMinUnlimitedAuthority(): number {
    return this.config.report?.minAuthorityNoLimit || 2
  }

  private getMaxReportTime(): number {
    return this.config.report?.maxReportTime || 30
  }

  private getDefaultPrompt(): string {
    return this.config.report?.defaultPrompt || DEFAULT_REPORT_PROMPT
  }

  private getContextPrompt(): string {
    return this.config.report?.contextPrompt || CONTEXT_REPORT_PROMPT
  }

  /**
   * 获取群配置
   * 优先使用群组配置文件中的 report 设置，如果没有则回退到全局设置中的 guildConfigs
   */
  private getGuildConfig(guildId: string) {
    // 合并两个配置来源：全局设置中的 guildConfigs（report-config 命令写入）
    // 与群组配置文件中的 report（WebUI 群配置写入，字段优先）。
    // 不合并会导致 WebUI 保存过群配置后，report-config 命令写入的字段（如 autoRecall）被整体遮蔽
    const groupReport = this.getGroupConfig(guildId)?.report
    const globalGuild = this.config.report?.guildConfigs?.[guildId]
    if (!groupReport && !globalGuild) return null
    return { ...globalGuild, ...groupReport }
  }

  /**
   * 注册消息监听器（收集上下文）
   */
  private registerMessageListener(): void {
    this.ctx.on('message', (session) => {
      if (!session.guildId || !session.content) return

      const guildConfig = this.getGuildConfig(session.guildId)

      if (guildConfig?.includeContext) {
        const guildId = session.guildId

        if (!this.guildMessages[guildId]) {
          this.guildMessages[guildId] = []
        }

        this.guildMessages[guildId].push({
          userId: session.userId,
          content: session.content,
          timestamp: Date.now()
        })

        const contextSize = guildConfig.contextSize || 5
        if (this.guildMessages[guildId].length > contextSize * 2) {
          this.guildMessages[guildId] = this.guildMessages[guildId].slice(-contextSize * 2)
        }
      }
    })
  }

  /**
   * 注册命令
   */
  private registerCommands(): void {
    // 举报命令
    this.registerCommand({
      name: 'report',
      desc: '举报违规消息',
      permNode: 'report',
      permDesc: '使用举报功能',
      skipAuth: true,  // 举报是普通功能，不需要权限（有单独的冷却机制）
      usage: '回复违规消息使用，AI自动审核处理'
    })
      .option('verbose', '-v 显示详细判断结果', { fallback: true })
      .action(async ({ session, options }) => {
        if (!this.config.report?.enabled) {
          return h.quote(session.messageId) + '举报功能已被禁用'
        }

        if (!session.guildId) {
          return h.quote(session.messageId) + '此命令只能在群聊中使用。'
        }

        const guildConfig = this.getGuildConfig(session.guildId)

        if (guildConfig && !guildConfig.enabled) {
          return h.quote(session.messageId) + '本群的举报功能已被禁用'
        }

        // 获取用户权限
        let userAuthority = 1
        try {
          if (this.ctx.database) {
            const user = await this.ctx.database.getUser(session.platform, session.userId)
            userAuthority = user?.authority || 1
          }
        } catch (e) {
          logger.error('获取用户权限失败:', e)
        }

        const minUnlimitedAuthority = this.getMinUnlimitedAuthority()

        // 检查举报冷却
        if (userAuthority < minUnlimitedAuthority) {
          const banKey = `${session.userId}:${session.guildId}`
          const banRecord = this.reportBans[banKey]

          if (banRecord && Date.now() < banRecord.expireTime) {
            const remainingMinutes = Math.ceil((banRecord.expireTime - Date.now()) / (60 * 1000))
            return h.quote(session.messageId) + `您由于举报不当已被暂时限制使用举报功能，请在${remainingMinutes}分钟后再试。`
          }
        }

        if (!session.quote) {
          return h.quote(session.messageId) + '请回复需要举报的消息。例如：回复某消息 > /report'
        }

        try {
          const quoteId = typeof session.quote === 'string' ? session.quote : session.quote.id

          // 检查是否已举报
          const messageReportKey = `${session.guildId}:${quoteId}`
          if (this.reportedMessages[messageReportKey]) {
            return h.quote(session.messageId) + `该消息已被举报过，处理结果: ${this.reportedMessages[messageReportKey].result}`
          }

          const reportedMessage = await session.bot.getMessage(session.guildId, quoteId)

          if (!reportedMessage || !reportedMessage.content) {
            return h.quote(session.messageId) + '无法获取被举报的消息内容。'
          }

          // 获取被举报者 ID
          let reportedUserId: string
          if (reportedMessage.user && typeof reportedMessage.user === 'object') {
            reportedUserId = reportedMessage.user.id
          } else if (typeof (reportedMessage as any)['userId'] === 'string') {
            reportedUserId = (reportedMessage as any)['userId']
          } else {
            const sender = (reportedMessage as any)['sender'] || (reportedMessage as any)['from']
            if (sender && typeof sender === 'object' && sender.id) {
              reportedUserId = sender.id
            } else {
              return '无法确定被举报消息的发送者。'
            }
          }

          if (!reportedUserId) {
            return h.quote(session.messageId) + '无法确定被举报消息的发送者。'
          }

          if (reportedUserId === session.userId) {
            return h.quote(session.messageId) + '不能举报自己的消息喵~'
          }

          if (reportedUserId === session.selfId) {
            return h.quote(session.messageId) + '喵？不能举报本喵的消息啦~'
          }

          // 记录命令日志
          await this.logCommand(session, 'report', reportedUserId, `举报内容: ${reportedMessage.content}`)

          // 检查消息时间限制
          if (userAuthority < this.getMinUnlimitedAuthority()) {
            let messageTimestamp = 0

            if (reportedMessage.timestamp) {
              messageTimestamp = reportedMessage.timestamp
            } else if (typeof (reportedMessage as any)['time'] === 'number') {
              messageTimestamp = (reportedMessage as any)['time']
            } else if ((reportedMessage as any)['date']) {
              const msgDate = (reportedMessage as any)['date']
              if (msgDate instanceof Date) {
                messageTimestamp = msgDate.getTime()
              } else if (typeof msgDate === 'string') {
                messageTimestamp = new Date(msgDate).getTime()
              } else if (typeof msgDate === 'number') {
                messageTimestamp = msgDate
              }
            }

            if (messageTimestamp > 0) {
              const now = Date.now()
              const maxReportTimeMs = this.getMaxReportTime() * 60 * 1000

              if (now - messageTimestamp > maxReportTimeMs) {
                return h.quote(session.messageId) + `只能举报${this.getMaxReportTime()}分钟内的消息，此消息已超时。`
              }
            }
          }

          // 构建 Prompt
          let promptWithContent = ''

          if (guildConfig?.includeContext) {
            const contextMessages = this.guildMessages[session.guildId] || []
            const contextSize = guildConfig.contextSize || 5

            const sortedMessages = [...contextMessages]
              .sort((a, b) => a.timestamp - b.timestamp)
              .slice(-contextSize)

            const formattedContext = sortedMessages
              .map((msg, index) => `消息${index + 1} [用户${msg.userId}]: ${msg.content}`)
              .join('\n')

            promptWithContent = fillPromptTemplate(this.getContextPrompt(), {
              context: formattedContext,
              content: reportedMessage.content
            })
          } else {
            promptWithContent = fillPromptTemplate(this.getDefaultPrompt(), {
              content: reportedMessage.content
            })
          }

          // 调用 AI 进行审核
          const response = await this.callModeration(promptWithContent)

          // 解析 AI 响应
          let violationInfo: ViolationInfo
          try {
            if (response.startsWith('{') && response.endsWith('}')) {
              violationInfo = JSON.parse(response)
            } else {
              const jsonMatch = response.match(/\{[\s\S]*\}/g)
              if (jsonMatch && jsonMatch.length > 0) {
                violationInfo = JSON.parse(jsonMatch[0])
              } else {
                throw new Error('无法解析AI响应中的JSON')
              }
            }

            if (violationInfo.level === undefined ||
                violationInfo.reason === undefined ||
                violationInfo.action === undefined ||
                !Array.isArray(violationInfo.action)) {
              throw new Error('AI响应格式不正确')
            }
          } catch (e) {
            // AI 返回的 JSON 格式不对是模型/服务端的问题，不是举报者的问题，
            // 不施加冷却。真正的滥用判定由下方 AI 显式返回的 reporterPenalty 负责。
            logger.error('解析AI响应失败:', e, response)
            await this.logCommand(session, 'report-error', session.userId, `AI响应解析失败：${e.message}`, false)
            return h.quote(session.messageId) + '举报处理失败：AI判断结果格式有误，请重试或联系管理员手动处理。'
          }

          // 处理违规
          const result = await this.handleViolation(
            session,
            reportedUserId,
            violationInfo,
            reportedMessage.content,
            options.verbose,
            guildConfig,
            quoteId
          )

          // 记录已举报消息
          this.reportedMessages[messageReportKey] = {
            messageId: quoteId,
            timestamp: Date.now(),
            result: violationInfo.level > ViolationLevel.NONE ?
              `已处理(${this.getViolationLevelText(violationInfo.level)}违规)` :
              '未违规'
          }

          // 根据 AI 判断处理举报者限制
          if (violationInfo.reporterPenalty?.shouldLimit && userAuthority < minUnlimitedAuthority) {
            const banKey = `${session.userId}:${session.guildId}`
            const duration = (violationInfo.reporterPenalty.duration || 60) * 60 * 1000
            this.reportBans[banKey] = {
              userId: session.userId,
              guildId: session.guildId,
              timestamp: Date.now(),
              expireTime: Date.now() + duration
            }

            const penaltyReason = violationInfo.reporterPenalty.reason || '滥用举报功能'
            await this.logCommand(session, 'report-banned', session.userId, `AI判定: ${penaltyReason}，限制${violationInfo.reporterPenalty.duration}分钟`)

            // 显示 AI 判断理由和限制原因
            return h.quote(session.messageId) + result + `\nAI判断理由：${violationInfo.reason}\n您因${penaltyReason}，已被暂时限制举报功能${violationInfo.reporterPenalty.duration}分钟。`
          }

          return h.quote(session.messageId) + result
        } catch (e) {
          logger.error('举报处理失败:', e)

          // 不因系统性错误惩罚举报者：网络故障、AI 服务 5xx、消息过旧取不到等
          // 都不是举报者的问题，原先一律冷却 60 分钟，与恶意刷举报同等对待。
          // 滥用举报的认定只由 AI 显式返回的 reporterPenalty 负责。
          await this.logCommand(session, 'report-error', session.userId, `系统错误：${e.message}`, false)
          return h.quote(session.messageId) + `举报处理失败：${e.message}\n这是系统错误，未计入您的举报限制。`
        }
      })

    // 举报配置命令
    this.registerCommand({
      name: 'report-config',
      desc: '配置举报功能',
      permNode: 'report-config',
      permDesc: '配置举报功能',
      usage: '配置举报功能的启用、自动处理、上下文等选项'
    })
      .option('enabled', '-e <enabled:boolean> 是否启用举报功能')
      .option('auto', '-a <auto:boolean> 是否自动处理违规')
      .option('recall', '-rc <recall:boolean> 处罚成功后是否自动撤回被举报消息')
      .option('authority', '-auth <auth:number> 设置举报功能权限等级')
      .option('context', '-c <context:boolean> 是否包含群聊上下文')
      .option('context-size', '-cs <size:number> 上下文消息数量')
      .option('guild', '-g <guildId:string> 配置指定群聊')
      .action(async ({ session, options }) => {
        const guildId = options.guild || session.guildId

        if (!guildId) {
          return '请在群聊中使用此命令或使用 -g 参数指定群号'
        }

        const isGuildSpecific = !!options.guild || !!session.guildId

        let hasChanges = false
        const configMsg = []

        // 获取当前配置的副本用于更新
        const currentReport = { ...this.config.report }

        if (isGuildSpecific) {
          configMsg.push(`群 ${guildId} 的举报功能配置：`)

          if (!currentReport.guildConfigs) {
            currentReport.guildConfigs = {}
          }

          if (!currentReport.guildConfigs[guildId]) {
            currentReport.guildConfigs[guildId] = {
              enabled: true,
              includeContext: false,
              contextSize: 5,
              autoProcess: true
            }
          }

          const guildConfig = currentReport.guildConfigs[guildId]

          if (options.enabled !== undefined) {
            guildConfig.enabled = options.enabled
            hasChanges = true
          }

          if (options.auto !== undefined) {
            guildConfig.autoProcess = options.auto
            hasChanges = true
          }

          if (options.recall !== undefined) {
            guildConfig.autoRecall = options.recall
            hasChanges = true
          }

          if (options.context !== undefined) {
            guildConfig.includeContext = options.context
            hasChanges = true
          }

          if (options['context-size'] !== undefined) {
            const size = options['context-size']
            if (size < 1 || size > 20) {
              return '上下文消息数量必须在1-20之间'
            }
            guildConfig.contextSize = size
            hasChanges = true
          }

          configMsg.push(`状态: ${guildConfig.enabled ? '已启用' : '已禁用'}`)
          configMsg.push(`自动处理: ${guildConfig.autoProcess ? '已启用' : '已禁用'}`)
          configMsg.push(`自动撤回: ${(guildConfig.autoRecall ?? this.config.report?.autoRecall ?? true) ? '已启用' : '已禁用'}`)
          configMsg.push(`包含上下文: ${guildConfig.includeContext ? '已启用' : '已禁用'}`)
          configMsg.push(`上下文消息数量: ${guildConfig.contextSize || 5}`)
        } else {
          configMsg.push('全局举报功能配置：')

          if (options.enabled !== undefined) {
            currentReport.enabled = options.enabled
            hasChanges = true
          }

          if (options.auto !== undefined) {
            currentReport.autoProcess = options.auto
            hasChanges = true
          }

          if (options.recall !== undefined) {
            currentReport.autoRecall = options.recall
            hasChanges = true
          }

          if (options.authority !== undefined && !isNaN(options.authority)) {
            currentReport.authority = options.authority
            hasChanges = true
          }

          configMsg.push(`全局状态: ${currentReport.enabled ? '已启用' : '已禁用'}`)
          configMsg.push(`全局自动处理: ${currentReport.autoProcess ? '已启用' : '已禁用'}`)
          configMsg.push(`全局自动撤回: ${(currentReport.autoRecall ?? true) ? '已启用' : '已禁用'}`)
          configMsg.push(`权限等级: ${currentReport.authority}`)
        }

        if (hasChanges) {
          // 通过 SettingsManager 持久化配置
          await this.ctx.groupHelper.settings.update({ report: currentReport })
          await this.logCommand(session, 'report-config', isGuildSpecific ? guildId : 'global', '已更新举报功能配置')
          return `举报功能配置已更新\n${configMsg.join('\n')}`
        }

        return configMsg.join('\n')
      })
  }

  /**
   * 调用 AI 进行内容审核
   */
  private async callModeration(prompt: string): Promise<string> {
    try {
      // 使用内置的 AIModule 进行内容审核
      const aiModule = this.ctx.groupHelper.getModule<import('./ai.module').AIModule>('ai')

      if (!aiModule) {
        throw new Error('AI 模块未加载')
      }

      return await aiModule.callModeration(prompt)
    } catch (e) {
      logger.error('调用 AI 审核失败:', e)
      throw e
    }
  }

  /**
   * 处理违规
   */
  private async handleViolation(
    session: any,
    userId: string,
    violation: ViolationInfo,
    content: string,
    verbose = false,
    guildConfig: any = null,
    reportedMessageId?: string
  ): Promise<string> {
    const bot = session.bot
    const guildId = session.guildId

    try {
      if (violation.level === ViolationLevel.NONE) {
        return verbose
          ? `AI判断结果：该消息未违规\n理由：${violation.reason}`
          : '该消息未被判定为违规内容。'
      }

      let result = ''

      const shouldAutoProcess = guildConfig
        ? guildConfig.autoProcess
        : this.config.report?.autoProcess

      if (!shouldAutoProcess) {
        result = verbose
          ? `AI判断结果：${this.getViolationLevelText(violation.level)}违规\n理由：${violation.reason}\n操作：自动处理功能已禁用，请管理员手动处理`
          : `该消息被判定为${this.getViolationLevelText(violation.level)}违规，请管理员手动处理。`

        await this.logCommand(session, 'report-no-action', userId, `${this.getViolationLevelText(violation.level)}违规，管理员待处理`)
        return result
      }

      const actions = violation.action || []
      const actionResults: string[] = []

      // 处罚前先撤回被举报消息（可配置，默认开启）；先撤回再处罚，保证踢出前消息已撤
      const autoRecall = guildConfig?.autoRecall ?? this.config.report?.autoRecall ?? true
      if (autoRecall && reportedMessageId && actions.length > 0) {
        try {
          await session.bot.deleteMessage(guildId, reportedMessageId)
          actionResults.push('撤回消息')
        } catch (e) {
          logger.warn('撤回被举报消息失败（不影响处罚）:', e)
        }
      }

      // 简化处理：直接执行所有操作
      for (const action of actions) {
        await this.executeAction(action, session, userId, actionResults)
      }

      if (actions.length === 0) {
        result = verbose
          ? `AI判断结果：${this.getViolationLevelText(violation.level)}违规\n理由：${violation.reason}\n操作：无需处理`
          : `该消息被判定为${this.getViolationLevelText(violation.level)}违规，无需处理。`
      } else {
        const actionText = actionResults.join('、')
        result = verbose
          ? `AI判断结果：${this.getViolationLevelText(violation.level)}违规\n理由：${violation.reason}\n操作：${actionText}`
          : `已对用户 ${userId} 执行：${actionText}，${this.getViolationLevelText(violation.level)}违规。`
      }

      // 记录日志
      try {
        const actionText = violation.action.length > 0
          ? violation.action.map(a => {
              switch(a.type) {
                case 'ban': return `禁言${a.time}秒`
                case 'warn': return `警告${a.count}次`
                case 'kick': return '踢出群聊'
                case 'kick_blacklist': return '踢出并拉黑'
                default: return a.type
              }
            }).join('、')
          : '无操作'

        const shortContent = content.length > 30 ? content.substring(0, 30) + '...' : content
        const logResult = `${this.getViolationLevelText(violation.level)}违规，处理: ${actionText}，内容: ${shortContent}`
        await this.logCommand(session, 'report-handle', userId, logResult)

        const message = `[举报] 群${guildId} 用户 ${userId} - ${this.getViolationLevelText(violation.level)}违规\n内容: ${shortContent}\n处理: ${actionText}`
        await this.ctx.groupHelper.pushMessage(bot, message, 'warning')
      } catch (e) {
        logger.error('记录举报处理日志失败:', e)
      }

      return result
    } catch (e) {
      logger.error('执行违规处理失败:', e)

      try {
        const errorResult = `${this.getViolationLevelText(violation.level)}违规处理失败: ${e.message.substring(0, 50)}`
        await this.logCommand(session, 'report-error', userId, errorResult)

        const errorMessage = `[举报失败] 用户 ${userId} - ${this.getViolationLevelText(violation.level)}违规\n错误: ${e.message.substring(0, 50)}`
        await this.ctx.groupHelper.pushMessage(bot, errorMessage, 'warning')
      } catch (err) {
        logger.error('记录举报错误日志失败:', err)
      }

      return `AI已判定该消息${this.getViolationLevelText(violation.level)}违规，但自动处理失败：${e.message}\n请联系管理员手动处理。`
    }
  }

  /**
   * 获取违规等级文本
   */
  private getViolationLevelText(level: ViolationLevel): string {
    switch(level) {
      case ViolationLevel.NONE: return '未'
      case ViolationLevel.LOW: return '轻微'
      case ViolationLevel.MEDIUM: return '中度'
      case ViolationLevel.HIGH: return '严重'
      case ViolationLevel.CRITICAL: return '极其严重'
      default: return '未知'
    }
  }

  /**
   * 执行操作
   */
  private async executeAction(action: ViolationAction, session: any, userId: string, actionResults: string[]): Promise<void> {
    try {
      switch (action.type) {
        case 'ban':
          if (action.time && action.time > 0) {
            await this.banUserBySeconds(session, userId, action.time)
            actionResults.push(`禁言${action.time}秒`)
          }
          break

        case 'warn':
          if (action.count && action.count > 0) {
            await this.warnUser(session, userId, action.count)
            actionResults.push(`警告${action.count}次`)
          }
          break

        case 'kick':
          await this.kickUser(session, userId, false)
          actionResults.push('踢出群聊')
          break

        case 'kick_blacklist':
          await this.kickUser(session, userId, true)
          actionResults.push('踢出群聊并加入黑名单')
          break

        default:
          logger.warn(`未知的操作类型: ${action.type}`)
      }
    } catch (e) {
      logger.error(`执行操作失败: ${action.type}`, e)
      actionResults.push(`${action.type}操作失败`)
    }
  }

  // 以下处罚动作直接调用 bot API / 模块方法，不再经由「伪造提权 + 执行命令」。
  // 那条老路径有两个致命问题：AuthService 根本不读 session.user.permissions，
  // 所以提权无效、命令被权限钩子拒绝；而拒绝语「你没有权限执行此操作喵」不含"失败"
  // 二字，又会被 result.includes('失败') 判成成功——最终机器人回复"已处罚"，
  // 实际什么都没做。

  /**
   * 警告用户
   */
  private async warnUser(session: any, userId: string, count: number = 1): Promise<void> {
    const warnModule = this.ctx.groupHelper.getModule<WarnModule>('warn')
    if (!warnModule) throw new Error('警告模块未加载')
    await warnModule.applyWarn(session, userId, count)
  }

  /**
   * 按秒数禁言用户
   */
  private async banUserBySeconds(session: any, userId: string, seconds: number): Promise<void> {
    const milliseconds = Math.max(1, Math.floor(seconds)) * 1000
    await session.bot.muteGuildMember(session.guildId, userId, milliseconds)

    // 与 ban 命令走同一条登记路径，供到期通知与 ban-list 使用
    this.data.recordMute(session.guildId, userId, milliseconds)
  }

  /**
   * 踢出用户
   */
  private async kickUser(session: any, userId: string, addToBlacklist: boolean): Promise<void> {
    await session.bot.kickGuildMember(session.guildId, userId, addToBlacklist)

    if (addToBlacklist) {
      const blacklist = this.data.blacklist.getAll()
      blacklist[userId] = { userId, timestamp: Date.now() }
      this.data.blacklist.setAll(blacklist)
    }
  }


  /**
   * 设置清理任务
   */
  private setupCleanupTask(): void {
    this.ctx.setInterval(() => {
      const now = Date.now()

      // 清理过期的举报冷却
      for (const key in this.reportBans) {
        if (this.reportBans[key].expireTime <= now) {
          delete this.reportBans[key]
        }
      }

      // 清理过期的已举报消息记录（24小时）
      for (const key in this.reportedMessages) {
        if (now - this.reportedMessages[key].timestamp > 24 * 60 * 60 * 1000) {
          delete this.reportedMessages[key]
        }
      }
    }, 10 * 60 * 1000)
  }
}