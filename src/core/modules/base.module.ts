/**
 * 模块基类
 * 所有功能模块都应继承此类
 */
import { Context, Session } from 'koishi'
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
   * 记录日志
   */
  protected log(session: Session, command: string, target: string, result: string): void {
    const user = session.userId || session.username
    const group = session.guildId || 'private'
    this.data.writeLog(`[${command}] 用户(${user}) 群(${group}) 目标(${target}): ${result}`)
  }
}