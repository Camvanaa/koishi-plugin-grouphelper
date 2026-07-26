/**
 * 插件设置 API
 */
import { Context } from 'koishi'
import type {} from '@koishijs/plugin-console'
import { GroupHelperService } from '../services/grouphelper.service'
import type { ListenerRegistrar } from './api-utils'
import { success, error, redactSecrets, restoreSecrets } from './api-utils'

export function registerSettingsAPI(
  ctx: Context,
  service: GroupHelperService,
  addListener: ListenerRegistrar
) {
  const data = service.data

  // ===== 设置 API =====

  /** 获取插件设置 */
  addListener('grouphelper/settings/get', async () => {
    // 获取当前设置（机密字段以占位符下发）
    return success(redactSecrets(service.settings.settings))
  })

  /** 更新插件设置 */
  addListener('grouphelper/settings/update', async (params: { settings: any }) => {
    try {
      const { settings } = params

      // 检查 settings 是否有效
      if (!settings || typeof settings !== 'object') {
        return error('无效的设置数据')
      }

      // 更新设置（还原前端回传的机密占位符）
      await service.settings.update(restoreSecrets(settings, service.settings.settings))

      ctx.logger('grouphelper').info('设置已更新')
      return success({ success: true })
    } catch (e) {
      ctx.logger('grouphelper').error('更新设置失败:', e)
      return error(e instanceof Error ? e.message : '更新设置失败')
    }
  })

  /** 重置插件设置 */
  addListener('grouphelper/settings/reset', async () => {
    try {
      await service.settings.reset()
      ctx.logger('grouphelper').info('设置已重置为默认值')
      return success({ success: true })
    } catch (e) {
      ctx.logger('grouphelper').error('重置设置失败:', e)
      return error(e instanceof Error ? e.message : '重置设置失败')
    }
  })
}
