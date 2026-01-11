import { Context, icons } from '@koishijs/client'

import Index from './pages/index.vue'
import GroupIcon from './icons/group.vue'
import LogoIcon from './icons/logo.vue'
import { icons as customIcons, Octicons } from './icons'

// 注册自定义图标
icons.register('grouphelper', GroupIcon)
icons.register('grouphelper:logo', LogoIcon)
icons.register('grouphelper:dashboard', customIcons.dashboard)
icons.register('grouphelper:config', customIcons.config)
icons.register('grouphelper:warn', customIcons.warn)
icons.register('grouphelper:blacklist', customIcons.blacklist)
icons.register('grouphelper:log', customIcons.log)
icons.register('grouphelper:subscription', customIcons.subscription)
icons.register('grouphelper:settings', customIcons.settings)
icons.register('grouphelper:chat', customIcons.chat)
icons.register('grouphelper:npm', customIcons.npm)
icons.register('grouphelper:box', customIcons.box)
icons.register('grouphelper:activity', customIcons.activity)
icons.register('grouphelper:git-branch', customIcons.gitBranch)
icons.register('grouphelper:roles', GroupIcon)
// stat 组件常用图标
icons.register('grouphelper:users', customIcons.users)
icons.register('grouphelper:ban', customIcons.ban)
icons.register('grouphelper:bell', customIcons.bell)
icons.register('grouphelper:alert-triangle', customIcons.alertTriangle)
icons.register('grouphelper:user-x', customIcons.userX)
icons.register('grouphelper:user-minus', customIcons.userMinus)
icons.register('grouphelper:shield', customIcons.shield)
icons.register('grouphelper:shield-alert', customIcons.shieldAlert)
icons.register('grouphelper:rss', customIcons.rss)
icons.register('grouphelper:user', customIcons.user)
icons.register('grouphelper:bar-chart-2', customIcons.barChart2)
icons.register('grouphelper:trending-up', customIcons.trendingUp)
icons.register('grouphelper:clock', customIcons.clock)

// 注册所有 GitHub Octicons 图标
// 使用方式: <k-icon name="grouphelper:octicons.tag" />
for (const [name, component] of Object.entries(Octicons.getAll())) {
  icons.register(`grouphelper:octicons.${name}`, component)
}

// 为了兼容，mark 现在指向 octicons.tag
icons.register('grouphelper:mark', Octicons.create('tag'))

export default (ctx: Context) => {
  ctx.page({
    name: '群管助手',
    path: '/grouphelper',
    icon: 'grouphelper',
    component: Index,
    order: 500,
    authority: 4, // 设置默认权限等级为 4
  })
}
