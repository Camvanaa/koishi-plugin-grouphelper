/**
 * 通用 JSON 数据存储类
 * 提供延迟保存、原子写入、备份等功能
 */
import * as fs from 'fs'
import * as path from 'path'

export interface JsonStoreOptions {
  /** 延迟保存时间（毫秒），默认 1000ms */
  saveDelay?: number
  /** 是否创建备份，默认 true */
  createBackup?: boolean
  /** 最大备份数量，默认 3 */
  maxBackups?: number
}

export class JsonDataStore<T extends Record<string, unknown> = Record<string, unknown>> {
  private data: T
  private saveTimer: NodeJS.Timeout | null = null
  private dirty = false
  private readonly options: Required<JsonStoreOptions>

  constructor(
    private readonly filePath: string,
    private readonly defaultValue: T,
    options: JsonStoreOptions = {}
  ) {
    this.options = {
      saveDelay: options.saveDelay ?? 1000,
      createBackup: options.createBackup ?? true,
      maxBackups: options.maxBackups ?? 3
    }
    this.data = this.load()
  }

  /**
   * 加载数据
   */
  private load(): T {
    try {
      // 确保目录存在
      const dir = path.dirname(this.filePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf-8')
        try {
          return JSON.parse(content) as T
        } catch (parseError) {
          // 详细的 JSON 解析错误信息
          const err = parseError as SyntaxError
          console.error(`[JsonDataStore] JSON 解析失败: ${this.filePath}`)
          console.error(`  错误信息: ${err.message}`)
          // 尝试找到错误位置
          const match = err.message.match(/position (\d+)/)
          if (match) {
            const pos = parseInt(match[1])
            const before = content.substring(Math.max(0, pos - 50), pos)
            const after = content.substring(pos, pos + 50)
            console.error(`  错误位置附近: ...${before}【错误在此】${after}...`)
          }
          // 提示可能的常见错误
          if (content.includes(',]') || content.includes(',}')) {
            console.error(`  提示: 可能存在尾随逗号 (trailing comma)，JSON 不允许在数组/对象最后一个元素后加逗号`)
          }
          throw parseError
        }
      }
    } catch (error) {
      console.error(`[JsonDataStore] 加载数据失败: ${this.filePath}`, error)
    }

    // 返回默认值的深拷贝
    return JSON.parse(JSON.stringify(this.defaultValue))
  }

  /**
   * 获取所有数据
   */
  getAll(): T {
    return this.data
  }

  /**
   * 重新从文件加载数据
   */
  reload(): void {
    this.data = this.load()
    console.log(`[JsonDataStore] 重新加载: ${this.filePath}, 数据条目: ${Object.keys(this.data).length}`)
  }

  /**
   * 设置所有数据
   */
  setAll(data: T): void {
    this.data = data
    this.markDirty()
  }

  /**
   * 获取指定键的数据（适用于对象类型）
   */
  get<K extends keyof T>(key: K): T[K] | undefined {
    return this.data[key]
  }

  /**
   * 设置指定键的数据（适用于对象类型）
   */
  set<K extends keyof T>(key: K, value: T[K]): void {
    this.data[key] = value
    this.markDirty()
  }

  /**
   * 删除指定键的数据（适用于对象类型）
   */
  delete<K extends keyof T>(key: K): boolean {
    if (key in this.data) {
      delete this.data[key]
      this.markDirty()
      return true
    }
    return false
  }

  /**
   * 检查键是否存在
   */
  has<K extends keyof T>(key: K): boolean {
    return key in this.data
  }

  /**
   * 更新数据（合并）
   */
  update(partial: Partial<T>): void {
    this.data = { ...this.data, ...partial }
    this.markDirty()
  }

  /**
   * 标记数据已修改，启动延迟保存
   */
  private markDirty(): void {
    this.dirty = true

    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
    }

    this.saveTimer = setTimeout(() => {
      this.flush()
    }, this.options.saveDelay)
  }

  /**
   * 立即保存数据到文件
   */
  flush(): void {
    if (!this.dirty) return

    try {
      // 创建备份
      if (this.options.createBackup && fs.existsSync(this.filePath)) {
        this.createBackup()
      }

      // 原子写入：先写入临时文件，再重命名
      const tempPath = `${this.filePath}.tmp`
      const content = JSON.stringify(this.data, null, 2)
      fs.writeFileSync(tempPath, content, 'utf-8')
      fs.renameSync(tempPath, this.filePath)

      this.dirty = false

      if (this.saveTimer) {
        clearTimeout(this.saveTimer)
        this.saveTimer = null
      }
    } catch (error) {
      console.error(`[JsonDataStore] 保存数据失败: ${this.filePath}`, error)
    }
  }

  /**
   * 创建备份
   */
  private createBackup(): void {
    try {
      const dir = path.dirname(this.filePath)
      const basename = path.basename(this.filePath, '.json')
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const backupPath = path.join(dir, `${basename}.backup.${timestamp}.json`)

      fs.copyFileSync(this.filePath, backupPath)

      // 清理旧备份
      this.cleanOldBackups(dir, basename)
    } catch (error) {
      console.error(`[JsonDataStore] 创建备份失败: ${this.filePath}`, error)
    }
  }

  /**
   * 清理旧备份
   */
  private cleanOldBackups(dir: string, basename: string): void {
    try {
      const pattern = new RegExp(`^${basename}\\.backup\\..+\\.json$`)
      const backups = fs.readdirSync(dir)
        .filter(file => pattern.test(file))
        .map(file => ({
          name: file,
          path: path.join(dir, file),
          time: fs.statSync(path.join(dir, file)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time)

      // 删除超出数量限制的备份
      for (let i = this.options.maxBackups; i < backups.length; i++) {
        fs.unlinkSync(backups[i].path)
      }
    } catch (error) {
      console.error(`[JsonDataStore] 清理备份失败`, error)
    }
  }

  /**
   * 释放资源
   */
  dispose(): void {
    this.flush()
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
    }
  }
}