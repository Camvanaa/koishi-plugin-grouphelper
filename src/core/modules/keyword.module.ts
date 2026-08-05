/**
 * 关键词模块
 * 提供入群验证关键词和禁言关键词管理功能
 */
import { Context, Session } from 'koishi'
import { BaseModule, ModuleMeta } from './base.module'
import type { DataManager } from '../data'
import type { Config, GroupConfig } from '../../types'
import { parseTimeString, formatDuration, matchesKeyword, validateKeyword, parseBoolOption, REGEX_KEYWORD_PREFIX } from '../../utils'

export class KeywordModule extends BaseModule {
  readonly meta: ModuleMeta = {
    name: 'keyword',
    description: '关键词管理功能，包括入群验证和禁言关键词',
    version: '1.0.1'
  }

  constructor(ctx: Context, data: DataManager, config: Config) {
    super(ctx, data, config)
  }

  protected async onInit(): Promise<void> {
    this.registerVerifyCommand()
    this.registerForbiddenCommand()
    this.registerMiddleware()
  }

  /**
   * 注册入群验证关键词命令
   */
  private registerVerifyCommand(): void {
    this.registerCommand({
      name: 'verify',
      desc: '入群验证关键词管理',
      permNode: 'verify',
      permDesc: '管理入群验证关键词',
      usage: '-a 添加关键词，-r 移除，--clear 清空，-l 列出，-n 自动拒绝，-w 设置拒绝词'
    })
      .option('a', '-a <关键词> 添加关键词，多个关键词用英文逗号分隔')
      .option('r', '-r <关键词> 移除关键词，多个关键词用英文逗号分隔')
      .option('clear', '--clear 清除所有关键词')
      .option('l', '-l 列出关键词')
      .option('n', '-n <true/false> 设置未匹配关键词时是否自动拒绝')
      .option('w', '-w <拒绝词> 设置拒绝时的回复')
      .action(async ({ session, options }) => {
        return this.handleVerify(session, options)
      })
  }

  /**
   * 处理 verify 命令
   */
  private async handleVerify(session: Session, options: any): Promise<string> {
    if (!session.guildId) return this.reply('common.guildOnly')

    // 初始化群配置
    let groupConfig = this.data.groupConfig.get(session.guildId) || {} as GroupConfig
    groupConfig.approvalKeywords = groupConfig.approvalKeywords || []
    if (groupConfig.auto === undefined) {
      groupConfig.auto = 'false'
    }
    if (groupConfig.reject === undefined) {
      groupConfig.reject = '答案错误，请重新申请'
    }

    // 列出关键词
    if (options.l) {
      const keywords = groupConfig.approvalKeywords
      return this.reply('keyword.verifyList', {
        keywords: keywords.join('、') || '无',
        auto: groupConfig.auto,
        reject: groupConfig.reject
      })
    }

    // 添加关键词
    if (options.a) {
      const { accepted, errors } = this.prepareNewKeywords(options.a, groupConfig.approvalKeywords)
      if (!accepted.length) {
        return errors.length ? this.reply('keyword.addNone', { errors: errors.join('\n') }) : this.reply('keyword.exists')
      }
      groupConfig.approvalKeywords.push(...accepted)
      this.data.groupConfig.set(session.guildId, groupConfig)
      this.data.groupConfig.flush()
      this.log(session, 'verify', 'add', `已添加关键词：${accepted.join('、')}`)
      const skipped = errors.length ? `\n已跳过：\n${errors.join('\n')}` : ''
      return this.reply('keyword.added', { keywords: accepted.join('、'), skipped })
    }

    // 移除关键词
    if (options.r) {
      const removeKeywords = options.r.split(',').map((k: string) => k.trim()).filter((k: string) => k)
      const removed: string[] = []
      for (const keyword of removeKeywords) {
        const index = groupConfig.approvalKeywords.indexOf(keyword)
        if (index > -1) {
          groupConfig.approvalKeywords.splice(index, 1)
          removed.push(keyword)
        }
      }
      if (removed.length > 0) {
        this.data.groupConfig.set(session.guildId, groupConfig)
        this.data.groupConfig.flush()
        this.log(session, 'verify', 'remove', `已移除关键词：${removed.join('、')}`)
        return this.reply('keyword.removed', { keywords: removed.join('、') })
      }
      return this.reply('keyword.notFound')
    }

    // 清除所有关键词
    if (options.clear) {
      if (!groupConfig.approvalKeywords.length) {
        return this.reply('keyword.emptyVerify')
      }
      groupConfig.approvalKeywords = []
      this.data.groupConfig.set(session.guildId, groupConfig)
      this.data.groupConfig.flush()
      this.log(session, 'verify', 'clear', `已清除所有关键词`)
      return this.reply('keyword.verifyCleared')
    }

    // 设置自动拒绝
    if (options.n !== undefined) {
      const parsed = parseBoolOption(options.n)
      if (parsed === null) {
        return this.reply('common.invalidBool')
      }
      groupConfig.auto = parsed ? 'true' : 'false'
      this.data.groupConfig.set(session.guildId, groupConfig)
      this.data.groupConfig.flush()
      this.log(session, 'verify', 'auto', `已设置自动拒绝：${groupConfig.auto}`)
      return this.reply('keyword.autoRejectUpdated', { state: groupConfig.auto })
    }

    // 设置拒绝词
    if (options.w) {
      groupConfig.reject = options.w
      this.data.groupConfig.set(session.guildId, groupConfig)
      this.data.groupConfig.flush()
      this.log(session, 'verify', 'set', `已设置拒绝词：${options.w}`)
      return this.reply('keyword.rejectUpdated', { message: options.w })
    }

    return this.reply('keyword.verifyUsage')
  }

