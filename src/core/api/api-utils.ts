/**
 * API 层共享工具：响应格式、端点注册器与配置合并
 */
import { Context } from 'koishi'
import type {} from '@koishijs/plugin-console'
import type { GroupHelperService } from '../services/grouphelper.service'
import type { GroupConfig } from '../../types'

/**
 * 控制台端点所需的最低权限等级。
 * 本插件的端点均可读写群管数据或以机器人身份发消息，一律按管理员要求。
 */
export const ADMIN_AUTHORITY = 4

/** API 响应格式 */
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

/** 成功响应 */
export function success<T>(data: T): ApiResponse<T> {
  return { success: true, data }
}

/** 失败响应 */
export function error(message: string): ApiResponse {
  return { success: false, error: message }
}

/** 端点注册函数签名，由 createListenerRegistrar 生成后注入各域模块 */
export type ListenerRegistrar = (
  event: string,
  callback: (...args: any[]) => any,
  options?: { authority?: number }
) => void

/**
 * 构造受权限保护的端点注册器。
 *
 * 所有端点都必须经由它注册，不要直接调用 ctx.console.addListener：
 * @koishijs/plugin-auth 的 console/intercept 钩子在 listener 未声明 authority 时
 * 会直接放行，因此漏传等同于对未认证连接完全开放。
 *
 * 同时统一兜底 catch —— 未包 try/catch 的端点抛异常时会由框架返回 { error }，
 * 与本插件约定的 { success, error } 形状不一致，前端按 ApiResponse 解析会误判。
 */
export function createListenerRegistrar(ctx: Context): ListenerRegistrar {
  return (event, callback, options = {}) => {
    const guarded = async (...args: any[]) => {
      try {
        return await callback(...args)
      } catch (e) {
        ctx.logger('grouphelper').error(`API ${event} 执行失败:`, e)
        return error(e instanceof Error ? e.message : String(e))
      }
    }

    ctx.console.addListener(event as any, guarded as any, {
      authority: options.authority ?? ADMIN_AUTHORITY
    })
  }
}

/**
 * 机密字段下发给前端时的占位符。
 *
 * 前端把整份 settings 原样回传保存，所以读写必须成对处理：
 * 收到该占位符表示"未修改"，需还原成已存储的值；收到空串才是用户主动清除。
 */
export const REDACTED_SECRET = '••••••••'

/** 下发前隐去机密字段，不改动存储中的原对象 */
export function redactSecrets(settings: any): any {
  if (!settings?.openai?.apiKey) return settings
  return {
    ...settings,
    openai: { ...settings.openai, apiKey: REDACTED_SECRET }
  }
}

/** 回写前把占位符还原成已存储的机密值 */
export function restoreSecrets(patch: any, current: any): any {
  if (patch?.openai?.apiKey !== REDACTED_SECRET) return patch
  return {
    ...patch,
    openai: { ...patch.openai, apiKey: current?.openai?.apiKey ?? '' }
  }
}

/**
 * 递归合并时必须跳过的键。
 * 这些键来自前端可控的 JSON，写入它们会改动原型链而非普通属性。
 */
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

/**
 * 把某个群组组的配置补丁下发到组内所有群。
 *
 * config 与 auth 两个域都会触发（改配置、改组成员各一次），因此放在共享层。
 */
export async function applyGroupGroupConfigToGuilds(
  data: GroupHelperService['data'],
  groupId: string
): Promise<void> {
  const groups = data.guildGroups.get('groups') || {}
  const configs = data.groupGroupConfig.get('configs') || {}
  const group = groups[groupId]
  const patch = configs[groupId]
  if (!group || !patch) return

  const groupConfig = data.groupConfig.getAll()
  for (const guildId of group.guildIds || []) {
    const current = groupConfig[guildId] || {}
    const merged = mergePartialConfig(current, patch as GroupConfig)
    data.groupConfig.set(guildId, merged)
  }
  await data.groupConfig.flush()
}

export function mergePartialConfig<T extends Record<string, any>>(target: T, patch: Partial<T>): T {
  const result: T = { ...target }
  for (const key of Object.keys(patch) as Array<keyof T>) {
    if (UNSAFE_KEYS.has(String(key))) continue
    const value = patch[key]
    if (typeof value === 'undefined') continue
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      result[key] = mergePartialConfig(target[key], value) as T[keyof T]
    } else {
      result[key] = value as T[keyof T]
    }
  }
  return result
}
