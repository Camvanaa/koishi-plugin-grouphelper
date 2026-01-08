/**
 * 数据服务管理器
 * 统一管理所有 JSON 数据存储实例
 */
import * as fs from 'fs'
import * as path from 'path'
import { Context } from 'koishi'
import { createWriteStream, WriteStream } from 'fs'
import { JsonDataStore } from './json.store'
import type {
  GroupConfig,
  WarnRecord,
  BlacklistRecord,
  MuteRecord,
  BanMeRecord,
  LockedName,
  AntiRepeatConfig,
  Subscription,
  RecallRecord,
  CommandLogData,
  LeaveRecord,
  AuthRolesData,
  AuthUsersData
} from '../../types'

/** 数据存储映射类型 */
export interface DataStores {
  warns: JsonDataStore<Record<string, WarnRecord>>
  blacklist: JsonDataStore<Record<string, BlacklistRecord>>
  groupConfig: JsonDataStore<Record<string, GroupConfig>>
  mutes: JsonDataStore<Record<string, Record<string, MuteRecord>>>
  banmeRecords: JsonDataStore<Record<string, BanMeRecord>>
  lockedNames: JsonDataStore<Record<string, LockedName>>
  antiRepeat: JsonDataStore<Record<string, AntiRepeatConfig>>
  subscriptions: JsonDataStore<{ list: Subscription[] }>
  recallRecords: JsonDataStore<RecallRecord>
  commandLogs: JsonDataStore<CommandLogData>
  leaveRecords: JsonDataStore<Record<string, LeaveRecord>>
  authRoles: JsonDataStore<AuthRolesData>
  authUsers: JsonDataStore<AuthUsersData>
}

export class DataManager {
  /** 数据目录路径 */
  readonly dataPath: string
  /** 日志文件路径 */
  readonly logPath: string
  /** 日志写入流 */
  private logStream: WriteStream | null = null
  /** 数据存储实例 */
  private stores: Partial<DataStores> = {}

  constructor(private ctx: Context) {
    this.dataPath = path.resolve(ctx.baseDir, 'data/grouphelper')
    this.logPath = path.resolve(this.dataPath, 'grouphelper.log')
    this.init()
  }

  /**
   * 初始化数据服务
   */
  private init(): void {
    // 确保数据目录存在
    if (!fs.existsSync(this.dataPath)) {
      fs.mkdirSync(this.dataPath, { recursive: true })
    }

    // 初始化日志流
    this.logStream = createWriteStream(this.logPath, { flags: 'a' })
  }

  /**
   * 获取警告记录存储
   */
  get warns(): JsonDataStore<Record<string, WarnRecord>> {
    if (!this.stores.warns) {
      this.stores.warns = new JsonDataStore(
        path.resolve(this.dataPath, 'warns.json'),
        {}
      )
    }
    return this.stores.warns
  }

  /**
   * 获取黑名单存储
   */
  get blacklist(): JsonDataStore<Record<string, BlacklistRecord>> {
    if (!this.stores.blacklist) {
      this.stores.blacklist = new JsonDataStore(
        path.resolve(this.dataPath, 'blacklist.json'),
        {}
      )
    }
    return this.stores.blacklist
  }

  /**
   * 获取群配置存储
   */
  get groupConfig(): JsonDataStore<Record<string, GroupConfig>> {
    if (!this.stores.groupConfig) {
      this.stores.groupConfig = new JsonDataStore(
        path.resolve(this.dataPath, 'group_config.json'),
        {}
      )
    }
    return this.stores.groupConfig
  }

  /**
   * 获取禁言记录存储
   */
  get mutes(): JsonDataStore<Record<string, Record<string, MuteRecord>>> {
    if (!this.stores.mutes) {
      this.stores.mutes = new JsonDataStore(
        path.resolve(this.dataPath, 'mutes.json'),
        {}
      )
    }
    return this.stores.mutes
  }

