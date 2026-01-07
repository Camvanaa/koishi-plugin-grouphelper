/**
 * AI对话模块
 * 提供AI对话、翻译等功能
 */
import { Context, Session, h } from 'koishi'
import * as path from 'path'
import * as fs from 'fs'
import { BaseModule, ModuleMeta } from './base.module'
import { DataManager } from '../data'
import { Config, ChatMessage, ChatCompletionRequest, ChatCompletionResponse, UserContext } from '../../types'

export class AIModule extends BaseModule {
  readonly meta: ModuleMeta = {
    name: 'ai',
    description: 'AI对话与翻译模块',
    version: '1.0.0',
    author: 'grouphelper'
  }

  // 用户上下文缓存
  private userContexts: Map<string, UserContext> = new Map()
  private contextsPath: string
  private contextTimeout: number = 30 * 60 * 1000 // 30分钟超时
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor(ctx: Context, data: DataManager, config: Config) {
    super(ctx, data, config)
    this.contextsPath = path.join(data.dataPath, 'ai_contexts.json')
  }

  async onInit(): Promise<void> {
    // 初始化数据文件
    this.initDataFiles()
    
    // 加载已有上下文
    this.loadContexts()
    
    // 定期清理过期上下文
    this.cleanupInterval = setInterval(() => this.cleanExpiredContexts(), 10 * 60 * 1000)
    
    // 注册命令
    this.registerCommands()
    
    // 注册中间件
    this.registerMiddleware()
    
    this.data.writeLog('[ai] Module initialized')
  }

  async onDispose(): Promise<void> {
    // 保存上下文
    this.saveContexts()
    
    // 清理定时器
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    
    this.data.writeLog('[ai] Module disposed')
  }

  /**
   * 初始化数据文件
   */
  private initDataFiles(): void {
    if (!fs.existsSync(this.contextsPath)) {
      fs.writeFileSync(this.contextsPath, JSON.stringify({}), 'utf8')
    }
  }

  /**
   * 加载保存的上下文数据
   */
  private loadContexts(): void {
    try {
      const data = JSON.parse(fs.readFileSync(this.contextsPath, 'utf8'))
      for (const [userId, context] of Object.entries(data)) {
        this.userContexts.set(userId, context as UserContext)
      }
      this.data.writeLog(`[ai] Loaded ${this.userContexts.size} AI contexts`)
    } catch (error) {
      this.data.writeLog(`[ai] Failed to load AI contexts: ${error}`)
      this.userContexts = new Map()
    }
  }

  /**
   * 保存上下文数据
   */
  private saveContexts(): void {
    try {
      const data: Record<string, UserContext> = {}
      for (const [userId, context] of this.userContexts.entries()) {
        data[userId] = context
      }
      fs.writeFileSync(this.contextsPath, JSON.stringify(data, null, 2), 'utf8')
    } catch (error) {
      this.data.writeLog(`[ai] Failed to save AI contexts: ${error}`)
    }
  }

  /**
   * 清理过期的用户上下文
   */
  private cleanExpiredContexts(): void {
    const now = Date.now()
    let cleanCount = 0

    for (const [userId, context] of this.userContexts.entries()) {
      if (now - context.lastTimestamp > this.contextTimeout) {
        this.userContexts.delete(userId)
        cleanCount++
      }
    }

    if (cleanCount > 0) {
      this.data.writeLog(`[ai] Cleaned ${cleanCount} expired AI contexts`)
      this.saveContexts()
    }
  }

  /**
   * 获取用户上下文
   */
  private getUserContext(userId: string, systemPrompt: string): UserContext {
    if (!this.userContexts.has(userId)) {
      const newContext: UserContext = {
        userId,
        messages: [{
          role: 'system',
          content: systemPrompt
        }],
        lastTimestamp: Date.now()
      }
      this.userContexts.set(userId, newContext)
    }

    const context = this.userContexts.get(userId)!

    // 检查system prompt是否需要更新
    if (context.messages[0].role === 'system' &&
        context.messages[0].content !== systemPrompt) {
      context.messages[0].content = systemPrompt
    }

    return context
  }

  /**
   * 向用户上下文添加消息
   */
  private addMessageToContext(
    userId: string,
    message: ChatMessage,
    systemPrompt: string,
    contextLimit: number
  ): void {
    const context = this.getUserContext(userId, systemPrompt)
    context.messages.push(message)
    context.lastTimestamp = Date.now()

    // 裁剪超出上下文限制的消息
    if (context.messages.length > contextLimit + 1) {
      const systemMessage = context.messages[0]
      const recentMessages = context.messages.slice(-contextLimit)
      context.messages = [systemMessage, ...recentMessages]
    }

    this.saveContexts()
  }

  /**
   * 调用 OpenAI API
   */
  private async callOpenAI(
    messages: ChatMessage[],
    model: string,
    temperature: number,
    maxTokens: number,
    apiKey: string,
    apiUrl: string
  ): Promise<ChatCompletionResponse> {
    const endpoint = `${apiUrl.endsWith('/') ? apiUrl : apiUrl + '/'}chat/completions`

    const requestBody: ChatCompletionRequest = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens
    }

