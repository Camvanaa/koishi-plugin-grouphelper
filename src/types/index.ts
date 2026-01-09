
import { Context } from 'koishi'
import { deprecate } from 'util'


declare module 'koishi' {
  interface Config {
    keywords: string[]
    warnLimit: number
    banTimes: {
      expression: string
    }
    forbidden: {
      autoDelete: boolean
      autoBan: boolean
      autoKick: boolean
      muteDuration: number
      keywords: string[]
    }
    defaultWelcome: string
    banme: {
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
    friendRequest: {
      enabled: boolean
      keywords: string[]
      rejectMessage: string
    }
    guildRequest: {
      enabled: boolean
      keywords: string[]
      rejectMessage: string
    }
    setEssenceMsg: {
      enabled: boolean
      authority: number
    }
    setTitle: {
      enabled: boolean
      authority: number
      maxLength: number
    }
    antiRepeat: {
      enabled: boolean
      threshold: number
    }
    openai: {
      enabled: boolean
      apiKey: string
      apiUrl: string
      maxTokens: number
      temperature: number
      model: string
      systemPrompt: string
      contextLimit: number
      translatePrompt: string
    }
    antiRecall: {
      enabled: boolean
      retentionDays: number
      maxRecordsPerUser: number
      showOriginalTime: boolean
      authority: number
    }
  }
}


export interface Config {
  /** 入群审核关键词列表 */
  keywords: string[]
  /** 警告达到多少次触发自动禁言 */
  warnLimit: number
  /** 自动禁言时长设置 */
  banTimes: {
    /** 警告禁言时长表达式 */
    expression: string
  }
  /** 禁言关键词设置 */
  forbidden: {
    autoDelete: boolean
    autoBan: boolean
    autoKick: boolean
    muteDuration: number
    keywords: string[]
  }
  /** 默认欢迎语 */
  defaultWelcome?: string
  defaultGoodbye?: string
  /** 掷骰子设置 */
  dice: {
    enabled: boolean
    lengthLimit: number
  }
  /** banme指令设置 */
  banme: {
    enabled: boolean
    baseMin: number
    baseMax: number
    growthRate: number
    autoBan?: boolean // 兼容旧配置
    autoBanEnabled?: boolean // 新配置名
    jackpot: {
      enabled: boolean
      baseProb: number
      softPity: number
      hardPity: number
      upDuration: string
      loseDuration: string
    }
  }
  /** 好友申请设置 */
  friendRequest: {
    enabled: boolean
    keywords: string[]
    rejectMessage: string
  }
  /** 入群邀请设置 */
  guildRequest: {
    enabled: boolean
    rejectMessage: string
  }
  /** 精华消息设置 */
  setEssenceMsg: {
    enabled: boolean
    authority: number
  }
  /** 头衔设置 */
  setTitle: {
    enabled: boolean
    authority: number
    maxLength: number
  }
  /** 反复读设置 */
  antiRepeat: {
    enabled: boolean
    threshold: number
  }
  /** AI功能设置 */
  openai: {
    enabled: boolean
    chatEnabled?: boolean
    translateEnabled?: boolean
    apiKey: string
    apiUrl: string
    model: string
    systemPrompt: string
    translatePrompt: string
    maxTokens: number
    temperature: number
    contextLimit: number
  }
  /** 举报功能设置 */
  report: {
    enabled: boolean
    authority: number
    autoProcess: boolean
    defaultPrompt: string
    contextPrompt: string
    maxReportTime: number
    guildConfigs: Record<string, {
      enabled: boolean
      includeContext: boolean
      contextSize: number
      autoProcess: boolean
    }>
    maxReportCooldown: number
    minAuthorityNoLimit: number
  }
  /** 防撤回功能设置 */
  antiRecall: {
    enabled: boolean
    retentionDays: number
    maxRecordsPerUser: number
    showOriginalTime: boolean
  }
}

export interface ReportConfig {
  enabled: boolean
  authority: number
  autoProcess: boolean
  maxReportCooldown: number
  minAuthorityNoLimit: number
  maxReportTime: number
  defaultPrompt?: string
  contextPrompt?: string
  guildConfigs?: Record<string, ReportGuildConfig>
}

export interface ReportGuildConfig {
  enabled: boolean
  autoProcess?: boolean
  includeContext?: boolean
  contextSize?: number
}

export interface CommandLogEntry {
  timestamp: string | number
  guildId: string
  userId: string
  command: string
  target: string
  details: string
}

export interface CommandLogData {
  logs: CommandLogEntry[]
  [key: string]: unknown
}


export interface GroupConfig {
  keywords?: string[]
  approvalKeywords?: string[]
  auto?: string  // 自动拒绝状态：'true' | 'false'
  reject?: string  // 拒绝词消息
  forbidden?: {
    autoDelete: boolean
    autoBan: boolean
    autoKick: boolean
    muteDuration: number
    echo?: boolean  // 操作后回显结果
  }
  welcomeMsg?: string
  goodbyeMsg?: string
  welcomeEnabled?: boolean
  goodbyeEnabled?: boolean
  levelLimit?: number  // 等级限制
  leaveCooldown?: number  // 退群冷却天数
  banme?: BanMeConfig
  dice?: DiceConfig
  antiRepeat?: AntiRepeatConfig
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

export interface DiceConfig {
  enabled?: boolean
  lengthLimit?: number
}


export interface WarnRecord {
  [userId: string]: {
    count: number
    timestamp: number
  }
}


export interface BlacklistRecord {
  userId: string
  timestamp: number
}


export interface MuteRecord {
  startTime: number
  duration: number
  remainingTime?: number
  leftGroup?: boolean
  notified?: boolean
}


export interface BanMeRecord {
  count: number
  lastResetTime: number
  pity: number
  guaranteed: boolean
}


export interface LockedName {
  userId: string
  name: string
}


export interface LogRecord {
  time: string
  command: string
  user: string
  group: string
  target: string
  result: string
}


export interface AntiRepeatConfig {
  enabled: boolean
  threshold: number
}


export interface LogSubscription {
  type: 'group' | 'private'
  id: string
}


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


export interface BanMeConfig {
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


export interface RepeatRecord {
  content: string
  count: number
  firstMessageId: string
  messages: Array<{
    id: string
    userId: string
    timestamp: number
  }>
}


export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'function'
  content: string
  name?: string
}

export interface ChatCompletionRequest {
  model: string
  messages: ChatMessage[]
  temperature?: number
  top_p?: number
  max_tokens?: number
  presence_penalty?: number
  frequency_penalty?: number
}

export interface ChatCompletionResponse {
  id: string
  object: string
  created: number
  model: string
  choices: {
    index: number
    message: ChatMessage
    finish_reason: string
  }[]
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface UserContext {
  userId: string
  messages: ChatMessage[]
  lastTimestamp: number
}

// 防撤回相关接口
export interface RecalledMessage {
  id: string
  messageId: string
  userId: string
  username: string
  guildId: string
  channelId?: string
  content: string
  timestamp: number
  recallTime: number
  elements?: any[]
}

export interface RecallRecord {
  [guildId: string]: {
    [userId: string]: RecalledMessage[]
  }
}

// 退群冷却记录
export interface LeaveRecord {
  expireTime: number
}

// 权限系统相关接口
export interface PermissionNode {
  id: string
  name: string
  description: string
  group?: string // 用于前端分组显示
}

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

export interface AuthRolesData extends Record<string, unknown> {
  roles: Record<string, Role>
  defaultLevels: Record<number, string[]> // 0-5 对应的默认权限列表
}

export interface AuthUsersData extends Record<string, unknown> {
  users: Record<string, string[]> // userId -> roleIds
}

/** 已注册的命令信息（用于动态生成帮助） */
export interface RegisteredCommand {
  /** 完整命令名（如 warn、warn.clear） */
  name: string
  /** 命令描述 */
  desc: string
  /** 参数定义 */
  args?: string
  /** 使用方法说明 */
  usage?: string
  /** 命令示例 */
  examples?: string[]
  /** 所属模块名 */
  module: string
  /** 模块描述（用于分组） */
  moduleDesc: string
  /** 权限节点 ID */
  permId?: string
  /** 是否跳过权限检查 */
  skipAuth?: boolean
}
