# GroupHelper 插件重构设计文档

> 参考 media-luna 插件架构，为 grouphelper 设计更优雅的架构和 WebUI 支持。

## 1. 概述

GroupHelper 是一个 Koishi 框架的群管理插件，提供警告系统、关键词管理、欢迎消息、复读机、反撤回、骰子游戏、AI 对话等功能。

本文档旨在重新设计插件架构，解决当前设计中的问题，并添加 WebUI 管理界面支持。

## 2. 当前问题分析

### 2.1 架构问题

| 问题 | 描述 | 影响 |
|------|------|------|
| 服务实例化分散 | 服务在 `apply()` 函数中直接 `new`，没有依赖注入 | 难以测试、难以扩展 |
| 文件存储 | 使用 JSON 文件存储数据（warns.json、blacklist.json 等） | 性能差、不支持事务、难以查询 |
| 配置项过于复杂 | Config Schema 约 281 行，嵌套过深 | 用户配置困难 |
| 命令注册分散 | 16+ 个命令文件，各自独立注册 | 难以统一管理和权限控制 |
| 缺少统一 API | 没有 `ctx.groupHelper` 服务模式 | 其他插件难以集成 |
| 无 WebUI | 所有配置通过命令或 YAML 修改 | 用户体验差 |

### 2.2 代码结构问题

```
当前结构:
src/
├── index.ts              # 入口，所有命令注册
├── config/index.ts       # 配置定义（过于复杂）
├── types/index.ts        # 类型定义
├── commands/             # 16+ 命令文件
│   ├── basic.ts
│   ├── warn.ts
│   ├── keyword.ts
│   └── ...
├── services/             # 服务（但无统一注册）
│   ├── data.service.ts
│   ├── ai.service.ts
│   └── ...
└── utils/index.ts
```

**问题：**
- 服务之间依赖关系不清晰
- 命令和服务耦合过紧
- 缺少核心抽象层

### 2.3 数据存储现状

当前使用 JSON 文件存储：
- `warns.json` - 警告记录
- `blacklist.json` - 黑名单
- `group_config.json` - 群配置
- `mutes.json` - 禁言记录
- `recall_records.json` - 撤回记录
- `command_logs.json` - 命令日志

**优点：**
- 便于数据迁移和备份
- 人类可读，易于手动编辑
- 不依赖外部数据库
- 适合中小规模群组管理

**待优化：**
- 需要统一的数据访问层
- 需要更好的缓存机制
- 需要文件锁定防止并发写入

## 3. 设计目标

### 3.1 核心目标

1. **服务化架构** - 使用 `ctx.groupHelper` 统一 API
2. **优化数据层** - 保留 JSON 存储，增强数据服务层
3. **模块化设计** - 功能模块可独立启用/禁用
4. **WebUI 支持** - 可视化配置和管理界面
5. **事件驱动** - 统一的事件系统

### 3.2 设计原则
- **关注点分离** - 命令、服务、数据层分离
- **依赖注入** - 服务通过 Koishi 插件系统管理
- **配置简化** - 分层配置，合理默认值
- **可扩展性** - 支持第三方模块扩展

## 4. 新架构设计

### 4.1 目录结构

```
src/
├── index.ts                    # 插件入口
├── config.ts                   # 简化的配置定义
├── types.ts                    # 类型定义
│
├── core/                       # 核心层
│   ├── index.ts                # 核心导出
│   ├── types.ts                # 核心类型
│   │
│   ├── services/               # 核心服务
│   │   ├── index.ts
│   │   ├── grouphelper.service.ts   # 主服务（ctx.groupHelper）
│   │   ├── group.service.ts         # 群组服务
│   │   ├── member.service.ts        # 成员服务
│   │   └── log.service.ts           # 日志服务
│   │
│   ├── modules/                # 功能模块
│   │   ├── index.ts
│   │   ├── base.module.ts           # 模块基类
│   │   ├── warn/                    # 警告模块
│   │   │   ├── index.ts
│   │   │   ├── warn.service.ts
│   │   │   └── warn.commands.ts
│   │   ├── keyword/                 # 关键词模块
│   │   │   ├── index.ts
│   │   │   ├── keyword.service.ts
│   │   │   └── keyword.commands.ts
│   │   ├── welcome/                 # 欢迎模块
│   │   │   ├── index.ts
│   │   │   ├── welcome.service.ts
│   │   │   └── welcome.commands.ts
│   │   ├── anti-recall/             # 反撤回模块
│   │   │   ├── index.ts
│   │   │   ├── anti-recall.service.ts
│   │   │   └── anti-recall.commands.ts
│   │   ├── repeat/                  # 复读机模块
│   │   │   ├── index.ts
│   │   │   ├── repeat.service.ts
│   │   │   └── repeat.commands.ts
│   │   ├── dice/                    # 骰子游戏模块
│   │   │   ├── index.ts
│   │   │   ├── dice.service.ts
│   │   │   └── dice.commands.ts
│   │   ├── ai/                      # AI 对话模块
│   │   │   ├── index.ts
│   │   │   ├── ai.service.ts
│   │   │   └── ai.commands.ts
│   │   └── banme/                   # 自助禁言模块
│   │       ├── index.ts
│   │       ├── banme.service.ts
│   │       └── banme.commands.ts
│   │
│   └── api/                    # WebSocket API
│       ├── index.ts
│       ├── group-api.ts
│       ├── member-api.ts
│       ├── warn-api.ts
│       ├── keyword-api.ts
│       └── log-api.ts
│
└── client/                     # 前端 WebUI
    ├── index.ts                # 前端入口
    ├── api.ts                  # API 调用封装
    ├── types.ts                # 前端类型
    │
    ├── pages/                  # 页面
    │   └── index.vue           # 主页面（Tab 容器）
    │
    ├── components/             # 组件
    │   ├── Dashboard.vue       # 仪表盘概览
    │   ├── GroupList.vue       # 群组列表
    │   ├── GroupConfig.vue     # 群配置编辑
    │   ├── MemberList.vue      # 成员列表
    │   ├── WarnManager.vue     # 警告管理
    │   ├── KeywordManager.vue  # 关键词管理
    │   ├── LogViewer.vue       # 日志查看器
    │   └── Settings.vue        # 全局设置
    │
    └── composables/            # Vue 组合式函数
        ├── index.ts
        ├── useGroups.ts
        └── useMembers.ts
```

