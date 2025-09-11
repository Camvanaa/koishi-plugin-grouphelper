
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
  defaultWelcome?: string
  banme: {
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
  friendRequest: {
    enabled: boolean
    keywords: string[]
    rejectMessage: string
  }
  guildRequest: {
    enabled: boolean
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
  }
}


export interface GroupConfig {
  keywords: string[]
  approvalKeywords?: string[]
  forbidden: {
    autoDelete: boolean
    autoBan: boolean
    autoKick: boolean
    muteDuration: number
  }
  welcomeMsg?: string
  banme?: BanMeConfig
  openai?: {
    enabled: boolean
    systemPrompt?: string
    translatePrompt?: string
  }
  antiRecall?: {
    enabled: boolean
  }
}


export interface WarnRecord {
  groups: {
    [guildId: string]: {
      count: number
      timestamp: number
    }
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