    try {
      const response = await this.ctx.http.post(endpoint, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      })

      return response as ChatCompletionResponse
    } catch (error) {
      this.data.writeLog(`[ai] OpenAI API 调用出错: ${error}`)
      throw error
    }
  }

  /**
   * 重置用户的对话上下文
   */
  public resetUserContext(userId: string): boolean {
    const deleted = this.userContexts.delete(userId)
    if (deleted) {
      this.saveContexts()
    }
    return deleted
  }

  /**
   * 处理消息并获取 AI 回复
   */
  public async processMessage(
    userId: string,
    content: string,
    guildId?: string
  ): Promise<string> {
    const config = this.config.openai

    if (!config?.enabled) {
      return '抱歉，AI功能当前已禁用。'
    }

    try {
      let systemPrompt = config.systemPrompt || '你是一个有帮助的AI助手。'

      // 如果是群聊，检查群特定配置
      if (guildId) {
        const groupConfig = this.getGroupConfig(guildId)

        if (groupConfig?.openai?.enabled === false) {
          return '抱歉，当前群聊已禁用AI功能。'
        }

        if (groupConfig?.openai?.systemPrompt) {
          systemPrompt = groupConfig.openai.systemPrompt
        }
      }

      // 添加用户消息到上下文
      this.addMessageToContext(
        userId,
        { role: 'user', content },
        systemPrompt,
        config.contextLimit || 10
      )

      // 获取用户上下文
      const context = this.getUserContext(userId, systemPrompt)

      // 调用 API
      const response = await this.callOpenAI(
        context.messages,
        config.model || 'gpt-3.5-turbo',
        config.temperature || 0.7,
        config.maxTokens || 2048,
        config.apiKey,
        config.apiUrl || 'https://api.openai.com/v1'
      )

      // 处理响应
      const assistantMessage = response.choices[0].message

      // 将回复添加到上下文
      this.addMessageToContext(
        userId,
        assistantMessage,
        systemPrompt,
        config.contextLimit || 10
      )

      return assistantMessage.content
    } catch (error: any) {
      this.data.writeLog(`[ai] AI处理消息失败: ${error}`)
      return `处理消息时出错: ${error.message}`
    }
  }

  /**
   * 翻译文本
   */
  public async translateText(
    userId: string,
    text: string,
    guildId?: string,
    customPrompt?: string
  ): Promise<string> {
    const config = this.config.openai

    if (!config?.enabled) {
      return '抱歉，AI翻译功能当前已禁用。'
    }

    try {
      let translatePrompt = config.translatePrompt || 
        '你是一个翻译助手。请将用户的文本准确翻译，保持原文的风格和语气。如果是中文则翻译为英文，如果是其他语言则翻译为中文。不要添加任何解释或额外内容。'

      if (customPrompt) {
        translatePrompt = customPrompt
      } else if (guildId) {
        const groupConfig = this.getGroupConfig(guildId)

        if (groupConfig?.openai?.enabled === false) {
          return '抱歉，当前群聊已禁用AI功能。'
        }

        if (groupConfig?.openai?.translatePrompt) {
          translatePrompt = groupConfig.openai.translatePrompt
        }
      }

      // 翻译不保存上下文
      const messages: ChatMessage[] = [
        { role: 'system', content: translatePrompt },
        { role: 'user', content: text }
      ]

      const response = await this.callOpenAI(
        messages,
        config.model || 'gpt-3.5-turbo',
        0.3,
        config.maxTokens || 2048,
        config.apiKey,
        config.apiUrl || 'https://api.openai.com/v1'
      )

      return response.choices[0].message.content
    } catch (error: any) {
      this.data.writeLog(`[ai] AI翻译失败: ${error}`)
      return `翻译出错: ${error.message}`
    }
  }

  /**
   * 内容审核
   */
  public async callModeration(prompt: string): Promise<string> {
    const config = this.config.openai

    if (!config?.enabled) {
      throw new Error('AI功能当前已禁用')
    }

    try {
      const messages: ChatMessage[] = [
        { role: 'user', content: prompt }
      ]

      const response = await this.callOpenAI(
        messages,
        config.model || 'gpt-3.5-turbo',
        0.3,
        2048,
        config.apiKey,
        config.apiUrl || 'https://api.openai.com/v1'
      )

      return response.choices[0].message.content
    } catch (error: any) {
      this.data.writeLog(`[ai] AI内容审核失败: ${error}`)
      throw new Error(`内容审核失败: ${error.message}`)
    }
  }

  /**
   * 注册命令
   */
  private registerCommands(): void {
    // ai 命令
    this.ctx.command('ai [content:text]', '与AI进行对话')
      .option('reset', '-r 重置对话上下文')
      .action(async ({ session, options }, content) => {
        if (!session) return

        if (!this.config.openai?.enabled) {
          return 'AI功能已被全局禁用'
        }

        if (options?.reset) {
          const reset = this.resetUserContext(session.userId)
          this.log(session, 'ai', 'reset', reset ? '成功' : '无上下文')
          return reset ? '对话上下文已重置' : '没有找到对话上下文'
        }

        if (!content) {
          return '请输入您要问AI的内容，例如：ai 今天天气怎么样？'
        }

        try {
          this.log(session, 'ai', 'chat', content.substring(0, 50))
          const response = await this.processMessage(session.userId, content, session.guildId)
          return response
        } catch (error: any) {
          return `处理请求时出错: ${error.message}`
        }
      })

    // translate 命令
    this.ctx.command('translate <text:text>', '使用AI翻译文本')
      .alias('tsl')
      .option('prompt', '-p <prompt:text> 自定义翻译提示词')
      .action(async ({ session, options }, text) => {
        if (!session) return

        if (!this.config.openai?.enabled) {
          return 'AI功能已被全局禁用'
        }

        // 如果没有文本，尝试从引用消息获取
        if (!text) {
          if (session.quote && session.quote.content) {
            text = session.quote.content
          }

          if (!text) {
            return '请提供要翻译的文本，或回复需要翻译的消息。\n用法：tsl [文本] 或 回复消息后使用 tsl'
          }
        }

        try {
          this.log(session, 'translate', 'request', text.substring(0, 50))

          const translatedText = await this.translateText(
            session.userId,
            text,
            session.guildId,
            options?.prompt
          )

          if (session.guildId && session.messageId) {
            return h.quote(session.messageId) + translatedText
          }

          return translatedText
        } catch (error: any) {
          return `翻译时出错: ${error.message}`
        }
      })

    // ai-config 命令
    this.ctx.command('ai-config', '配置AI功能', { authority: 3 })
      .option('enabled', '-e <enabled:boolean> 是否在本群启用AI功能')
      .option('prompt', '-p <prompt:text> 设置本群特定的系统提示词')
      .option('tprompt', '-tp <prompt:text> 设置本群特定的翻译提示词')
      .option('reset', '-r 重置为全局配置')
      .action(async ({ session, options }) => {
        if (!session?.guildId) {
          return '此命令只能在群聊中使用'
        }

        const groupConfigs = this.data.groupConfig.getAll()
        groupConfigs[session.guildId] = groupConfigs[session.guildId] || {}

        if (options?.reset) {
          if (groupConfigs[session.guildId].openai) {
            delete groupConfigs[session.guildId].openai
            this.data.groupConfig.setAll(groupConfigs)
            this.log(session, 'ai-config', 'reset', '成功')
            return '已重置为全局AI配置'
          }
          return '本群未设置特定AI配置'
        }

        // 确保openai配置存在
        if (!groupConfigs[session.guildId].openai) {
          groupConfigs[session.guildId].openai = { enabled: true }
        }

        let hasChanges = false

        if (options?.enabled !== undefined) {
          groupConfigs[session.guildId].openai!.enabled = options.enabled
          hasChanges = true
        }

        if (options?.prompt) {
          groupConfigs[session.guildId].openai!.systemPrompt = options.prompt
          hasChanges = true
        }

        if (options?.tprompt) {
          groupConfigs[session.guildId].openai!.translatePrompt = options.tprompt
          hasChanges = true
        }

        if (hasChanges) {
          this.data.groupConfig.setAll(groupConfigs)
          this.log(session, 'ai-config', 'update', '成功')
          return '群AI配置已更新'
        }

        // 显示当前配置
        const openaiConfig = groupConfigs[session.guildId].openai
        return [
          '当前群AI配置：',
          `AI总开关: ${openaiConfig?.enabled === undefined ? '跟随全局' : (openaiConfig.enabled ? '启用' : '禁用')}`,
          `系统提示词: ${openaiConfig?.systemPrompt || '跟随全局'}`,
          `翻译提示词: ${openaiConfig?.translatePrompt || '跟随全局'}`
        ].join('\n')
      })
  }

  /**
   * 注册中间件 - @机器人触发AI对话
   */
  private registerMiddleware(): void {
    this.ctx.middleware(async (session, next) => {
      // 检查是否@了机器人
      if (!session.elements?.some(el => el.type === 'at' && el.attrs?.id === session.selfId) ||
          session.content?.startsWith('/')) {
        return next()
      }

      // 检查功能是否启用
      if (!this.config.openai?.enabled) {
        return next()
      }

      try {
        // 移除@提及
        const content = session.content
          ?.replace(new RegExp(`<at id="${session.selfId}"/>`, 'g'), '')
          .replace(new RegExp(`@${session.selfId}`, 'g'), '')
          .trim()

        if (!content) {
          return next()
        }

        const response = await this.processMessage(session.userId, content, session.guildId)

        return `${h.quote(session.messageId)}${h.at(session.userId)} ${response}`
      } catch (error) {
        this.data.writeLog(`[ai] AI中间件处理失败: ${error}`)
        return next()
      }
    })
  }
}