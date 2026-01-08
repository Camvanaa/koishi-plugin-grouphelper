/**
 * 客户端类型定义
 * 注意：这里直接定义类型，不从 src 导入（client 和 src 有独立的 tsconfig）
 */

export interface RoleMember {
 id: string
 name: string
 avatar: string
}

// 群组配置
export interface GroupConfig {
  guildName?: string
  guildAvatar?: string
  keywords?: string[]
  approvalKeywords?: string[]
  auto?: string
  reject?: string
  forbidden?: {
    autoDelete: boolean
    autoBan: boolean
    autoKick: boolean
    muteDuration: number
    echo?: boolean
  }
  welcomeMsg?: string
  welcomeEnabled?: boolean
  levelLimit?: number
  leaveCooldown?: number
  dice?: {
    enabled: boolean
    lengthLimit: number
  }
  antiRepeat?: {
    enabled: boolean
    threshold: number
  }
  banme?: {
    enabled: boolean
    baseMin: number
    baseMax: number
    growthRate: number
    autoBan?: boolean
    jackpot: {
      enabled: boolean
      baseProb: number
      softPity: number
      hardPity: number
      upDuration: string
      loseDuration: string
    }
  }
  openai?: {
    enabled: boolean
    systemPrompt?: string
    translatePrompt?: string
  }
  antiRecall?: {
    enabled: boolean
    retentionDays?: number
    maxRecordsPerUser?: number
  }
}

// 警告记录
export interface WarnRecord {
  groups: {
    [guildId: string]: {
      count: number
      timestamp: number
    }
  }
}

// 黑名单记录
export interface BlacklistRecord {
  userId: string
  timestamp: number
}

// 订阅配置
export interface Subscription {
  type: 'group' | 'private'
  id: string
  name?: string
  avatar?: string
  features: {
    log?: boolean
    memberChange?: boolean
    muteExpire?: boolean
    blacklist?: boolean
    warning?: boolean
    antiRecall?: boolean
  }
}

// 仪表盘统计数据类型
export interface DashboardStats {
  totalGroups: number
  totalWarns: number
  totalBlacklisted: number
  totalSubscriptions: number
  timestamp: number
}

// 日志搜索参数
export interface LogSearchParams {
  startTime?: string | number
  endTime?: string | number
  command?: string
  userId?: string
  username?: string
  details?: string
  guildId?: string
  page?: number
  pageSize?: number
}

// 日志记录
export interface LogRecord {
  id: string
  timestamp: string
  userId: string
  username?: string
  userAuthority?: number
  guildId?: string
  guildName?: string
  channelId?: string
  platform: string
  command: string
  args: string[]
  options: Record<string, any>
  success: boolean
  error?: string
  executionTime: number
  result?: string
  messageId?: string
  isPrivate: boolean
}

// 日志响应
export interface LogResponse {
  list: LogRecord[]
  total: number
  page: number
  pageSize: number
}

// 聊天消息
export interface ChatMessage {
  id: string
  timestamp: number
  userId: string
  username: string
  avatar?: string
  content: string
  elements?: any[] // h elements
  platform: string
  guildId?: string
  guildName?: string
  guildAvatar?: string
  channelId: string
  channelName?: string
  selfId: string
}

// 权限相关类型
export interface Role {
  id: string
  name: string
  color?: string
  priority: number
  permissions: string[]
  /** 角色生效的群组 ID 列表（空数组或 undefined 表示全局生效） */
  guildIds?: string[]
  /** 是否为内置角色（内置角色不可删除） */
  builtin?: boolean
}

export interface PermissionNode {
  id: string
  name: string
  description: string
  group?: string // 用于前端分组显示
}

// 扩展 @koishijs/client 的 Events 接口
declare module '@koishijs/client' {
  interface Events {
    // 权限管理 API
    'grouphelper/auth/role/list'(): Promise<Role[]>
    'grouphelper/auth/role/update'(params: { role: Role }): Promise<{ success: boolean }>
    'grouphelper/auth/role/delete'(params: { roleId: string }): Promise<{ success: boolean }>
    'grouphelper/auth/user/get'(params: { userId: string }): Promise<string[]>
    'grouphelper/auth/user/assign'(params: { userId: string, roleId: string }): Promise<{ success: boolean }>
    'grouphelper/auth/user/revoke'(params: { userId: string, roleId: string }): Promise<{ success: boolean }>
    'grouphelper/auth/permission/list'(): Promise<PermissionNode[]>

    // 群组配置 API
    'grouphelper/config/list'(): Promise<Record<string, GroupConfig>>
    'grouphelper/config/get'(guildId: string): Promise<GroupConfig | undefined>
    'grouphelper/config/update'(guildId: string, config: GroupConfig): Promise<{ success: boolean }>

    // 警告记录 API
    'grouphelper/warns/list'(): Promise<Record<string, WarnRecord>>
    'grouphelper/warns/get'(key: string): Promise<WarnRecord | undefined>
    'grouphelper/warns/clear'(key: string): Promise<{ success: boolean }>

    // 黑名单 API
    'grouphelper/blacklist/list'(): Promise<Record<string, BlacklistRecord>>
    'grouphelper/blacklist/add'(userId: string, record: BlacklistRecord): Promise<{ success: boolean }>
    'grouphelper/blacklist/remove'(userId: string): Promise<{ success: boolean }>

    // 订阅 API
    'grouphelper/subscriptions/list'(): Promise<Subscription[]>
    'grouphelper/subscriptions/add'(subscription: Subscription): Promise<{ success: boolean }>
    'grouphelper/subscriptions/remove'(index: number): Promise<{ success: boolean }>

    // 统计 API
    'grouphelper/stats/dashboard'(): Promise<DashboardStats>

    // 日志 API
    'grouphelper/logs/search'(params: LogSearchParams): Promise<LogResponse>

    // 聊天 API
    'grouphelper/chat/send'(params: { channelId: string, content: string, platform?: string, guildId?: string }): Promise<{ success: boolean }>
  }
}