/**
 * 设置管理器
 * 管理插件的所有配置，从 settings.json 加载配置
 * 替代原来的 Koishi Schema 配置
 */
import { JsonDataStore } from '../data/json.store'
import * as path from 'path'
import * as fs from 'fs'

import { Config as PluginSettings } from '../../types'
import { DEFAULT_REPORT_PROMPT, CONTEXT_REPORT_PROMPT } from '../prompts'

export type { PluginSettings }

/** 默认配置 - 从原 config/index.ts 提取 */
export const DEFAULT_SETTINGS: PluginSettings = {
  keywords: [],
  warnLimit: 3,
  banTimes: {
    expression: '{t}^2h'
  },
  forbidden: {
    autoDelete: false,
    autoBan: false,
    autoKick: false,
    muteDuration: 600000,
    keywords: []
  },
  dice: {
    enabled: true,
    lengthLimit: 1000
  },
  banme: {
    enabled: true,
    baseMin: 1,
    baseMax: 30,
    growthRate: 30,
    autoBan: false,
    jackpot: {
      enabled: true,
      baseProb: 0.006,
      softPity: 73,
      hardPity: 89,
      upDuration: '24h',
      loseDuration: '12h'
    }
  },
  friendRequest: {
    enabled: false,
    keywords: [],
    rejectMessage: '请输入正确的验证信息'
  },
  guildRequest: {
    enabled: false,
    manual: false,
    rejectMessage: '暂不接受入群邀请'
  },
  setEssenceMsg: {
    enabled: true,
    authority: 3
  },
  setTitle: {
    enabled: true,
    authority: 3,
    maxLength: 18
  },
  antiRepeat: {
    enabled: false,
    threshold: 3
  },
  openai: {
    enabled: false,
    chatEnabled: true,
    translateEnabled: true,
    apiKey: '',
    apiUrl: 'https://api.openai.com/v1',
    model: 'gpt-3.5-turbo',
    systemPrompt: '你是一个有帮助的AI助手，请简短、准确地回答问题。',
    translatePrompt: `你是一名多语翻译专家，擅长将内容地道自然地翻译成流畅。译文应忠实原意，语言表达符合习惯，不带翻译腔的母语级别，风格口吻贴合上下文场景。

翻译原则：

- 按文本类型调整语气风格：技术/文档用语严谨，论坛/评论风格口语
- 按需调整语序，使语言更符合表达逻辑
- 用词流畅，本地化表达，恰当使用成语、流行语等特色词语和句式

要求：
- 保持对话连贯和角色一致
- 准确传递语气和文化内涵

⚠️ 输出规范（绝对遵守）：仅输出译文，不添加任何说明、注释、标记或原文。

如果是中文则翻译为英文，如果是其他语言则翻译为中文。不要添加任何解释或额外内容。

待翻译的文本内容:`,
    maxTokens: 2048,
    temperature: 0.7,
    contextLimit: 10
  },
  report: {
    enabled: true,
    authority: 1,
    autoProcess: true,
    defaultPrompt: DEFAULT_REPORT_PROMPT,
    contextPrompt: CONTEXT_REPORT_PROMPT,
    maxReportTime: 30,
    guildConfigs: {},
    maxReportCooldown: 60,
    minAuthorityNoLimit: 2,
    autoRecall: true
  },
  antiRecall: {
    enabled: false,
    retentionDays: 7,
    maxRecordsPerUser: 50,
    showOriginalTime: true
  },
  status: {
    renderTimeout: 30000
  }
}

/**
 * 设置管理器类
 */
export class SettingsManager {
  private store: JsonDataStore<Partial<PluginSettings>>
  private _settings: PluginSettings
  private settingsPath: string
  private watcher: fs.FSWatcher | null = null
  private lastModified: number = 0
  private reloadTimeout: NodeJS.Timeout | null = null

  constructor(dataPath: string) {
    this.settingsPath = path.resolve(dataPath, 'settings.json')

    // 确保数据目录存在
    if (!fs.existsSync(dataPath)) {
      fs.mkdirSync(dataPath, { recursive: true })
    }

    this.store = new JsonDataStore(this.settingsPath, {})
    this._settings = this.loadSettings()

    // 启动文件监视器
    this.startWatcher()
  }

  /**
   * 启动文件监视器
   */
  private startWatcher(): void {
    try {
      // 记录初始修改时间
      if (fs.existsSync(this.settingsPath)) {
        this.lastModified = fs.statSync(this.settingsPath).mtimeMs
      }

      this.watcher = fs.watch(this.settingsPath, (eventType) => {
        if (eventType === 'change') {
          // 防抖：避免频繁重新加载
          if (this.reloadTimeout) {
            clearTimeout(this.reloadTimeout)
          }
          this.reloadTimeout = setTimeout(() => {
            this.checkAndReload()
          }, 100)
        }
      })
    } catch (e) {
      console.error('[SettingsManager] 启动文件监视器失败:', e)
    }
  }

