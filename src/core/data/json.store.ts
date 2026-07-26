/**
 * 通用 JSON 数据存储类
 * 提供延迟保存、原子写入、备份等功能
 */
import * as fs from 'fs'
import * as path from 'path'

export interface JsonStoreOptions {
  /** 延迟保存时间（毫秒），默认 1000ms */
  saveDelay?: number
  /** 距首次变脏最多拖延多久必须落盘（毫秒），默认 5000ms */
  maxSaveDelay?: number
  /** 是否创建备份，默认 true */
  createBackup?: boolean
  /** 最大备份数量，默认 3 */
  maxBackups?: number
  /** 两次备份的最小间隔（毫秒），默认 1 小时 */
  backupInterval?: number
}

export class JsonDataStore<T extends Record<string, unknown> = Record<string, unknown>> {
  private data: T
  private saveTimer: NodeJS.Timeout | null = null
  private dirty = false
  /** 本轮脏数据的起始时间，用于给 debounce 加上最长等待时间 */
  private firstDirtyAt = 0
  private lastBackupAt = 0
  /**
   * 源文件解析失败时置位。此时内存里是默认值而非真实数据，
   * 继续落盘会用空数据覆盖用户的原始文件，因此一律拒绝写入。
   */
  private readOnly = false
  /**
   * 已释放。插件重载后旧实例可能仍被残留的定时器或闭包持有，
   * 此时再写入会与新实例的内存快照互相覆盖同一个文件。
   */
  private disposed = false
  private readonly options: Required<JsonStoreOptions>

  constructor(
    private readonly filePath: string,
    private readonly defaultValue: T,
    options: JsonStoreOptions = {}
  ) {
    this.options = {
      saveDelay: options.saveDelay ?? 1000,
      maxSaveDelay: options.maxSaveDelay ?? 5000,
      createBackup: options.createBackup ?? true,
      maxBackups: options.maxBackups ?? 3,
      backupInterval: options.backupInterval ?? 60 * 60 * 1000
    }
    this.data = this.load()
  }

  /** 源文件损坏时为 true，此时本 store 拒绝一切写入 */
  get isReadOnly(): boolean {
    return this.readOnly
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
          const parsed = JSON.parse(content) as T
          // 文件已可正常解析（如用户修好了损坏文件后重载），解除只读
          this.readOnly = false
          return parsed
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

          // 解析失败：把原文件另存一份并转入只读，绝不能让后续 flush 用空数据覆盖它。
          // 备份只保留 3 份，若继续正常写入，几次 flush 后原始数据就会被彻底轮转掉。
          if (!this.readOnly) this.preserveCorruptFile()
          this.readOnly = true
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
   * 将无法解析的源文件改名保留，避免被后续写入覆盖。
   */
  private preserveCorruptFile(): void {
    try {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-')
      const corruptPath = `${this.filePath}.corrupt.${stamp}`
      fs.copyFileSync(this.filePath, corruptPath)
      console.error(
        `[JsonDataStore] 原始文件已保留为 ${corruptPath}；` +
        `修复后请改回 ${path.basename(this.filePath)} 并重启，期间该数据为只读。`
      )
    } catch (e) {
      console.error(`[JsonDataStore] 保留损坏文件失败: ${this.filePath}`, e)
    }
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
    // 先把挂起的改动写出去，否则重载会静默丢弃它们
    this.flush()
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
    if (this.disposed) {
      console.warn(`[JsonDataStore] 实例已释放，忽略写入: ${this.filePath}`)
      return
    }
    if (this.readOnly) {
      console.error(`[JsonDataStore] 源文件损坏，已拒绝写入: ${this.filePath}`)
      return
    }

    const now = Date.now()
    if (!this.dirty) this.firstDirtyAt = now
    this.dirty = true

    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
    }

    // 纯 debounce 会在持续写入时被无限推迟——高频写的 store（如缓存、命令日志）
    // 可能永远等不到那 1 秒的空档，数据一直滞留内存，进程退出即丢失。
    // 这里给等待时间设上限：距首次变脏超过 maxSaveDelay 就立即落盘。
    const elapsed = now - this.firstDirtyAt
    const delay = Math.max(0, Math.min(this.options.saveDelay, this.options.maxSaveDelay - elapsed))

    this.saveTimer = setTimeout(() => {
      this.flush()
    }, delay)
  }

  /**
   * 立即保存数据到文件
   */
  flush(): void {
    if (!this.dirty || this.readOnly) return

    try {
      // 创建备份（按间隔，不是每次落盘都全量复制一遍）
      if (
        this.options.createBackup &&
        Date.now() - this.lastBackupAt >= this.options.backupInterval &&
        fs.existsSync(this.filePath)
      ) {
        this.createBackup()
        this.lastBackupAt = Date.now()
      }

      // 原子写入：先写入临时文件，再重命名
      const tempPath = `${this.filePath}.tmp`
      const content = JSON.stringify(this.data, null, 2)
      fs.writeFileSync(tempPath, content, 'utf-8')
      fs.renameSync(tempPath, this.filePath)

      this.dirty = false
      this.firstDirtyAt = 0

      if (this.saveTimer) {
        clearTimeout(this.saveTimer)
        this.saveTimer = null
      }
    } catch (error) {
      // 保持 dirty 并重排定时器：否则写失败后既没人重试也没人告警，
      // 表现就是"界面提示保存成功、重启后改动消失"。
      console.error(`[JsonDataStore] 保存数据失败，将重试: ${this.filePath}`, error)
      if (this.saveTimer) clearTimeout(this.saveTimer)
      this.saveTimer = setTimeout(() => this.flush(), this.options.saveDelay)
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
    this.disposed = true
  }
}