### 4.2 服务层设计

#### 4.2.1 主服务 GroupHelperService

参考 media-luna 的 `MediaLunaService`，创建统一的服务入口：

```typescript
// src/core/services/grouphelper.service.ts

import { Context, Service } from 'koishi'

export class GroupHelperService extends Service {
  static inject = ['database']
  
  // 子服务
  private _groupService: GroupService
  private _memberService: MemberService
  private _logService: LogService
  
  // 功能模块
  private _modules: Map<string, BaseModule> = new Map()
  
  // 就绪状态
  private _ready = false
  private _readyPromise: Promise<void>
  private _readyResolve!: () => void

  constructor(ctx: Context) {
    super(ctx, 'groupHelper')
    
    this._readyPromise = new Promise(resolve => {
      this._readyResolve = resolve
    })
    
    // 初始化核心服务
    this._groupService = new GroupService(ctx)
    this._memberService = new MemberService(ctx)
    this._logService = new LogService(ctx)
    
    // 异步初始化
    ctx.on('ready', () => this._initialize())
  }
  
  private async _initialize(): Promise<void> {
    // 加载所有模块
    await this._loadModules()
    
    this._ready = true
    this._readyResolve()
    this.ctx.emit('group-helper/ready' as any)
  }
  
  // ========== 公共 API ==========
  
  get groups(): GroupService { return this._groupService }
  get members(): MemberService { return this._memberService }
  get logs(): LogService { return this._logService }
  
  /** 获取模块 */
  getModule<T extends BaseModule>(name: string): T | undefined {
    return this._modules.get(name) as T
  }
  
  /** 等待就绪 */
  async waitForReady(): Promise<void> {
    if (this._ready) return
    return this._readyPromise
  }
}

// 类型声明扩展
declare module 'koishi' {
  interface Context {
    groupHelper: GroupHelperService
  }
}
```

#### 4.2.2 模块基类

```typescript
// src/core/modules/base.module.ts

export interface ModuleDefinition {
  name: string
  displayName: string
  description?: string
  enabled?: boolean
  configFields?: ConfigField[]
}

export abstract class BaseModule {
  abstract readonly definition: ModuleDefinition
  
  constructor(
    protected ctx: Context,
    protected service: GroupHelperService
  ) {}
  
  /** 初始化模块（注册命令、事件等） */
  abstract initialize(): Promise<void>
  
  /** 卸载模块 */
  abstract dispose(): void
  
  /** 获取模块配置 */
  getConfig<T>(): T {
    return this.service.configService.get(`module:${this.definition.name}`, {})
  }
  
  /** 更新模块配置 */
  setConfig<T>(config: Partial<T>): void {
    this.service.configService.update(`module:${this.definition.name}`, config)
  }
}
```

### 4.3 数据服务层设计

保留 JSON 文件存储，但增强数据访问层，提供统一的 CRUD 接口和缓存机制。

#### 4.3.1 数据存储接口

```typescript
// src/core/data/store.interface.ts

export interface DataStore<T> {
  /** 获取所有数据 */
  getAll(): Promise<T[]>
  
  /** 按条件查找 */
  find(predicate: (item: T) => boolean): Promise<T[]>
  
  /** 按 ID 获取单条 */
  getById(id: string | number): Promise<T | undefined>
  
  /** 添加数据 */
  add(item: T): Promise<T>
  
  /** 批量添加 */
  addMany(items: T[]): Promise<T[]>
  
  /** 更新数据 */
  update(id: string | number, data: Partial<T>): Promise<T | undefined>
  
  /** 删除数据 */
  delete(id: string | number): Promise<boolean>
  
  /** 清空所有数据 */
  clear(): Promise<void>
  
  /** 强制保存到文件 */
  flush(): Promise<void>
}
```

#### 4.3.2 JSON 数据存储实现

