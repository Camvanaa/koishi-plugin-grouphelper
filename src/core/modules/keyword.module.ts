/**
 * 关键词模块
 * 提供入群验证关键词和禁言关键词管理功能
 */
import { Context, Session } from 'koishi'
import { BaseModule, ModuleMeta } from './base.module'
import type { DataManager } from '../data'
import type { Config, GroupConfig } from '../../types'
import { parseTimeString, formatDuration } from '../../utils'

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
      permDesc: '管理入群验证关键词'
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
    if (!session.guildId) return '喵呜...这个命令只能在群里用喵...'

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
      return `当前群入群审核关键词：\n${keywords.join('、') || '无'}\n自动拒绝状态：${groupConfig.auto}\n拒绝词：${groupConfig.reject}`
    }

    // 添加关键词
    if (options.a) {
      const newKeywords = options.a.split(',').map((k: string) => k.trim()).filter((k: string) => k)
      groupConfig.approvalKeywords.push(...newKeywords)
      this.data.groupConfig.set(session.guildId, groupConfig)
      this.data.groupConfig.flush()
      this.log(session, 'verify', 'add', `已添加关键词：${newKeywords.join('、')}`)
      return `已经添加了关键词：${newKeywords.join('、')} 喵喵喵~`
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
        return `已经把关键词：${removed.join('、')} 删掉啦喵！`
      }
      return '未找到指定的关键词'
    }

    // 清除所有关键词
    if (options.clear) {
      if (!groupConfig.approvalKeywords.length) {
        return '当前没有任何入群审核关键词喵~'
      }
      groupConfig.approvalKeywords = []
      this.data.groupConfig.set(session.guildId, groupConfig)
      this.data.groupConfig.flush()
      this.log(session, 'verify', 'clear', `已清除所有关键词`)
      return '所有入群审核关键词已清除喵~'
    }

    // 设置自动拒绝
    if (options.n !== undefined) {
      const value = String(options.n).toLowerCase()
      if (value === 'true' || value === '1' || value === 'yes' || value === 'y' || value === 'on') {
        groupConfig.auto = 'true'
      } else if (value === 'false' || value === '0' || value === 'no' || value === 'n' || value === 'off') {
        groupConfig.auto = 'false'
      } else {
        return '无效的值，请使用 true/false、1/0、yes/no、y/n 或 on/off'
      }
      this.data.groupConfig.set(session.guildId, groupConfig)
      this.data.groupConfig.flush()
      this.log(session, 'verify', 'auto', `已设置自动拒绝：${groupConfig.auto}`)
      return `自动拒绝状态更新为${groupConfig.auto}`
    }

    // 设置拒绝词
    if (options.w) {
      groupConfig.reject = options.w
      this.data.groupConfig.set(session.guildId, groupConfig)
      this.data.groupConfig.flush()
      this.log(session, 'verify', 'set', `已设置拒绝词：${options.w}`)
      return `拒绝词已更新为：${options.w} 喵喵喵~`
    }

    return '请使用：\n-a 添加关键词\n-r 移除关键词\n--clear 清空关键词\n-l 列出关键词\n-n <true/false> 未匹配关键词自动拒绝\n-w <拒绝词> 设置拒绝时的回复\n多个关键词用英文逗号分隔'
  }

  /**
   * 注册禁言关键词命令
   */
  private registerForbiddenCommand(): void {
    this.registerCommand({
      name: 'forbidden',
      desc: '禁言关键词管理',
      permNode: 'forbidden',
      permDesc: '管理禁言关键词'
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
    if (!session.guildId) return '喵呜...这个命令只能在群里用喵...'

    let groupConfig = this.data.groupConfig.get(session.guildId) || {} as GroupConfig
    const forbiddenConfig = { ...this.config.forbidden, ...(groupConfig.forbidden || {}) }

    // 列出关键词
    if (options.l) {
      const keywords = groupConfig.keywords || []
      return `全局禁言关键词：\n${this.config.forbidden.keywords.join('、') || '无'}
当前群禁言关键词：\n${keywords.join('、') || '无'}
回显状态：${forbiddenConfig.echo ? '开启' : '关闭'}
自动撤回状态：${forbiddenConfig.autoDelete ? '开启' : '关闭'}
自动禁言状态：${forbiddenConfig.autoBan ? '开启' : '关闭'}
自动踢出状态：${forbiddenConfig.autoKick ? '开启' : '关闭'}
自动禁言时长：${formatDuration(forbiddenConfig.muteDuration)}`
    }

    // 添加关键词
    if (options.a) {
      const newKeywords = options.a.split(',').map((k: string) => k.trim()).filter((k: string) => k)
      groupConfig.keywords = groupConfig.keywords || []
      groupConfig.keywords.push(...newKeywords)
      this.data.groupConfig.set(session.guildId, groupConfig)
      this.data.groupConfig.flush()
      this.log(session, 'forbidden', 'add', `成功：已添加关键词：${newKeywords.join('、')}`)
      return `已经添加了关键词：${newKeywords.join('、')} 喵喵喵~`
    }

    // 移除关键词
    if (options.r) {
      const removeKeywords = options.r.split(',').map((k: string) => k.trim()).filter((k: string) => k)
      const removed: string[] = []
      if (!groupConfig.keywords) return '当前没有任何禁言关键词喵~'

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
        return `已经把关键词：${removed.join('、')} 删掉啦喵！`
      }
      return '未找到指定的关键词'
    }

    // 清除所有关键词
    if (options.clear) {
      if (!groupConfig.keywords || !groupConfig.keywords.length) {
        return '当前没有任何禁言关键词喵~'
      }
      groupConfig.keywords = []
      this.data.groupConfig.set(session.guildId, groupConfig)
      this.data.groupConfig.flush()
      this.log(session, 'forbidden', 'clear', `成功：已清除所有关键词`)
      return '所有禁言关键词已清除喵~'
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
      const state = this.parseBooleanOption(options.d)
      if (state === null) return '无效的值，请使用 true/false'
      ensureForbiddenExists()
      groupConfig.forbidden.autoDelete = state
      this.data.groupConfig.set(session.guildId, groupConfig)
      this.data.groupConfig.flush()
      this.log(session, 'forbidden', 'recall', `成功：已设置自动撤回：${state}`)
      return `自动撤回状态更新为${state}`
    }

    // 设置自动禁言
    if (options.b !== undefined) {
      const state = this.parseBooleanOption(options.b)
      if (state === null) return '无效的值，请使用 true/false'
      ensureForbiddenExists()
      groupConfig.forbidden.autoBan = state
      this.data.groupConfig.set(session.guildId, groupConfig)
      this.data.groupConfig.flush()
      this.log(session, 'forbidden', 'ban', `成功：已设置自动禁言：${state}`)
      return `自动禁言状态更新为${state}`
    }

    // 设置自动踢出
    if (options.k !== undefined) {
      const state = this.parseBooleanOption(options.k)
      if (state === null) return '无效的值，请使用 true/false'
      ensureForbiddenExists()
      groupConfig.forbidden.autoKick = state
      this.data.groupConfig.set(session.guildId, groupConfig)
      this.data.groupConfig.flush()
      this.log(session, 'forbidden', 'kick', `成功：已设置自动踢出：${state}`)
      return `自动踢出状态更新为${state}`
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
        return `禁言时间已更新为：${duration} 喵喵喵~`
      } catch (e) {
        return `无效的时间格式：${duration}，请使用类似 "1h" 或 "30m" 的格式`
      }
    }

    // 设置是否回显
    if (options.echo !== undefined) {
      const state = this.parseBooleanOption(options.echo)
      console.log('echo state', state)
      if (state === null) return '无效的值，请使用 true/false'
      ensureForbiddenExists()
      groupConfig.forbidden.echo = state
      this.data.groupConfig.set(session.guildId, groupConfig)
      this.data.groupConfig.flush()
      this.log(session, 'forbidden', 'echo', `成功：已设置回显：${state}`)
      return `回显状态更新为${state}`
    }

    return '请使用：\n-a 添加关键词\n-r 移除关键词\n--clear 清空关键词\n-l 列出关键词\n-d <true/false> 设置是否自动撤回包含关键词的消息\n-b <true/false> 设置是否启用关键词禁言\n-k <true/false> 设置是否启用关键词踢出\n-t <时长> 设置自动禁言时长\n多个关键词用英文逗号分隔'
  }

  /**
   * 解析布尔值选项
   */
  private parseBooleanOption(value: any): boolean | null {
    const v = String(value).toLowerCase()
    if (v === 'true' || v === '1' || v === 'yes' || v === 'y' || v === 'on') {
      return true
    } else if (v === 'false' || v === '0' || v === 'no' || v === 'n' || v === 'off') {
      return false
    }
    return null
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

      // 处理自动禁言
      if (forbiddenConfig.autoBan) {
        const matched = await this.handleAutoBan(session, content, effectiveKeywords, forbiddenConfig)
        if (matched) return
      }

      // 处理自动撤回
      if (forbiddenConfig.autoDelete) {
        await this.handleAutoDelete(session, content, effectiveKeywords, forbiddenConfig)
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
        try {
          await session.bot.kickGuildMember(session.guildId, session.userId)
          this.log(session, 'keyword-kick', session.userId, `成功：关键词匹配，已踢出群聊`)
          await session.send(`喵呜！发现了关键词，${session.username} 已被踢出群聊...`)
          return true
        } catch (e) {
          this.log(session, 'keyword-kick', session.userId, `失败`)
          await session.send('自动踢出失败了...可能是权限不够喵')
        }
      }

      // 自动禁言
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
        this.recordMute(session.guildId, session.userId, duration)

        if (covered) {
          this.log(session, 'keyword-ban', session.userId, `成功：关键词匹配，已有更长禁言，禁言时长 ${formatDuration(duration)}`)
          if (forbiddenConfig.echo) {
            await session.send(`喵呜！发现了关键词，检测到未完成的禁言，要被禁言 ${formatDuration(duration)} 啦...`)
          }
        } else {
          this.log(session, 'keyword-ban', session.userId, `成功：关键词匹配，禁言时长 ${formatDuration(duration)}`)
          if (forbiddenConfig.echo) {
            await session.send(`喵呜！发现了关键词，要被禁言 ${formatDuration(duration)} 啦...`)
          }
        }
        return true
      } catch (e) {
        this.log(session, 'keyword-ban', session.userId, `失败`)
        if (forbiddenConfig.echo) {
          await session.send('自动禁言失败了...可能是权限不够喵')
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
          await session.send(`喵呜！发现了关键词，消息已被撤回...`)
        }
      } catch (e) {
        this.log(session, 'keyword-delete', session.userId, `失败`)
        if (forbiddenConfig.echo) {
          await session.send('自动撤回失败了...可能是权限不够喵')
        }
      }
      break
    }
  }

  /**
   * 匹配关键词（支持正则表达式）
   */
  private matchKeyword(content: string, keyword: string): boolean {
    try {
      const regex = new RegExp(keyword, 'i')
      return regex.test(content)
    } catch (e) {
      // 正则无效时使用普通字符串匹配
      return content.includes(keyword)
    }
  }

  /**
   * 记录禁言信息
   */
  private recordMute(guildId: string, userId: string, duration: number): void {
    const guildMutes = this.data.mutes.get(guildId) || {}
    guildMutes[userId] = {
      startTime: Date.now(),
      duration: duration,
      remainingTime: duration
    }
    this.data.mutes.set(guildId, guildMutes)
    this.data.mutes.flush()
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