/**
 * GroupHelper 主服务
 * 使用 Koishi Service 模式注册为 ctx.groupHelper
 */
import { Context, Service } from 'koishi'
import { DataManager } from '../data'
import { BaseModule } from '../modules'
import { SettingsManager, PluginSettings } from '../settings'
import type { Subscription } from '../../types'

// 声明服务类型
declare module 'koishi' {
  interface Context {
    groupHelper: GroupHelperService
  }
}

export class GroupHelperService extends Service {
  static inject = ['database']

  /** 数据管理器 */
  private _data: DataManager
  /** 功能模块注册表 */
  private _modules: Map<string, BaseModule> = new Map()
  /** 设置管理器 */
  private _settingsManager: SettingsManager

  constructor(ctx: Context) {
    super(ctx, 'groupHelper')
    this._data = new DataManager(ctx)
    this._settingsManager = new SettingsManager(this._data.dataPath)
  }

  /** 获取数据管理器 */
  get data(): DataManager {
    return this._data
  }

  /** 获取设置管理器 */
  get settings(): SettingsManager {
    return this._settingsManager
  }

  /** 获取插件配置（兼容旧代码） */
  get pluginConfig(): PluginSettings {
    return this._settingsManager.settings
  }

  /**
   * 注册模块
   */
  registerModule(module: BaseModule): void {
    const name = module.meta.name
    if (this._modules.has(name)) {
      console.warn(`[GroupHelper] 模块 ${name} 已存在，将被覆盖`)
    }
    this._modules.set(name, module)
    console.log(`[GroupHelper] 注册模块: ${name}`)
  }

  /**
   * 获取模块
   */
  getModule<T extends BaseModule>(name: string): T | undefined {
    return this._modules.get(name) as T | undefined
  }

  /**
   * 获取所有模块
   */
  getAllModules(): BaseModule[] {
    return Array.from(this._modules.values())
  }

  /**
   * 初始化所有模块
   */
  async initModules(): Promise<void> {
    for (const [name, module] of this._modules) {
      try {
        await module.init()
        console.log(`[GroupHelper] 模块 ${name} 初始化完成`)
      } catch (error) {
        console.error(`[GroupHelper] 模块 ${name} 初始化失败:`, error)
      }
    }
  }

  /**
   * 获取订阅列表
   */
  getSubscriptions(): Subscription[] {
    return this._data.subscriptions.get('list') || []
  }

  /**
   * 添加订阅
   */
  addSubscription(subscription: Subscription): void {
    const list = this.getSubscriptions()
    const exists = list.find(
      s => s.type === subscription.type && s.id === subscription.id
    )
    if (!exists) {
      list.push(subscription)
      this._data.subscriptions.set('list', list)
    }
  }

  /**
   * 移除订阅
   */
  removeSubscription(type: string, id: string): boolean {
    const list = this.getSubscriptions()
    const index = list.findIndex(s => s.type === type && s.id === id)
    if (index !== -1) {
      list.splice(index, 1)
      this._data.subscriptions.set('list', list)
      return true
    }
    return false
  }

  /**
   * 向订阅者推送消息
   */
  async pushMessage(
    bot: any,
    message: string,
    feature: keyof Subscription['features']
  ): Promise<void> {
    const subscriptions = this.getSubscriptions()
    for (const sub of subscriptions) {
      try {
        if (!sub.features) continue
        if (sub.features[feature]) {
          if (sub.type === 'group') {
            await bot.sendMessage(sub.id, message)
          } else {
            await bot.sendPrivateMessage(sub.id, message)
          }
        }
      } catch (e) {
        console.error(`[GroupHelper] 推送消息失败: ${e.message}`)
      }
    }
  }

  /**
   * 记录命令日志
   */
  async logCommand(
    session: any,
    command: string,
    target: string,
    result: string
  ): Promise<void> {
    const user = session.userId || session.username
    const group = session.guildId || 'private'
    this._data.writeLog(`[${command}] 用户(${user}) 群(${group}) 目标(${target}): ${result}`)

    // 推送日志消息
    await this.pushMessage(session.bot, `[${command}] 用户(${user}) 群(${group}) 目标(${target}): ${result}`, 'log')
  }

  /**
   * 服务停止时调用
   */
  protected stop(): void {
    // 销毁所有模块
    for (const [name, module] of this._modules) {
      try {
        module.dispose()
        console.log(`[GroupHelper] 模块 ${name} 已销毁`)
      } catch (error) {
        console.error(`[GroupHelper] 模块 ${name} 销毁失败:`, error)
      }
    }
    this._modules.clear()

    // 释放数据管理器
    this._data.dispose()
    this._settingsManager.dispose()
  }
}