  /**
   * 注册禁言关键词命令
   */
  private registerForbiddenCommand(): void {
    this.registerCommand({
      name: 'forbidden',
      desc: '禁言关键词管理',
      permNode: 'forbidden',
      permDesc: '管理禁言关键词',
      usage: '-a 添加关键词，-r 移除，--clear 清空，-l 列出，-d/-b/-k 开关，-t 禁言时长'
    })
      .option('a', '-a <关键词> 添加关键词，多个关键词用英文逗号分隔')
      .option('r', '-r <关键词> 移除关键词，多个关键词用英文逗号分隔')
      .option('clear', '--clear 清除所有关键词')
      .option('l', '-l 列出关键词')
      .option('d', '-d <value:string> 设置是否自动撤回包含关键词的消息')
      .option('b', '-b <value:string> 设置是否自动禁言')
      .option('k', '-k <value:string> 设置是否自动踢出')
      .option('t', '-t <时长> 设置自动禁言时长')
      .option('echo','--echo <value:string> 是否在操作后回显结果')
      .action(async ({ session, options }) => {
        return this.handleForbidden(session, options)
      })
  }

  /**
   * 处理 forbidden 命令
   */
  private async handleForbidden(session: Session, options: any): Promise<string> {
    if (!session.guildId) return this.reply('common.guildOnly')

    let groupConfig = this.data.groupConfig.get(session.guildId) || {} as GroupConfig
    const forbiddenConfig = { ...this.config.forbidden, ...(groupConfig.forbidden || {}) }

    // 列出关键词
    if (options.l) {
      const keywords = groupConfig.keywords || []
      return this.reply('keyword.forbiddenList', {
        globalKeywords: this.config.forbidden.keywords.join('、') || '无',
        groupKeywords: keywords.join('、') || '无',
        echo: forbiddenConfig.echo ? '开启' : '关闭',
        autoDelete: forbiddenConfig.autoDelete ? '开启' : '关闭',
        autoBan: forbiddenConfig.autoBan ? '开启' : '关闭',
        autoKick: forbiddenConfig.autoKick ? '开启' : '关闭',
        duration: formatDuration(forbiddenConfig.muteDuration),
        prefix: REGEX_KEYWORD_PREFIX
      })
    }

    // 添加关键词
    if (options.a) {
      groupConfig.keywords = groupConfig.keywords || []
      const { accepted, errors } = this.prepareNewKeywords(options.a, groupConfig.keywords)
      if (!accepted.length) {
        return errors.length ? this.reply('keyword.addNone', { errors: errors.join('\n') }) : this.reply('keyword.exists')
      }
      groupConfig.keywords.push(...accepted)
      this.data.groupConfig.set(session.guildId, groupConfig)
      this.data.groupConfig.flush()
      this.log(session, 'forbidden', 'add', `成功：已添加关键词：${accepted.join('、')}`)
      const skipped = errors.length ? `\n已跳过：\n${errors.join('\n')}` : ''
      return this.reply('keyword.added', { keywords: accepted.join('、'), skipped })
    }

    // 移除关键词
    if (options.r) {
      const removeKeywords = options.r.split(',').map((k: string) => k.trim()).filter((k: string) => k)
      const removed: string[] = []
      if (!groupConfig.keywords) return this.reply('keyword.emptyForbidden')

      for (const keyword of removeKeywords) {
        const index = groupConfig.keywords.indexOf(keyword)
        if (index > -1) {
          groupConfig.keywords.splice(index, 1)
          removed.push(keyword)
        }
      }
      if (removed.length > 0) {
        this.data.groupConfig.set(session.guildId, groupConfig)
        this.data.groupConfig.flush()
        this.log(session, 'forbidden', 'remove', `成功：已移除关键词：${removed.join('、')}`)
        return this.reply('keyword.removed', { keywords: removed.join('、') })
      }
      return this.reply('keyword.notFound')
    }

    // 清除所有关键词
    if (options.clear) {
      if (!groupConfig.keywords || !groupConfig.keywords.length) {
        return this.reply('keyword.emptyForbidden')
      }
      groupConfig.keywords = []
      this.data.groupConfig.set(session.guildId, groupConfig)
      this.data.groupConfig.flush()
      this.log(session, 'forbidden', 'clear', `成功：已清除所有关键词`)
      return this.reply('keyword.forbiddenCleared')
    }

    // 确保 forbidden 配置存在的辅助函数
    const ensureForbiddenExists = () => {
      if (!groupConfig.forbidden) {
        groupConfig.forbidden = {
          autoDelete: this.config.forbidden.autoDelete,
          autoBan: this.config.forbidden.autoBan,
          autoKick: this.config.forbidden.autoKick,
          muteDuration: this.config.forbidden.muteDuration
        }
      }
    }

    // 设置自动撤回
    if (options.d !== undefined) {
      const state = parseBoolOption(options.d)
      if (state === null) return this.reply('common.invalidBool')
      ensureForbiddenExists()
      groupConfig.forbidden.autoDelete = state
      this.data.groupConfig.set(session.guildId, groupConfig)
      this.data.groupConfig.flush()
      this.log(session, 'forbidden', 'recall', `成功：已设置自动撤回：${state}`)
      return this.reply('keyword.toggleUpdated', { name: '自动撤回', state })
    }

    // 设置自动禁言
    if (options.b !== undefined) {
      const state = parseBoolOption(options.b)
      if (state === null) return this.reply('common.invalidBool')
      ensureForbiddenExists()
      groupConfig.forbidden.autoBan = state
      this.data.groupConfig.set(session.guildId, groupConfig)
      this.data.groupConfig.flush()
      this.log(session, 'forbidden', 'ban', `成功：已设置自动禁言：${state}`)
      return this.reply('keyword.toggleUpdated', { name: '自动禁言', state })
    }

    // 设置自动踢出
    if (options.k !== undefined) {
      const state = parseBoolOption(options.k)
      if (state === null) return this.reply('common.invalidBool')
      ensureForbiddenExists()
      groupConfig.forbidden.autoKick = state
      this.data.groupConfig.set(session.guildId, groupConfig)
      this.data.groupConfig.flush()
      this.log(session, 'forbidden', 'kick', `成功：已设置自动踢出：${state}`)
      return this.reply('keyword.toggleUpdated', { name: '自动踢出', state })
    }

    // 设置禁言时长
    if (options.t) {
      const duration = options.t
      try {
        const milliseconds = parseTimeString(duration)
        ensureForbiddenExists()
        groupConfig.forbidden.muteDuration = milliseconds
        this.data.groupConfig.set(session.guildId, groupConfig)
        this.data.groupConfig.flush()
        this.log(session, 'forbidden', 'set', `成功：已设置禁言时间：${duration}`)
        return this.reply('keyword.durationUpdated', { duration })
      } catch (e) {
        return this.reply('keyword.invalidTime', { duration })
      }
    }

    // 设置是否有触发回显
    if (options.echo !== undefined) {
      const state = parseBoolOption(options.echo)
      console.log('echo state', state)
      if (state === null) return this.reply('common.invalidBool')
      ensureForbiddenExists()
      groupConfig.forbidden.echo = state
      this.data.groupConfig.set(session.guildId, groupConfig)
      this.data.groupConfig.flush()
      this.log(session, 'forbidden', 'echo', `成功：已设置回显：${state}`)
      return this.reply('keyword.toggleUpdated', { name: '回显', state })
    }

    return this.reply('keyword.forbiddenUsage')
  }

