/**
 * 模块基类
 * 所有功能模块都应继承此类
 */
import { Argv, Command, Context, Session } from 'koishi'
import type { DataManager } from '../data'
import type { Config } from '../../types'
import { renderReply } from '../i18n/replies'

/** 模块元信息 */
export interface ModuleMeta {
  /** 模块名称 */
  name: string
  /** 模块描述 */
  description: string
  /** 模块版本 */
  version?: string
  /** 模块作者 */
  author?: string
}

/** 命令定义选项 */
export interface CommandDef {
  /** 命令名称（不包含模块前缀） */
  name: string
  /** 命令描述 */
  desc: string
  /** 参数定义（如 '<user:user> [count:number]'）*/
  args?: string
  /** 权限节点名称（默认使用命令名） */
  permNode?: string
  /** 权限节点描述（默认使用命令描述） */
  permDesc?: string
  /** 跳过权限检查（默认 false） */
  skipAuth?: boolean
  /** 使用方法说明（用于动态生成帮助） */
  usage?: string
  /** 命令示例 */
  examples?: string[]
}

/** 模块状态 */
export type ModuleState = 'unloaded' | 'loading' | 'loaded' | 'error'

export abstract class BaseModule {
  /** 模块元信息 */
  abstract readonly meta: ModuleMeta
  /** 模块状态 */
  protected _state: ModuleState = 'unloaded'
  /** 错误信息 */
  protected _error: Error | null = null

  constructor(
    protected ctx: Context,
    protected data: DataManager,
    private _config: Config  // 改为私有，通过 getter 访问
  ) {}

  /**
   * 获取配置（动态获取，支持实时更新）
   * 模块应通过此 getter 访问配置，而非直接使用 _config
   */
  protected get config(): Config {
    // 优先从 groupHelper 服务获取最新配置
    // 这样当 UI 保存设置后，模块可以立即看到更新
    try {
      if (this.ctx.groupHelper?.pluginConfig) {
        return this.ctx.groupHelper.pluginConfig
      }
    } catch {
      // 服务未就绪时使用构造函数传入的配置
    }
    return this._config
  }

  protected reply(key: string, variables?: Record<string, unknown>): string {
    return renderReply(this.config.replies, key, variables)
  }

  /** 获取模块状态 */
  get state(): ModuleState {
    return this._state
  }

  /** 获取错误信息 */
  get error(): Error | null {
    return this._error
  }

  /**
   * 初始化模块
   * 子类应重写此方法来注册命令、中间件等
   */
  async init(): Promise<void> {
    this._state = 'loading'
    try {
      await this.onInit()
      this._state = 'loaded'
    } catch (error) {
      this._state = 'error'
      this._error = error as Error
      console.error(`[${this.meta.name}] 初始化失败:`, error)
      throw error
    }
  }

  /**
   * 子类实现的初始化逻辑
   */
  protected abstract onInit(): Promise<void>

  /**
   * 销毁模块
   */
  async dispose(): Promise<void> {
    try {
      await this.onDispose()
    } catch (error) {
      console.error(`[${this.meta.name}] 销毁失败:`, error)
    }
    this._state = 'unloaded'
  }

  /**
   * 子类实现的销毁逻辑
   */
  protected async onDispose(): Promise<void> {
    // 默认空实现，子类可重写
  }

  /**
   * 获取群配置
   */
  protected getGroupConfig(guildId: string) {
    return this.data.groupConfig.get(guildId)
  }

  /**
   * 记录日志并推送订阅
   */
  protected async log(session: Session, command: string, target: string, result: string, success?:boolean): Promise<void> {
    if(success === false){
      session['_commandFailed'] = true
    }
    await this.ctx.groupHelper.logCommand(session, command, target, result)
  }