```typescript
// src/core/data/json.store.ts

import { promises as fs } from 'fs'
import { resolve } from 'path'
import { Logger } from 'koishi'

export interface JsonStoreOptions {
  /** 文件路径 */
  filePath: string
  /** 延迟保存时间（毫秒） */
  saveDelay?: number
  /** 是否启用备份 */
  enableBackup?: boolean
  /** ID 字段名 */
  idField?: string
}

export class JsonDataStore<T extends Record<string, any>> implements DataStore<T> {
  private _data: T[] = []
  private _loaded = false
  private _saveTimer: NodeJS.Timeout | null = null
  private _dirty = false
  private _logger: Logger
  
  constructor(private options: JsonStoreOptions) {
    this._logger = new Logger(`json-store:${options.filePath}`)
    this.options.saveDelay ??= 1000
    this.options.enableBackup ??= true
    this.options.idField ??= 'id'
  }
  
  private async _ensureLoaded(): Promise<void> {
    if (this._loaded) return
    await this._load()
  }
  
  private async _load(): Promise<void> {
    try {
      const content = await fs.readFile(this.options.filePath, 'utf-8')
      this._data = JSON.parse(content)
      this._loaded = true
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        this._data = []
        this._loaded = true
      } else {
        throw error
      }
    }
  }
  
  private _scheduleSave(): void {
    if (this._saveTimer) return
    this._dirty = true
    this._saveTimer = setTimeout(async () => {
      await this._save()
      this._saveTimer = null
    }, this.options.saveDelay)
  }
  
  private async _save(): Promise<void> {
    if (!this._dirty) return
    
    // 创建备份
    if (this.options.enableBackup) {
      try {
        await fs.copyFile(
          this.options.filePath,
          `${this.options.filePath}.bak`
        )
      } catch {}
    }
    
    // 原子写入：先写临时文件再重命名
    const tempPath = `${this.options.filePath}.tmp`
    await fs.writeFile(tempPath, JSON.stringify(this._data, null, 2))
    await fs.rename(tempPath, this.options.filePath)
    
    this._dirty = false
    this._logger.debug('Data saved')
  }
  
  // ========== DataStore 接口实现 ==========
  
  async getAll(): Promise<T[]> {
    await this._ensureLoaded()
    return [...this._data]
  }
  
  async find(predicate: (item: T) => boolean): Promise<T[]> {
    await this._ensureLoaded()
    return this._data.filter(predicate)
  }
  
  async getById(id: string | number): Promise<T | undefined> {
    await this._ensureLoaded()
    const idField = this.options.idField!
    return this._data.find(item => item[idField] === id)
  }
  
  async add(item: T): Promise<T> {
    await this._ensureLoaded()
    this._data.push(item)
    this._scheduleSave()
    return item
  }
  
  async addMany(items: T[]): Promise<T[]> {
    await this._ensureLoaded()
    this._data.push(...items)
    this._scheduleSave()
    return items
  }
  
  async update(id: string | number, data: Partial<T>): Promise<T | undefined> {
    await this._ensureLoaded()
    const idField = this.options.idField!
    const index = this._data.findIndex(item => item[idField] === id)
    if (index === -1) return undefined
    
    this._data[index] = { ...this._data[index], ...data }
    this._scheduleSave()
    return this._data[index]
  }
  
  async delete(id: string | number): Promise<boolean> {
    await this._ensureLoaded()
    const idField = this.options.idField!
    const index = this._data.findIndex(item => item[idField] === id)
    if (index === -1) return false
    
    this._data.splice(index, 1)
    this._scheduleSave()
    return true
  }
  
  async clear(): Promise<void> {
    this._data = []
    this._scheduleSave()
  }
  async flush(): Promise<void> {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer)
      this._saveTimer = null
    }
    await this._save()
  }
}
```

#### 4.3.3 数据服务管理器

```typescript
// src/core/data/data.service.ts

import { Context } from 'koishi'
import { JsonDataStore } from './json.store'
import { resolve } from 'path'

export class DataService {
  private _stores: Map<string, JsonDataStore<any>> = new Map()
  private _dataDir: string
  
  constructor(private ctx: Context, dataDir: string) {
    this._dataDir = dataDir
    
    // 插件卸载时保存所有数据
    ctx.on('dispose', async () => {
      await this.flushAll()
    })
  }
  
  /** 获取或创建数据存储 */
  getStore<T extends Record<string, any>>(
    name: string,
    options?: Partial<JsonStoreOptions>
  ): JsonDataStore<T> {
    if (this._stores.has(name)) {
      return this._stores.get(name)!
    }
    
    const store = new JsonDataStore<T>({
      filePath: resolve(this._dataDir, `${name}.json`),
      ...options
    })
    
    this._stores.set(name, store)
    return store
  }
  
  /** 保存所有数据 */
  async flushAll(): Promise<void> {
    const promises = Array.from(this._stores.values()).map(s => s.flush())
    await Promise.all(promises)
  }
  
  /** 预定义的数据存储 */
  get warns() { return this.getStore<WarnRecord>('warns') }
  get blacklist() { return this.getStore<BlacklistEntry>('blacklist') }
  get groupConfigs() { return this.getStore<GroupConfig>('group_configs', { idField: 'guildId' }) }
  get mutes() { return this.getStore<MuteRecord>('mutes') }
  get recallRecords() { return this.getStore<RecallRecord>('recall_records') }
  get commandLogs() { return this.getStore<CommandLog>('command_logs') }
  get keywords() { return this.getStore<KeywordRule>('keywords') }
}
```

### 4.4 WebSocket API 设计

参考 media-luna 的 API 设计模式，使用 `ctx.console.addListener()` 注册 WebSocket API。

#### 4.4.1 API 命名规范

```
group-helper/{模块}/{操作}

示例：
- group-helper/groups/list        获取群组列表
- group-helper/groups/get         获取单个群组
- group-helper/groups/update      更新群组配置
- group-helper/warns/list         获取警告列表
- group-helper/warns/add          添加警告
- group-helper/warns/remove       移除警告
- group-helper/keywords/list      获取关键词列表
- group-helper/keywords/add       添加关键词
- group-helper/logs/query         查询日志
```

#### 4.4.2 API 实现示例

```typescript
// src/core/api/group-api.ts

import { Context } from 'koishi'
import { GroupHelperService } from '../services/grouphelper.service'

export function registerGroupApi(ctx: Context, service: GroupHelperService) {
  // 获取群组列表
  ctx.console.addListener('group-helper/groups/list', async (params) => {
    const { page = 1, pageSize = 20, search } = params || {}
    
    let groups = await service.groups.getAll()
    
    if (search) {
      groups = groups.filter(g =>
        g.name?.includes(search) || g.guildId.includes(search)
      )
    }
    
    const total = groups.length
    const items = groups.slice((page - 1) * pageSize, page * pageSize)
    
    return {
      success: true,
      data: { items, total, page, pageSize }
    }
  })
  
  // 获取单个群组
  ctx.console.addListener('group-helper/groups/get', async ({ guildId }) => {
    const group = await service.groups.getById(guildId)
    if (!group) {
      return { success: false, error: 'GROUP_NOT_FOUND' }
    }
    return { success: true, data: group }
  })
  
  // 更新群组配置
  ctx.console.addListener('group-helper/groups/update', async ({ guildId, config }) => {
    const updated = await service.groups.updateConfig(guildId, config)
    if (!updated) {
      return { success: false, error: 'GROUP_NOT_FOUND' }
    }
    
    // 广播更新事件
    ctx.console.broadcast('group-helper/groups/updated', { guildId, config: updated })
    
    return { success: true, data: updated }
  })
}
```

