/**
 * 日志检索 API
 */
import { Context } from 'koishi'
import type {} from '@koishijs/plugin-console'
import { GroupHelperService } from '../services/grouphelper.service'
import type { ListenerRegistrar } from './api-utils'
import { success, error } from './api-utils'

export function registerLogsAPI(
  ctx: Context,
  service: GroupHelperService,
  addListener: ListenerRegistrar
) {
  const data = service.data

  // ===== 日志检索 API =====

  addListener('grouphelper/logs/search', async (params: {
    startTime?: string | number
    endTime?: string | number
    command?: string
    userId?: string
    username?: string
    details?: string
    guildId?: string
    page?: number
    pageSize?: number
  }) => {
    const logModule = service.getAllModules().find(m => m.meta.name === 'log') as any
    if (!logModule) return error('Log module not found')

    // 获取所有日志进行检索
    let logs = await logModule.getAllLogs()
    
    // 过滤
    logs = logs.filter((log: any) => {
      try {
        const time = new Date(log.timestamp).getTime()
        if (params.startTime && time < new Date(params.startTime).getTime()) return false
        if (params.endTime && time > new Date(params.endTime).getTime()) return false
        if (params.command && !String(log.command || '').toLowerCase().includes(params.command.toLowerCase())) return false
      if (params.userId && String(log.userId) !== params.userId) return false
      if (params.username && (!log.username || !String(log.username).toLowerCase().includes(params.username.toLowerCase()))) return false
      if (params.details) {
        const keyword = params.details.toLowerCase()
        const matchResult = String(log.result || '').toLowerCase().includes(keyword)
        const matchError = String(log.error || '').toLowerCase().includes(keyword)
        const matchArgs = log.args?.some((arg: any) => String(arg).toLowerCase().includes(keyword))
        const matchOptions = JSON.stringify(log.options || {}).toLowerCase().includes(keyword)
        
        if (!matchResult && !matchError && !matchArgs && !matchOptions) return false
      }
      if (params.guildId && String(log.guildId) !== params.guildId) return false
      return true
      } catch (e) {
        // 如果单条日志处理出错，跳过该日志而不是导致整个请求失败
        return false
      }
    })

    // 分页
    const page = params.page || 1
    const pageSize = params.pageSize || 20
    const total = logs.length
    const list = logs.slice((page - 1) * pageSize, page * pageSize)

    return success({ list, total, page, pageSize })
  })
}