  /**
   * 获取 BanMe 记录存储
   */
  get banmeRecords(): JsonDataStore<Record<string, BanMeRecord>> {
    if (!this.stores.banmeRecords) {
      this.stores.banmeRecords = new JsonDataStore(
        path.resolve(this.dataPath, 'banme_records.json'),
        {}
      )
    }
    return this.stores.banmeRecords
  }

  /**
   * 获取锁定名称存储
   */
  get lockedNames(): JsonDataStore<Record<string, LockedName>> {
    if (!this.stores.lockedNames) {
      this.stores.lockedNames = new JsonDataStore(
        path.resolve(this.dataPath, 'locked_names.json'),
        {}
      )
    }
    return this.stores.lockedNames
  }

  /**
   * 获取反复读配置存储
   */
  get antiRepeat(): JsonDataStore<Record<string, AntiRepeatConfig>> {
    if (!this.stores.antiRepeat) {
      this.stores.antiRepeat = new JsonDataStore(
        path.resolve(this.dataPath, 'antirepeat.json'),
        {}
      )
    }
    return this.stores.antiRepeat
  }

  /**
   * 获取订阅配置存储
   */
  get subscriptions(): JsonDataStore<{ list: Subscription[] }> {
    if (!this.stores.subscriptions) {
      this.stores.subscriptions = new JsonDataStore(
        path.resolve(this.dataPath, 'subscriptions.json'),
        { list: [] }
      )
    }
    return this.stores.subscriptions
  }

  /**
   * 获取撤回记录存储
   */
  get recallRecords(): JsonDataStore<RecallRecord> {
    if (!this.stores.recallRecords) {
      this.stores.recallRecords = new JsonDataStore(
        path.resolve(this.dataPath, 'recall_records.json'),
        {}
      )
    }
    return this.stores.recallRecords
  }

  /**
   * 获取命令日志存储
   */
  get commandLogs(): JsonDataStore<CommandLogData> {
    if (!this.stores.commandLogs) {
      this.stores.commandLogs = new JsonDataStore(
        path.resolve(this.dataPath, 'command_logs.json'),
        { logs: [] }
      )
    }
    return this.stores.commandLogs
  }

  /**
   * 获取退群冷却记录存储
   */
  get leaveRecords(): JsonDataStore<Record<string, LeaveRecord>> {
    if (!this.stores.leaveRecords) {
      this.stores.leaveRecords = new JsonDataStore(
        path.resolve(this.dataPath, 'leave_records.json'),
        {}
      )
    }
    return this.stores.leaveRecords
  }

  /**
   * 获取角色存储
   */
  get authRoles(): JsonDataStore<AuthRolesData> {
    if (!this.stores.authRoles) {
      this.stores.authRoles = new JsonDataStore(
        path.resolve(this.dataPath, 'auth_roles.json'),
        { roles: {}, defaultLevels: {} }
      )
    }
    return this.stores.authRoles
  }

  /**
   * 获取用户角色关联存储
   */
  get authUsers(): JsonDataStore<AuthUsersData> {
    if (!this.stores.authUsers) {
      this.stores.authUsers = new JsonDataStore(
        path.resolve(this.dataPath, 'auth_users.json'),
        { users: {} }
      )
    }
    return this.stores.authUsers
  }


  /**
   * 写入日志
   */
  writeLog(message: string): void {
    if (this.logStream) {
      const date = new Date()
      date.setHours(date.getHours() + 8)
      const time = date.toISOString()
        .replace('T', ' ')
        .replace('Z', '')
        .slice(0, 16)
      const logLine = `[${time}] ${message}\n`
      this.logStream.write(logLine)
      console.log(logLine.trim())
    }
  }

  /**
   * 刷新所有存储
   */
  flushAll(): void {
    for (const store of Object.values(this.stores)) {
      if (store) {
        store.flush()
      }
    }
  }

  /**
   * 释放资源
   */
  dispose(): void {
    // 刷新并关闭所有存储
    for (const store of Object.values(this.stores)) {
      if (store) {
        store.dispose()
      }
    }
    this.stores = {}

    // 关闭日志流
    if (this.logStream) {
      this.logStream.end()
      this.logStream = null
    }
  }
}