#### 4.4.3 警告模块 API

```typescript
// src/core/api/warn-api.ts

export function registerWarnApi(ctx: Context, service: GroupHelperService) {
  const warnModule = service.getModule<WarnModule>('warn')
  
  // 获取警告列表
  ctx.console.addListener('group-helper/warns/list', async (params) => {
    const { guildId, userId, page = 1, pageSize = 20 } = params || {}
    
    let warns = await warnModule.getWarns({ guildId, userId })
    
    const total = warns.length
    const items = warns.slice((page - 1) * pageSize, page * pageSize)
    
    return { success: true, data: { items, total, page, pageSize } }
  })
  
  // 添加警告
  ctx.console.addListener('group-helper/warns/add', async (params) => {
    const { guildId, userId, reason, operatorId } = params
    
    const warn = await warnModule.addWarn({
      guildId,
      userId,
      reason,
      operatorId,
      createdAt: Date.now()
    })
    
    ctx.console.broadcast('group-helper/warns/added', warn)
    
    return { success: true, data: warn }
  })
  
  // 移除警告
  ctx.console.addListener('group-helper/warns/remove', async ({ warnId }) => {
    const removed = await warnModule.removeWarn(warnId)
    
    if (removed) {
      ctx.console.broadcast('group-helper/warns/removed', { warnId })
    }
    
    return { success: removed, error: removed ? undefined : 'WARN_NOT_FOUND' }
  })
  
  // 清空用户警告
  ctx.console.addListener('group-helper/warns/clear', async ({ guildId, userId }) => {
    const count = await warnModule.clearWarns(guildId, userId)
    
    ctx.console.broadcast('group-helper/warns/cleared', { guildId, userId, count })
    
    return { success: true, data: { count } }
  })
}
```

### 4.5 统一响应格式

```typescript
// src/core/api/types.ts

/** API 成功响应 */
export interface ApiSuccessResponse<T = any> {
  success: true
  data: T
}

/** API 错误响应 */
export interface ApiErrorResponse {
  success: false
  error: string
  message?: string
  details?: any
}

/** API 响应 */
export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse

/** 分页响应数据 */
export interface PaginatedData<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

/** 分页请求参数 */
export interface PaginationParams {
  page?: number
  pageSize?: number
}
```

## 5. WebUI 设计

### 5.1 前端入口

```typescript
// client/index.ts

import { Context } from '@koishijs/client'
import GroupHelper from './pages/index.vue'

export default (ctx: Context) => {
  ctx.page({
    name: '群组管理',
    path: '/group-helper',
    component: GroupHelper,
    icon: 'activity:users',
    order: 100,
    authority: 4,  // 需要管理员权限
  })
}
```

### 5.2 页面布局

主页面采用 Tab 布局，包含以下标签页：

| Tab | 组件 | 功能 |
|-----|------|------|
| 仪表盘 | Dashboard.vue | 统计概览、快捷操作 |
| 群组管理 | GroupList.vue | 群组列表、群配置 |
| 成员管理 | MemberList.vue | 成员列表、黑名单 |
| 警告管理 | WarnManager.vue | 警告记录查看/管理 |
| 关键词 | KeywordManager.vue | 关键词规则管理 |
| 日志 | LogViewer.vue | 操作日志查询 |
| 设置 | Settings.vue | 全局设置 |

### 5.3 API 封装

```typescript
// client/api.ts

import { send } from '@koishijs/client'

export const api = {
  // 群组相关
  groups: {
    list: (params?: PaginationParams & { search?: string }) =>
      send('group-helper/groups/list', params),
    get: (guildId: string) =>
      send('group-helper/groups/get', { guildId }),
    update: (guildId: string, config: Partial<GroupConfig>) =>
      send('group-helper/groups/update', { guildId, config }),
  },
  
  // 警告相关
  warns: {
    list: (params?: { guildId?: string; userId?: string } & PaginationParams) =>
      send('group-helper/warns/list', params),
    add: (data: { guildId: string; userId: string; reason: string }) =>
      send('group-helper/warns/add', data),
    remove: (warnId: string) =>
      send('group-helper/warns/remove', { warnId }),
    clear: (guildId: string, userId: string) =>
      send('group-helper/warns/clear', { guildId, userId }),
  },
  
  // 关键词相关
  keywords: {
    list: (params?: { guildId?: string } & PaginationParams) =>
      send('group-helper/keywords/list', params),
    add: (data: KeywordRule) =>
      send('group-helper/keywords/add', data),
    update: (id: string, data: Partial<KeywordRule>) =>
      send('group-helper/keywords/update', { id, ...data }),
    delete: (id: string) =>
      send('group-helper/keywords/delete', { id }),
  },
  
  // 日志相关
  logs: {
    query: (params: LogQueryParams) =>
      send('group-helper/logs/query', params),
  },
  
  // 模块相关
  modules: {
    list: () =>
      send('group-helper/modules/list'),
    toggle: (name: string, enabled: boolean) =>
      send('group-helper/modules/toggle', { name, enabled }),
    getConfig: (name: string) =>
      send('group-helper/modules/config/get', { name }),
    updateConfig: (name: string, config: any) =>
      send('group-helper/modules/config/update', { name, config }),
  },
}
```

### 5.4 主要组件设计

#### 5.4.1 仪表盘 Dashboard.vue

```vue
<template>
  <div class="dashboard">
    <!-- 统计卡片 -->
    <div class="stats-grid">
      <StatCard title="管理群组" :value="stats.groupCount" icon="users" />
      <StatCard title="今日警告" :value="stats.todayWarns" icon="alert" />
      <StatCard title="今日禁言" :value="stats.todayMutes" icon="mute" />
      <StatCard title="关键词规则" :value="stats.keywordCount" icon="filter" />
    </div>
    
    <!-- 最近活动 -->
    <div class="recent-activity">
      <h3>最近活动</h3>
      <ActivityList :items="recentLogs" />
    </div>
    
    <!-- 模块状态 -->
    <div class="module-status">
      <h3>模块状态</h3>
      <ModuleGrid :modules="modules" @toggle="handleToggle" />
    </div>
  </div>
</template>
```

