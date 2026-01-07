import { Context, icons } from '@koishijs/client'

import Index from './pages/index.vue'
import GroupIcon from './icons/group.vue'
import { icons as customIcons } from './icons'

// 注册自定义图标
icons.register('grouphelper', GroupIcon)
icons.register('grouphelper:dashboard', customIcons.dashboard)
icons.register('grouphelper:config', customIcons.config)
icons.register('grouphelper:warn', customIcons.warn)
icons.register('grouphelper:blacklist', customIcons.blacklist)
icons.register('grouphelper:log', customIcons.log)
icons.register('grouphelper:subscription', customIcons.subscription)
icons.register('grouphelper:settings', customIcons.settings)

export default (ctx: Context) => {
  ctx.page({
    name: '群管助手',
    path: '/grouphelper',
    icon: 'grouphelper',
    component: Index,
    order: 500,
  })
}