  /**
   * 检查文件变化并重新加载
   */
  private checkAndReload(): void {
    try {
      if (!fs.existsSync(this.settingsPath)) return

      const stat = fs.statSync(this.settingsPath)
      // 只有当文件真正被修改时才重新加载
      if (stat.mtimeMs > this.lastModified) {
        this.lastModified = stat.mtimeMs
        // 重新加载 store 的数据
        this.store.reload()
        this._settings = this.loadSettings()
        console.log('[SettingsManager] 检测到配置文件变化，已重新加载')
      }
    } catch (e) {
      console.error('[SettingsManager] 重新加载配置失败:', e)
    }
  }

  /**
   * 加载设置，合并默认值
   */
  private loadSettings(): PluginSettings {
    const saved = this.store.getAll()
    return this.deepMerge(DEFAULT_SETTINGS, saved)
  }

  /**
   * 深度合并对象
   */
  private deepMerge<T extends Record<string, any>>(defaults: T, overrides: Partial<T>): T {
    const result = { ...defaults }

    for (const key of Object.keys(overrides) as Array<keyof T>) {
      // 跳过原型相关键：overrides 直接来自前端提交的 JSON，
      // 写入这些键改动的是原型链而不是普通属性
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue
      const value = overrides[key]
      if (value !== undefined) {
        if (
          typeof value === 'object' &&
          value !== null &&
          !Array.isArray(value) &&
          typeof defaults[key] === 'object' &&
          defaults[key] !== null &&
          !Array.isArray(defaults[key])
        ) {
          result[key] = this.deepMerge(defaults[key] as any, value as any)
        } else {
          result[key] = value as T[keyof T]
        }
      }
    }
    
    return result
  }

  /**
   * 获取所有设置
   */
  get settings(): PluginSettings {
    return this._settings
  }

  /**
   * 获取特定设置项
   */
  get<K extends keyof PluginSettings>(key: K): PluginSettings[K] {
    return this._settings[key]
  }

  /**
   * 更新设置
   */
  async update(updates: Partial<PluginSettings>): Promise<void> {
    // 更新内存中的设置
    this._settings = this.deepMerge(this._settings, updates)

    // 保存到文件（只保存与默认值不同的部分）
    const toSave = this.getDiff(DEFAULT_SETTINGS, this._settings)

    // 获取当前 store 中的所有键
    const currentKeys = Object.keys(this.store.getAll())
    const newKeys = Object.keys(toSave)

    // 删除不再需要的键（值恢复为默认值的情况）
    for (const key of currentKeys) {
      if (!newKeys.includes(key)) {
        this.store.delete(key as keyof PluginSettings)
      }
    }

    // 设置新值
    for (const key of Object.keys(toSave) as Array<keyof PluginSettings>) {
      this.store.set(key, (toSave as any)[key])
    }

    await this.store.flush()
  }

  /**
   * 获取与默认值的差异
   */
  private getDiff<T extends Record<string, any>>(defaults: T, current: T): Partial<T> {
    const diff: Partial<T> = {}
    
    for (const key of Object.keys(current) as Array<keyof T>) {
      const defaultValue = defaults[key]
      const currentValue = current[key]
      
      if (typeof currentValue === 'object' && currentValue !== null && !Array.isArray(currentValue)) {
        if (typeof defaultValue === 'object' && defaultValue !== null && !Array.isArray(defaultValue)) {
          const nestedDiff = this.getDiff(defaultValue, currentValue)
          if (Object.keys(nestedDiff).length > 0) {
            diff[key] = nestedDiff as any
          }
        } else {
          diff[key] = currentValue
        }
      } else if (Array.isArray(currentValue)) {
        if (!this.arraysEqual(currentValue, defaultValue as any[])) {
          diff[key] = currentValue
        }
      } else if (currentValue !== defaultValue) {
        diff[key] = currentValue
      }
    }
    
    return diff
  }

  /**
   * 比较数组是否相等
   */
  private arraysEqual(a: any[], b: any[]): boolean {
    if (!Array.isArray(b)) return false
    if (a.length !== b.length) return false
    return a.every((v, i) => v === b[i])
  }

  /**
   * 重置为默认设置
   */
  async reset(): Promise<void> {
    this._settings = { ...DEFAULT_SETTINGS }
    // 清空存储
    for (const key of Object.keys(this.store.getAll()) as Array<keyof PluginSettings>) {
      this.store.delete(key)
    }
    await this.store.flush()
  }

  /**
   * 释放资源
   */
  dispose(): void {
    // 关闭文件监视器
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }
    if (this.reloadTimeout) {
      clearTimeout(this.reloadTimeout)
      this.reloadTimeout = null
    }
    this.store.dispose()
  }
}