  /**
   * 注册关键词检测中间件
   */
  private registerMiddleware(): void {
    this.ctx.middleware(async (session, next) => {
      if (!session.content || !session.guildId) return next()

      let content = session.content
      content = content.replace(/<at id="\d+"\/>/g, '')  // 移除 at 标签
      content = content.replace(/<img[^>]+>/g, '')       // 移除图片标签
      content = content.trim()

      if (!content) return next()

      const groupConfig = this.data.groupConfig.get(session.guildId) || {} as GroupConfig
      
      // 合并全局和群组配置
      const forbiddenConfig = { ...this.config.forbidden, ...(groupConfig.forbidden || {}) }
      const groupKeywords = groupConfig.keywords || []
      // 最终生效的关键词列表
      const effectiveKeywords = [...this.config.forbidden.keywords, ...groupKeywords]

      if (effectiveKeywords.length === 0) return next()


      // 处理自动撤回
      if (forbiddenConfig.autoDelete) {
        await this.handleAutoDelete(session, content, effectiveKeywords, forbiddenConfig)
      }

      // 处理自动禁言/自动踢出（autoKick 分支在 handleAutoBan 内部，仅开启 autoKick 时也需进入）
      if (forbiddenConfig.autoBan || forbiddenConfig.autoKick) {
        const matched = await this.handleAutoBan(session, content, effectiveKeywords, forbiddenConfig)
        if (matched) return
      }

      return next()
    })
  }