#### 5.4.2 群组列表 GroupList.vue

```vue
<template>
  <div class="group-list">
    <!-- 搜索栏 -->
    <div class="toolbar">
      <k-input v-model="search" placeholder="搜索群组..." />
      <k-button @click="refresh">刷新</k-button>
    </div>
    
    <!-- 群组表格 -->
    <k-table :data="groups" :loading="loading">
      <k-table-column prop="guildId" label="群号" />
      <k-table-column prop="name" label="群名" />
      <k-table-column prop="memberCount" label="成员数" />
      <k-table-column prop="warnCount" label="警告数" />
      <k-table-column label="操作">
        <template #default="{ row }">
          <k-button size="small" @click="editConfig(row)">配置</k-button>
          <k-button size="small" @click="viewMembers(row)">成员</k-button>
        </template>
      </k-table-column>
    </k-table>
    
    <!-- 分页 -->
    <k-pagination
      v-model:current="page"
      :total="total"
      :page-size="pageSize"
    />
  </div>
</template>
```

#### 5.4.3 警告管理 WarnManager.vue

```vue
<template>
  <div class="warn-manager">
    <!-- 筛选器 -->
    <div class="filters">
      <k-select v-model="filterGuild" placeholder="选择群组" :options="groupOptions" />
      <k-input v-model="filterUser" placeholder="用户ID" />
      <k-button @click="search">搜索</k-button>
      <k-button @click="reset">重置</k-button>
    </div>
    
    <!-- 警告列表 -->
    <k-table :data="warns" :loading="loading">
      <k-table-column prop="guildId" label="群组" />
      <k-table-column prop="userId" label="用户" />
      <k-table-column prop="reason" label="原因" />
      <k-table-column prop="createdAt" label="时间">
        <template #default="{ row }">
          {{ formatTime(row.createdAt) }}
        </template>
      </k-table-column>
      <k-table-column prop="operator" label="操作者" />
      <k-table-column label="操作">
        <template #default="{ row }">
          <k-button size="small" type="danger" @click="removeWarn(row)">
            移除
          </k-button>
        </template>
      </k-table-column>
    </k-table>
  </div>
</template>
```

#### 5.4.4 关键词管理 KeywordManager.vue

```vue
<template>
  <div class="keyword-manager">
    <!-- 工具栏 -->
    <div class="toolbar">
      <k-select v-model="filterGuild" placeholder="选择群组" :options="groupOptions" />
      <k-button type="primary" @click="showAddDialog">添加规则</k-button>
    </div>
    
    <!-- 关键词列表 -->
    <k-table :data="keywords" :loading="loading">
      <k-table-column prop="pattern" label="匹配模式" />
      <k-table-column prop="type" label="类型">
        <template #default="{ row }">
          <k-tag>{{ typeLabels[row.type] }}</k-tag>
        </template>
      </k-table-column>
      <k-table-column prop="action" label="动作" />
      <k-table-column prop="enabled" label="状态">
        <template #default="{ row }">
          <k-switch v-model="row.enabled" @change="toggleKeyword(row)" />
        </template>
      </k-table-column>
      <k-table-column label="操作">
        <template #default="{ row }">
          <k-button size="small" @click="editKeyword(row)">编辑</k-button>
          <k-button size="small" type="danger" @click="deleteKeyword(row)">删除</k-button>
        </template>
      </k-table-column>
    </k-table>
    <!-- 添加/编辑对话框 -->
    <KeywordDialog
      v-model:visible="dialogVisible"
      :keyword="editingKeyword"
      @save="handleSave"
    />
  </div>
</template>
```

---

## 6. 模块详细设计

### 6.1 警告模块 (WarnModule)

警告模块负责管理用户警告记录，支持累计警告自动处罚。

#### 6.1.1 数据结构

```typescript
/** 警告记录 */
export interface WarnRecord {
  id: string
  guildId: string
  userId: string
  reason: string
  operator: string        // 操作者ID
  createdAt: number       // 时间戳
  expiresAt?: number      // 过期时间（可选）
  metadata?: {
    messageId?: string    // 关联消息ID
    ruleId?: string       // 触发的规则ID
  }
}

/** 警告配置 */
export interface WarnConfig {
  maxWarns: number        // 最大警告数
  warnExpireDays: number  // 警告过期天数（0=永不过期）
  autoActions: {          // 累计警告自动动作
    [count: number]: WarnAction
  }
}

export type WarnAction =
  | { type: 'mute'; duration: number }
  | { type: 'kick' }
  | { type: 'ban' }
  | { type: 'notify'; message: string }
```

#### 6.1.2 模块实现

