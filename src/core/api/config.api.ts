/**
 * 群组配置与群组组配置 API
 */
import { Context } from 'koishi'
import type {} from '@koishijs/plugin-console'
import { GroupHelperService } from '../services/grouphelper.service'
import type { ListenerRegistrar } from './api-utils'
import { applyGroupGroupConfigToGuilds } from './api-utils'
import { success, error } from './api-utils'
import type { GroupConfig } from '../../types'

export function registerConfigAPI(
  ctx: Context,
  service: GroupHelperService,
  addListener: ListenerRegistrar
) {
  const data = service.data

  // ===== 群组配置 API =====
  
  /** 重新加载所有数据 */
  addListener('grouphelper/config/reload' as any, async () => {
    try {
      data.groupConfig.reload()
      ctx.logger('grouphelper').info('群组配置已重新加载，共 %d 条', Object.keys(data.groupConfig.getAll()).length)
      return success({
        success: true,
        count: Object.keys(data.groupConfig.getAll()).length
      })
    } catch (e) {
      ctx.logger('grouphelper').error('重新加载配置失败:', e)
      return error(e instanceof Error ? e.message : '重新加载失败')
    }
  })

  /** 获取所有群组配置 */
  addListener('grouphelper/config/list', async (params?: { fetchNames?: boolean }) => {
    const allConfigs = data.groupConfig.getAll()
    const results: Record<string, any> = {}

    if (params?.fetchNames) {
      // 开启解析：从缓存读取群组名称和头像，未缓存使用默认头像
      const cacheData = service.cache.getCachedData()
      Object.entries(allConfigs).forEach(([guildId, config]) => {
        const cached = cacheData.guilds[guildId]
        results[guildId] = {
          ...config,
          guildName: cached?.name || '',
          guildAvatar: cached?.avatar || `https://p.qlogo.cn/gh/${guildId}/${guildId}/640/`
        }
      })
    } else {
      // 关闭解析：不读取名称
      Object.entries(allConfigs).forEach(([guildId, config]) => {
        results[guildId] = {
          ...config,
          guildName: '',
          guildAvatar: ''
        }
      })
    }

    return success(results)
  })

  /** 获取单个群组配置 */
  addListener('grouphelper/config/get', async (params: { guildId: string }) => {
    return success(data.groupConfig.get(params.guildId))
  })

  /** 更新群组配置 */
  addListener('grouphelper/config/update', async (params: { guildId: string, config: any }) => {
    data.groupConfig.set(params.guildId, params.config)
    await data.groupConfig.flush()
    return success({ success: true })
  })

  /** 创建群组配置 */
  addListener('grouphelper/config/create', async (params: { guildId: string }) => {
    if (data.groupConfig.get(params.guildId)) {
      return error('配置已存在')
    }
    // 创建默认配置
    const defaultConfig = {
      welcomeEnabled: false,
      antiRecall: { enabled: false },
      antiRepeat: { enabled: false, threshold: 3 },
      forbidden: { autoDelete: false, autoBan: false, autoKick: false, muteDuration: 600000 },
      dice: { enabled: true, lengthLimit: 1000 },
      banme: {
        enabled: true, baseMin: 1, baseMax: 30, growthRate: 30,
        jackpot: { enabled: true, baseProb: 0.006, softPity: 73, hardPity: 89, upDuration: '24h', loseDuration: '12h' }
      },
      openai: { enabled: true }
    }
    data.groupConfig.set(params.guildId, defaultConfig)
    await data.groupConfig.flush()
    return success({ success: true })
  })

  /** 删除群组配置 */
  addListener('grouphelper/config/delete', async (params: { guildId: string }) => {
    data.groupConfig.delete(params.guildId)
    await data.groupConfig.flush()
    return success({ success: true })
  })

  // ===== 群组组配置 API =====

  /** 获取所有群组组配置 */
  addListener('grouphelper/config/group-group-config/list' as any, async () => {
    const configs = data.groupGroupConfig.get('configs') || {}
    return success(configs)
  })

  /** 获取指定群组组配置 */
  addListener('grouphelper/config/group-group-config/get' as any, async (params: { groupId: string }) => {
    const configs = data.groupGroupConfig.get('configs') || {}
    return success(configs[params.groupId] || {})
  })

  /** 更新群组组配置（局部合并） */
  addListener('grouphelper/config/group-group-config/update' as any, async (params: { groupId: string, config: Partial<GroupConfig> }) => {
    const { groupId, config } = params
    if (!groupId || !config || typeof config !== 'object') return error('无效的群组组配置')
    const configs = data.groupGroupConfig.get('configs') || {}
    configs[groupId] = config
    data.groupGroupConfig.set('configs', configs)
    await data.groupGroupConfig.flush()
    await applyGroupGroupConfigToGuilds(data, groupId)
    return success({ success: true })
  })

  /** 获取指定群的管理员列表 */
}
