import { Context } from 'koishi'
import type {} from '@koishijs/plugin-console'
import { GroupHelperService } from '../services/grouphelper.service'
import type { ListenerRegistrar } from './api-utils'
import { success } from './api-utils'
import { getReplyCatalog } from '../i18n/replies'

export function registerRepliesAPI(
  ctx: Context,
  service: GroupHelperService,
  addListener: ListenerRegistrar
) {
  addListener('grouphelper/replies/catalog', async () => {
    return success(getReplyCatalog())
  })
}