  /**
   * 处理自动禁言
   */
  private async handleAutoBan(
    session: Session,
    content: string,
    keywords: string[],
    forbiddenConfig: any
  ): Promise<boolean> {
    for (const keyword of keywords) {
      const matched = this.matchKeyword(content, keyword)
      if (!matched) continue

      // 自动踢出
      if (forbiddenConfig.autoKick) {
        // 踢出前先撤回触发消息；autoDelete 开启时中间件已先行撤回，避免重复调用
        if (!forbiddenConfig.autoDelete) {
          try {
            await session.bot.deleteMessage(session.guildId, session.messageId)
            this.log(session, 'keyword-delete', session.userId, `成功：踢出前已撤回触发消息`)
          } catch (e) {
            this.log(session, 'keyword-delete', session.userId, `失败：踢出前撤回消息失败（不影响踢出）`)
          }
        }
        try {
          await session.bot.kickGuildMember(session.guildId, session.userId)
          this.log(session, 'keyword-kick', session.userId, `成功：关键词匹配，已踢出群聊`)
          await session.send(this.reply('keyword.autoKickSuccess', { username: session.username }))
          return true
        } catch (e) {
          const { reason, hint } = this.explainError(e)
          this.log(session, 'keyword-kick', session.userId, `失败：${reason}`, false)
          await session.send(this.reply('keyword.autoKickFailed', { reason, hint }))
        }
      }

      // 自动禁言（仅在开启 autoBan 时执行；仅开启 autoKick 且踢出失败时不应转为禁言）
      if (!forbiddenConfig.autoBan) return false
      let duration = forbiddenConfig.muteDuration
      try {
        // 检查是否已有更长的禁言
        const guildMutes = this.data.mutes.get(session.guildId) || {}
        const lastMute = guildMutes[session.userId]
        let covered = false

        if (lastMute && (lastMute.startTime + lastMute.duration) > (Date.now() + duration)) {
          duration = lastMute.startTime + lastMute.duration - Date.now()
          covered = true
        }

        await session.bot.muteGuildMember(session.guildId, session.userId, duration)
        this.data.recordMute(session.guildId, session.userId, duration)

        if (covered) {
          this.log(session, 'keyword-ban', session.userId, `成功：关键词匹配，已有更长禁言，禁言时长 ${formatDuration(duration)}`)
          if (forbiddenConfig.echo) {
            await session.send(this.reply('keyword.autoBanCovered', { duration: formatDuration(duration) }))
          }
        } else {
          this.log(session, 'keyword-ban', session.userId, `成功：关键词匹配，禁言时长 ${formatDuration(duration)}`)
          if (forbiddenConfig.echo) {
            await session.send(this.reply('keyword.autoBanSuccess', { duration: formatDuration(duration) }))
          }
        }
        return true
      } catch (e) {
        this.log(session, 'keyword-ban', session.userId, `失败`)
        if (forbiddenConfig.echo) {
          await session.send(this.reply('keyword.autoBanFailed'))
        }
      }
      break
    }
    return false
  }

