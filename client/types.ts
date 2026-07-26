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
  goodbyeMsg?: string
  welcomeEnabled?: boolean
  goodbyeEnabled?: boolean
  levelLimit?: number
  leaveCooldown?: number
  /** 警告次数限制（覆盖全局设置） */
  warnLimit?: number
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
    chatEnabled?: boolean
    translateEnabled?: boolean
    systemPrompt?: string
    translatePrompt?: string
  }
  antiRecall?: {
    enabled: boolean
    retentionDays?: number
    maxRecordsPerUser?: number
  }
  report?: {
    enabled: boolean
    autoProcess?: boolean
    includeContext?: boolean
    contextSize?: number
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
  /** 来源群过滤：仅接收列表内群产生的推送；空/未设置表示接收全部来源 */
  sourceGuildIds?: string[]
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
  /** 角色别名（用于命令查找，没有时使用 name） */
  alias?: string
  color?: string
  priority: number
  permissions: string[]
  scope?: AuthScope
  /** 角色生效的群组 ID 列表（空数组或 undefined 表示全局生效） */
  guildIds?: string[]
  /** 是否为内置角色（内置角色不可删除） */
  builtin?: boolean
}

export type ScopeType = 'global' | 'guildGroup' | 'guilds'

export interface AuthScope {
  type: ScopeType
  guildGroupIds?: string[]
  guildIds?: string[]
}

export interface GuildGroup {
  id: string
  name: string
  description?: string
  guildIds: string[]
}

export interface GroupGroupConfigData {
  configs: Record<string, Partial<GroupConfig>>
}

export interface UserRoleBinding {
  roleId: string
  scope: AuthScope
  assignedBy?: string
  assignedAt?: number
}

export interface PermissionNode {
  id: string
  name: string
  description: string
  group?: string // 用于前端分组显示
}

// 说明：此处原本还有一份 declare module '@koishijs/client' 的 Events 声明，
// 但它与真实调用方式已经漂移——参数写成位置参数而实际传对象，返回值写成裸类型
// 而后端统一返回 ApiResponse<T>，且缺失大量端点。这种"看着有类型、实际对不上"的
// 声明比没有更糟，已移除。
// 端点签名以 src/augmentations.d.ts 为唯一权威来源。