```typescript
export class WarnModule extends BaseModule {
  readonly name = 'warn'
  
  private store: JsonDataStore<WarnRecord>
  
  constructor(ctx: Context, service: GroupHelperService) {
    super(ctx, service)
    this.store = service.data.getStore<WarnRecord>('warns')
  }
  
  /** 添加警告 */
  async addWarn(
    guildId: string,
    userId: string,
    reason: string,
    operator: string
  ): Promise<{ warn: WarnRecord; totalWarns: number; action?: WarnAction }> {
    const warn: WarnRecord = {
      id: this.generateId(),
      guildId,
      userId,
      reason,
      operator,
      createdAt: Date.now(),
    }
    
    await this.store.add(warn)
    
    // 获取当前有效警告数
    const totalWarns = await this.getActiveWarnCount(guildId, userId)
    
    // 检查自动处罚
    const config = await this.getConfig(guildId)
    const action = config.autoActions[totalWarns]
    
    if (action) {
      await this.executeAction(guildId, userId, action)
    }
    
    // 发送事件
    this.ctx.emit('group-helper/warn-added', { warn, totalWarns, action })
    
    return { warn, totalWarns, action }
  }
  
  /** 获取有效警告数 */
  async getActiveWarnCount(guildId: string, userId: string): Promise<number> {
    const warns = await this.store.find(w =>
      w.guildId === guildId &&
      w.userId === userId &&
      (!w.expiresAt || w.expiresAt > Date.now())
    )
    return warns.length
  }
  
  /** 移除警告 */
  async removeWarn(warnId: string): Promise<boolean> {
    const result = await this.store.delete(warnId)
    if (result) {
      this.ctx.emit('group-helper/warn-removed', { warnId })
    }
    return result
  }
  
  /** 清除用户所有警告 */
  async clearWarns(guildId: string, userId: string): Promise<number> {
    const warns = await this.store.find(w =>
      w.guildId === guildId && w.userId === userId
    )
    
    for (const warn of warns) {
      await this.store.delete(warn.id)
    }
    
    return warns.length
  }
}
```

### 6.2 关键词模块 (KeywordModule)

关键词模块负责消息关键词匹配和自动响应。

#### 6.2.1 数据结构

```typescript
/** 关键词规则 */
export interface KeywordRule {
  id: string
  guildId: string
  pattern: string           // 匹配模式
  type: KeywordMatchType    // 匹配类型
  action: KeywordAction     // 触发动作
  response?: string         // 响应内容
  enabled: boolean
  priority: number          // 优先级（数字越大越先匹配）
  cooldown?: number         // 冷却时间（毫秒）
  conditions?: {            // 触发条件
    roles?: string[]        // 限定角色
    users?: string[]        // 限定用户
    channels?: string[]     // 限定频道
  }
  createdAt: number
  updatedAt: number
}

export type KeywordMatchType =
  | 'exact'       // 精确匹配
  | 'contains'    // 包含
  | 'startsWith'  // 前缀
  | 'endsWith'    // 后缀
  | 'regex'       // 正则表达式

export type KeywordAction =
  | 'reply'       // 回复消息
  | 'delete'      // 删除消息
  | 'warn'        // 警告用户
  | 'mute'        // 禁言用户
  | 'kick'        // 踢出用户
  | 'log'         // 仅记录
```

#### 6.2.2 模块实现

```typescript
export class KeywordModule extends BaseModule {
  readonly name = 'keyword'
  
  private store: JsonDataStore<KeywordRule>
  private cooldowns: Map<string, number> = new Map()
  private regexCache: Map<string, RegExp> = new Map()
  
  async initialize(): Promise<void> {
    // 监听消息事件
    this.ctx.on('message', async (session) => {
      if (!session.guildId) return
      await this.handleMessage(session)
    })
  }
  
  /** 处理消息 */
  private async handleMessage(session: Session): Promise<void> {
    const rules = await this.store.find(r =>
      r.guildId === session.guildId && r.enabled
    )
    
    // 按优先级排序
    rules.sort((a, b) => b.priority - a.priority)
    
    for (const rule of rules) {
      if (this.matchRule(session.content, rule)) {
        // 检查冷却
        if (this.isOnCooldown(rule.id)) continue
        
        // 检查条件
        if (!this.checkConditions(session, rule)) continue
        
        // 执行动作
        await this.executeAction(session, rule)
        
        // 设置冷却
        if (rule.cooldown) {
          this.setCooldown(rule.id, rule.cooldown)
        }
        
        // 只匹配第一个规则
        break
      }
    }
  }
  
  /** 匹配规则 */
  private matchRule(content: string, rule: KeywordRule): boolean {
    switch (rule.type) {
      case 'exact':
        return content === rule.pattern
      case 'contains':
        return content.includes(rule.pattern)
      case 'startsWith':
        return content.startsWith(rule.pattern)
      case 'endsWith':
        return content.endsWith(rule.pattern)
      case 'regex':
        return this.getRegex(rule).test(content)
      default:
        return false
    }
  }
  
  /** 获取缓存的正则表达式 */
  private getRegex(rule: KeywordRule): RegExp {
    if (!this.regexCache.has(rule.id)) {
      this.regexCache.set(rule.id, new RegExp(rule.pattern, 'i'))
    }
    return this.regexCache.get(rule.id)!
  }
  
  /** 执行动作 */
  private async executeAction(session: Session, rule: KeywordRule): Promise<void> {
    switch (rule.action) {
      case 'reply':
        if (rule.response) {
          await session.send(rule.response)
        }
        break
      case 'delete':
        await session.bot.deleteMessage(session.channelId, session.messageId)
        break
      case 'warn':
        const warnModule = this.service.getModule<WarnModule>('warn')
        await warnModule?.addWarn(
          session.guildId!,
          session.userId,
          `触发关键词规则: ${rule.pattern}`,
          session.selfId
        )
        break
      case 'mute':
        await session.bot.muteGuildMember(session.guildId!, session.userId, 600000)
        break
      case 'kick':
        await session.bot.kickGuildMember(session.guildId!, session.userId)
        break
      case 'log':
        this.ctx.logger.info(`[Keyword] 用户 ${session.userId} 触发规则 ${rule.id}`)
        break
    }
    // 发送事件
    this.ctx.emit('group-helper/keyword-triggered', { session, rule })
  }
}
```

### 6.3 欢迎模块 (WelcomeModule)

欢迎模块负责新成员入群欢迎和退群通知。

#### 6.3.1 数据结构

```typescript
/** 欢迎配置 */
export interface WelcomeConfig {
  guildId: string
  enabled: boolean
  welcomeMessage: string    // 欢迎消息模板
  leaveMessage?: string     // 退群消息模板
  welcomeChannel?: string   // 指定欢迎频道
  delay?: number            // 延迟发送（毫秒）
  mentionUser: boolean      // 是否@新成员
  cardImage?: string        // 欢迎卡片图片URL
}

/** 模板变量 */
export interface TemplateVariables {
  userId: string
  userName: string
  guildName: string
  memberCount: number
  joinTime: string
}
```