  /**
   * 处理自动撤回
   */
  private async handleAutoDelete(
    session: Session,
    content: string,
    keywords: string[],
    forbiddenConfig: any
  ): Promise<void> {
    for (const keyword of keywords) {
      const matched = this.matchKeyword(content, keyword)
      if (!matched) continue

      try {
        await session.bot.deleteMessage(session.guildId, session.messageId)
        this.log(session, 'keyword-delete', session.userId, `成功：关键词匹配，消息已撤回`)
        if (forbiddenConfig.echo) {
            await session.send(this.reply('keyword.autoDeleteSuccess'))
        }
      } catch (e) {
        this.log(session, 'keyword-delete', session.userId, `失败`)
        if (forbiddenConfig.echo) {
          await session.send(this.reply('keyword.autoDeleteFailed'))
        }
      }
      break
    }
  }

  /**
   * 匹配关键词：默认字面量，`re:` 前缀才按正则处理
   */
  private matchKeyword(content: string, keyword: string): boolean {
    return matchesKeyword(content, keyword)
  }

  /**
   * 解析待添加的关键词列表，挡掉非法正则并跳过重复项。
   *
   * 非法正则必须在写入前拦下：一旦落盘，之后每条消息都会尝试编译它。
   */
  private prepareNewKeywords(
    raw: string,
    existing: string[]
  ): { accepted: string[]; errors: string[] } {
    const accepted: string[] = []
    const errors: string[] = []

    for (const keyword of raw.split(',').map(k => k.trim()).filter(Boolean)) {
      const reason = validateKeyword(keyword)
      if (reason) {
        errors.push(`${keyword}（${reason}）`)
        continue
      }
      if (existing.includes(keyword) || accepted.includes(keyword)) continue
      accepted.push(keyword)
    }

    return { accepted, errors }
  }

  /**
   * 获取群组入群验证关键词
   */
  getVerifyKeywords(guildId: string): string[] {
    const groupConfig = this.data.groupConfig.get(guildId) || {} as GroupConfig
    return groupConfig.approvalKeywords || []
  }

  /**
   * 获取群组禁言关键词
   */
  getForbiddenKeywords(guildId: string): string[] {
    const groupConfig = this.data.groupConfig.get(guildId) || {} as GroupConfig
    return groupConfig.keywords || []
  }

  /**
   * 获取生效的禁言关键词（包括全局）
   */
  getEffectiveKeywords(guildId: string): string[] {
    const groupKeywords = this.getForbiddenKeywords(guildId)
    return [...this.config.forbidden.keywords, ...groupKeywords]
  }
}
