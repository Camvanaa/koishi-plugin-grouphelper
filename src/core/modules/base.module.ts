/**
 * 模块基类
 * 所有功能模块都应继承此类
 */
import { Argv, Command, Context, Session } from 'koishi'
import type { DataManager } from '../data'
import type { Config } from '../../types'

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
    protected config: Config
  ) {}

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
    
    // 创建 Koishi 命令
    const command = this.ctx.command(cmdDef, def.desc)
    
    // 添加权限检查中间件（除非跳过）
    if (!def.skipAuth) {
      command.before(async ({ session }) => {
        if (!session) return
        
        // 使用 AuthService 检查权限
        if (!this.ctx.groupHelper.auth.check(session, permId)) {
          return '你没有权限执行此操作喵...'
        }
      })
    }
    
    return command
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

  protected logCommand(session: any, command: string, target: string, result: string, success?: boolean): void {
    // 使用 BaseModule 的 log 方法
    this.log(session, command, target, result, success)
  }
  
}