#### 6.3.2 模块实现

```typescript
export class WelcomeModule extends BaseModule {
  readonly name = 'welcome'
  
  private store: JsonDataStore<WelcomeConfig>
  
  async initialize(): Promise<void> {
    // 监听成员加入事件
    this.ctx.on('guild-member-added', async (session) => {
      await this.handleMemberJoin(session)
    })
    
    // 监听成员离开事件
    this.ctx.on('guild-member-removed', async (session) => {
      await this.handleMemberLeave(session)
    })
  }
  
  /** 处理成员加入 */
  private async handleMemberJoin(session: Session): Promise<void> {
    const config = await this.getConfig(session.guildId!)
    if (!config?.enabled) return
    
    const variables = await this.buildVariables(session)
    const message = this.parseTemplate(config.welcomeMessage, variables)
    
    // 延迟发送
    if (config.delay) {
      await new Promise(r => setTimeout(r, config.delay))
    }
    
    // 构建消息
    let content = config.mentionUser ? `<at id="${session.userId}"/> ` : ''
    content += message
    
    // 发送到指定频道或当前频道
    const channelId = config.welcomeChannel || session.channelId
    await session.bot.sendMessage(channelId, content)
    
    this.ctx.emit('group-helper/member-welcomed', { session, config })
  }
  
  /** 处理成员离开 */
  private async handleMemberLeave(session: Session): Promise<void> {
    const config = await this.getConfig(session.guildId!)
    if (!config?.enabled || !config.leaveMessage) return
    
    const variables = await this.buildVariables(session)
    const message = this.parseTemplate(config.leaveMessage, variables)
    
    const channelId = config.welcomeChannel || session.channelId
    await session.bot.sendMessage(channelId, message)
  }
  
  /** 解析模板 */
  private parseTemplate(template: string, vars: TemplateVariables): string {
    return template
      .replace(/\{userId\}/g, vars.userId)
      .replace(/\{userName\}/g, vars.userName)
      .replace(/\{guildName\}/g, vars.guildName)
      .replace(/\{memberCount\}/g, String(vars.memberCount))
      .replace(/\{joinTime\}/g, vars.joinTime)
  }
}
```

### 6.4 防撤回模块 (AntiRecallModule)

防撤回模块负责记录和恢复被撤回的消息。

#### 6.4.1 数据结构

```typescript
/** 消息记录 */
export interface MessageRecord {
  id: string
  messageId: string
  guildId: string
  channelId: string
  userId: string
  content: string
  timestamp: number
  elements?: any[]        // 消息元素（图片、文件等）
}

/** 撤回记录 */
export interface RecallRecord {
  id: string
  messageId: string
  guildId: string
  channelId: string
  userId: string
  content: string
  recalledAt: number
  originalTime: number
}

/** 防撤回配置 */
export interface AntiRecallConfig {
  guildId: string
  enabled: boolean
  notifyChannel?: string    // 通知频道
  maxCacheSize: number      // 最大缓存消息数
  cacheExpireTime: number   // 缓存过期时间（毫秒）
  ignoreRoles?: string[]    // 忽略的角色
  ignoreUsers?: string[]    // 忽略的用户
}
```

#### 6.4.2 模块实现

```typescript
export class AntiRecallModule extends BaseModule {
  readonly name = 'anti-recall'
  
  private messageCache: Map<string, MessageRecord> = new Map()
  private recallStore: JsonDataStore<RecallRecord>
  private cleanupTimer: NodeJS.Timeout | null = null
  
  async initialize(): Promise<void> {
    // 监听消息事件，缓存消息
    this.ctx.on('message', async (session) => {
      if (!session.guildId) return
      await this.cacheMessage(session)
    })
    
    // 监听消息删除事件
    this.ctx.on('message-deleted', async (session) => {
      await this.handleRecall(session)
    })
    
    // 启动定时清理
    this.startCleanup()
  }
  
  /** 缓存消息 */
  private async cacheMessage(session: Session): Promise<void> {
    const config = await this.getConfig(session.guildId!)
    if (!config?.enabled) return
    
    const record: MessageRecord = {
      id: this.generateId(),
      messageId: session.messageId,
      guildId: session.guildId!,
      channelId: session.channelId,
      userId: session.userId,
      content: session.content,
      timestamp: Date.now(),
      elements: session.elements,
    }
    
    this.messageCache.set(session.messageId, record)
    
    // 限制缓存大小
    if (this.messageCache.size > config.maxCacheSize) {
      const oldest = [...this.messageCache.entries()]
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0]
      this.messageCache.delete(oldest[0])
    }
  }
  
  /** 处理撤回 */
  private async handleRecall(session: Session): Promise<void> {
    const cached = this.messageCache.get(session.messageId)
    if (!cached) return
    
    const config = await this.getConfig(cached.guildId)
    if (!config?.enabled) return
    
    // 检查是否忽略该用户
    if (config.ignoreUsers?.includes(cached.userId)) return
    
    // 保存撤回记录
    const record: RecallRecord = {
      id: this.generateId(),
      messageId: cached.messageId,
      guildId: cached.guildId,
      channelId: cached.channelId,
      userId: cached.userId,
      content: cached.content,
      recalledAt: Date.now(),
      originalTime: cached.timestamp,
    }
    
    await this.recallStore.add(record)
    
    // 发送通知
    if (config.notifyChannel) {
      const message = `用户 <at id="${cached.userId}"/> 撤回了消息:\n${cached.content}`
      await session.bot.sendMessage(config.notifyChannel, message)
    }
    
    // 从缓存中移除
    this.messageCache.delete(session.messageId)
    
    this.ctx.emit('group-helper/message-recalled', { record })
  }
  
  /** 启动定时清理 */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now()
      for (const [id, record] of this.messageCache) {
        if (now - record.timestamp > 3600000) { // 1小时过期
          this.messageCache.delete(id)
        }
      }
    }, 300000) // 每5分钟清理
  }
  
  async dispose(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }
  }
}
```