  /**
   * 注册命令并自动绑定权限节点
   * @param def 命令定义
   * @returns Koishi Command 对象，可继续链式调用
   *
   * 权限节点命名规则：{模块名}.{命令名}
   * 例如：warn 模块的 add 命令 → warn.add
   */
  protected registerCommand(def: CommandDef): Command {
    const moduleName = this.meta.name
    const cmdName = def.name
    const cmdDef = def.args ? `${cmdName} ${def.args}` : cmdName

    // 生成权限节点ID
    const permNode = def.permNode || cmdName.replace(/\./g, '-')
    const permId = `${moduleName}.${permNode}`
    const permName = def.desc
    const permDesc = def.permDesc || def.desc

    // 在 AuthService 中注册权限节点
    if (!def.skipAuth) {
      this.ctx.groupHelper.auth.registerPermission(
        permId,
        permName,
        permDesc,
        this.meta.description // 使用模块描述作为分组
      )
    }

    // 注册命令信息（用于动态生成帮助）
    this.ctx.groupHelper.auth.registerCommand({
      name: cmdName,
      desc: def.desc,
      args: def.args,
      usage: def.usage,
      examples: def.examples,
      module: moduleName,
      moduleDesc: this.meta.description,
      permId: def.skipAuth ? undefined : permId,
      skipAuth: def.skipAuth
    })

    // 创建 Koishi 命令
    const command = this.ctx.command(cmdDef, def.desc)

    // 添加权限检查中间件（除非跳过）
    if (!def.skipAuth) {
      command.before(async ({ session }) => {
        if (!session) return

        // 使用 AuthService 检查权限
        if (!this.ctx.groupHelper.auth.check(session, permId)) {
          return this.reply('auth.noPermission')
        }
      })
    }

    return command
  }

  /**
   * 校验当前用户能否对目标群执行本模块的某个命令。
   *
   * 供接受群号参数的命令使用。registerCommand 的 before 钩子只按当前会话群
   * 判断"有无权限"，一旦命令允许显式传别的群号，就必须再过一次作用域校验，
   * 否则在自己有权限的群里即可对机器人所在的任意群下手。
   *
   * @returns 通过返回 null，未通过返回可直接回复用户的提示语
   */
  protected checkGuildScope(session: Session, cmdName: string, targetGuildId: string): string | null {
    if (!targetGuildId) return this.reply('common.noGuildId')

    // 与 registerCommand 一致的节点命名规则
    const permId = `${this.meta.name}.${cmdName.replace(/\./g, '-')}`
    if (this.ctx.groupHelper.auth.canActOnGuild(session, permId, targetGuildId)) return null

    return this.reply('auth.noGuildScope', { guildId: targetGuildId })
  }

  /**
   * 注册权限节点（不绑定命令）
   * 用于注册非命令类权限，如 WebUI 操作权限
   */
  protected registerPermission(id: string, name: string, description: string): void {
    const permId = `${this.meta.name}.${id}`
    this.ctx.groupHelper.auth.registerPermission(
      permId,
      name,
      description,
      this.meta.description
    )
  }

  /**
   * 记录一条操作日志。
   *
   * 保持同步签名：绝大多数调用点在命令 action 里即用即走，不应为写日志阻塞回复。
   * 但底层 log 是异步的，必须在这里兜住 rejection——服务销毁窗口期的写入失败
   * 否则会变成 unhandledRejection。
   */
  protected logCommand(session: any, command: string, target: string, result: string, success?: boolean): void {
    this.log(session, command, target, result, success).catch(err => {
      this.ctx.logger('grouphelper').warn('记录操作日志失败:', err)
    })
  }

  /**
   * 把操作异常整理成可记录 / 可回显的原因说明。
   *
   * 统一各命令的错误反馈：不再把异常吞成“未知错误”，日志与回复都带上协议端返回的
   * 真实报错，并对几类常见失败给出排查方向。
   *
   * @returns reason 真实错误文本；hint 追加在回复末尾的排查提示（无匹配时为空串）
   */
  protected explainError(e: any): { reason: string; hint: string } {
    const reason = e?.message || String(e) || '未知错误'
    let hint = ''
    if (/权限|permission|admin|owner|管理员|群主/i.test(reason)) {
      hint = '\n可能原因：机器人权限不足（非管理员，或目标是群主/管理员）。'
    } else if (/not\s*(found|exist|member)|不存在|不在群|no\s*such/i.test(reason)) {
      hint = '\n可能原因：目标可能已不在群里。'
    } else if (/timeout|超时|ECONN|socket|econnrefused/i.test(reason)) {
      hint = '\n可能原因：与协议端（NapCat）连接异常或超时，检查机器人在线状态。'
    }
    return { reason, hint }
  }

}
