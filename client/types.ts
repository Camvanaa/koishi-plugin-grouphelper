/**
 * 客户端类型定义
 * 注意：这里直接定义类型，不从 src 导入（client 和 src 有独立的 tsconfig）
 */

// 群组配置
export interface GroupConfig {
  guildName?: string
  keywords?: string[]
  approvalKeywords?: string[]
  auto?: string
  reject?: string
  forbidden?: {
    autoDelete: boolean
    autoBan: boolean
    autoKick: boolean
    muteDuration: number
  }
  welcomeMsg?: string
  welcomeEnabled?: boolean
  antiRepeat?: {
    enabled: boolean
    threshold: number
  }
  banme?: {
    enabled: boolean
    baseMin: number
    baseMax: number
    growthRate: number
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

// 扩展 @koishijs/client 的 Events 接口
declare module '@koishijs/client' {
  interface Events {
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
  }
}