---

## 7. 迁移计划

> **核心原则：保持现有命令格式和存储格式不变**

### 7.1 兼容性保证

本次重构的核心目标是改善内部架构，**不改变用户可见的接口**：

| 项目 | 保持不变 | 说明 |
|------|----------|------|
| 命令格式 | ✅ | 所有命令语法保持不变 |
| 命令名称 | ✅ | 如 `warn`、`keyword`、`banme` 等 |
| JSON 存储格式 | ✅ | 文件结构和字段保持兼容 |
| 配置项名称 | ✅ | koishi.yml 配置项保持兼容 |
| 数据目录 | ✅ | `data/grouphelper/` 目录不变 |

### 7.2 迁移策略

采用**渐进式重构**策略，分阶段进行：

```
阶段 1: 核心服务层
├── 创建 GroupHelperService 主服务
├── 实现 DataService 数据层（兼容现有 JSON）
└── 现有命令暂时保持不变

阶段 2: 模块化改造
├── 逐个将命令迁移到模块中
├── 保持命令格式完全一致
└── 添加内部事件系统

阶段 3: WebUI 添加
├── 添加 WebSocket API
├── 开发前端界面
└── 不影响命令行功能

阶段 4: 优化清理
├── 移除旧代码
├── 文档更新
└── 性能优化
```

### 7.3 数据兼容性

现有 JSON 文件将**直接复用**，无需迁移：

```typescript
// 现有数据文件保持不变
data/grouphelper/
├── warns.json           // 警告记录
├── blacklist.json       // 黑名单
├── group_config.json    // 群配置
├── mutes.json           // 禁言记录
├── recall_records.json  // 撤回记录
├── command_logs.json    // 命令日志
└── ...

// DataService 直接读取现有格式
class DataService {
  get warns() {
    return this.getStore<WarnRecord>('warns')  // 读取 warns.json
  }
}
```

### 7.4 命令兼容性

所有现有命令保持原有格式：

```
现有命令（保持不变）:
├── warn <user> [reason]     - 警告用户
├── unwarn <user>            - 移除警告
├── keyword add <pattern>    - 添加关键词
├── keyword list             - 列出关键词
├── banme [duration]         - 自助禁言
├── config <key> [value]     - 群配置
└── ...其他命令保持原样
```

---

## 8. 实现优先级

### 8.1 优先级矩阵

| 优先级 | 模块/功能 | 重要性 | 复杂度 | 说明 |
|--------|-----------|--------|--------|------|
| P0 | 核心服务层 | 高 | 中 | GroupHelperService、DataService |
| P0 | 数据层重构 | 高 | 低 | JsonDataStore（兼容现有格式） |
| P1 | 模块基类 | 高 | 低 | BaseModule 抽象 |
| P1 | 警告模块 | 高 | 中 | WarnModule |
| P1 | 关键词模块 | 高 | 中 | KeywordModule |
| P2 | WebSocket API | 中 | 中 | 基础 API 框架 |
| P2 | 欢迎模块 | 中 | 低 | WelcomeModule |
| P2 | 防撤回模块 | 中 | 中 | AntiRecallModule |
| P3 | WebUI 前端 | 中 | 高 | Vue 组件开发 |
| P3 | 其他模块 | 低 | 低 | Dice、Banme、Repeat 等 |

### 8.2 里程碑计划

```
里程碑 1: 核心架构 (v2.0.0-alpha)
├── [x] 设计文档完成
├── [ ] GroupHelperService 主服务
├── [ ] DataService 数据服务
├── [ ] BaseModule 模块基类
└── [ ] 基础类型定义

里程碑 2: 核心模块 (v2.0.0-beta)
├── [ ] WarnModule 警告模块
├── [ ] KeywordModule 关键词模块
├── [ ] 命令迁移（保持格式不变）
└── [ ] 单元测试

里程碑 3: WebUI 基础 (v2.0.0-rc)
├── [ ] WebSocket API 注册
├── [ ] 前端入口配置
├── [ ] Dashboard 仪表盘
├── [ ] GroupList 群组列表
└── [ ] WarnManager 警告管理

里程碑 4: 完整功能 (v2.0.0)
├── [ ] 所有模块迁移完成
├── [ ] WebUI 全部页面
├── [ ] 文档更新
└── [ ] 性能优化
```

### 8.3 开发检查清单

**阶段 1 检查项：**
- [ ] `src/core/services/grouphelper.service.ts` 创建
- [ ] `src/core/data/json.store.ts` 创建
- [ ] `src/core/data/data.service.ts` 创建
- [ ] `src/core/modules/base.module.ts` 创建
- [ ] `src/types.ts` 类型定义更新
- [ ] `src/index.ts` 入口文件重构
- [ ] 现有功能正常运行

---

## 9. 附录

### 9.1 参考资料

- [Koishi 官方文档 - 服务](https://koishi.chat/zh-CN/guide/plugin/service.html)
- [Koishi 控制台开发](https://koishi.chat/zh-CN/guide/console/)
- [media-luna 插件源码](../external/media-luna/)
- [@koishijs/client API](https://www.npmjs.com/package/@koishijs/client)

### 9.2 术语表

| 术语 | 说明 |
|------|------|
| Service | Koishi 服务，通过 `ctx.{name}` 访问 |
| Module | 功能模块，继承 BaseModule |
| DataStore | 数据存储接口 |
| JsonDataStore | JSON 文件存储实现 |
| WebSocket API | 通过 `ctx.console.addListener()` 注册的 API |

### 9.3 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0 | 2026-01-06 | 初始设计文档 |

---

*文档结束*
