import { h } from 'vue'

/**
 * 创建 SVG 图标组件 (fill 模式)
 * @param pathData SVG path 的 d 属性值
 * @returns Vue 函数式组件
 */
export const createIcon = (pathData: string) => {
  return () => h('svg', { viewBox: '0 0 24 24', fill: 'currentColor', width: '1em', height: '1em' }, [
    h('path', { d: pathData })
  ])
}

/**
 * 创建 SVG 图标组件 (stroke 模式)
 * @param pathData SVG path 的 d 属性值
 * @returns Vue 函数式组件
 */
export const createStrokeIcon = (pathData: string) => {
  return () => h('svg', { viewBox: '0 0 24 24', fill: 'none', width: '1em', height: '1em' }, [
    h('path', {
      d: pathData,
      stroke: 'currentColor',
      'stroke-width': '1.5',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round'
    })
  ])
}

export const iconPaths = {
  // 仪表盘: 类似 grid/dashboard
  dashboard: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',

  // 配置: 齿轮
  config: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.58 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',

  // 黑名单: 用户+禁止
  blacklist: 'M12 2a5 5 0 1 0 5 5 5 5 0 0 0-5-5zm0 8a3 3 0 1 1 3-3 3 3 0 0 1-3 3zm9 11v-1a7 7 0 0 0-7-7h-4a7 7 0 0 0-7 7v1h2v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1z',

  // 日志: 文件/列表
  log: 'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z',

  // 设置: 滑块调节
  settings: 'M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z',

  // 订阅: 铃铛
  subscription: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9m-4.27 13a2 2 0 0 1-3.46 0',

  // 聊天: 消息气泡
  chat: 'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z',

  // NPM Logo 形状 (简化版)
  npm: 'M1.763 0C.786 0 0 .786 0 1.763v20.474C0 23.214.786 24 1.763 24h20.474c.977 0 1.763-.786 1.763-1.763V1.763C24 .786 23.214 0 22.237 0zM5.13 5.323l13.837.019-.009 13.836h-3.464l.01-10.382h-3.456L12.04 19.17H5.129z',

  // 盒子 (当前版本)
  box: 'M21 16.5c0 .38-.21.71-.53.88l-7.9 4.44c-.16.12-.36.18-.57.18s-.41-.06-.57-.18l-7.9-4.44A.991.991 0 0 1 3 16.5v-9c0-.38.21-.71.53-.88l7.9-4.44c.16-.12.36-.18.57-.18s.41.06.57.18l7.9 4.44c.32.17.53.5.53.88v9M12 4.15L6.04 7.5L12 10.85l5.96-3.35L12 4.15M5 15.91l6 3.38v-6.71L5 9.21v6.7m14 0v-6.7l-6 3.37v6.71l6-3.38z',

  // 活动 (更新日志) - 简洁版
  activity: 'M13 2.05v3.03c3.39.49 6 3.39 6 6.92 0 .9-.18 1.75-.5 2.54l2.63 1.53c.56-1.24.87-2.6.87-4.07 0-5.53-4.48-10-10-10M12 19c-3.87 0-7-3.13-7-7 0-3.53 2.61-6.43 6-6.92V2.05c-5.06.5-9 4.76-9 9.95 0 5.52 4.47 10 9.99 10 3.31 0 6.24-1.61 8.06-4.09l-2.6-1.53C16.17 17.98 14.21 19 12 19M12 8v5l4.25 2.52.77-1.28-3.52-2.09V8z',

  // 分支 (Dev) - 简洁版
  gitBranch: 'M19 18a3 3 0 0 0-2.94-2.48c-.06 0-.11.02-.17.03l-4.52-6.52A2.99 2.99 0 0 0 10 6.07V4a3 3 0 1 0-2 0v13.93a3 3 0 1 0 2 0v-2.1c.54-.35.96-.86 1.18-1.46l4.23 6.1c-.02.06-.04.12-.04.18a3 3 0 1 0 3.63-2.65M7 4a1 1 0 1 1 1 1 1 1 0 0 1-1-1m2 14.88a1.01 1.01 0 0 1-1-1A1 1 0 1 1 9 19c0-.04 0-.08-.01-.12M19 20a1 1 0 1 1-1-1 1 1 0 0 1 1 1z'
}

// stroke 类型的图标路径
export const strokePaths = {
  // 警告: 圆形感叹号
  warn: 'M12 16.99V17M12 7V14M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z',

  // 用户组 (Lucide users)
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',

  // 禁止 (Lucide ban)
  ban: 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM4.93 4.93l14.14 14.14',

  // 铃铛 (Lucide bell)
  bell: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0',

  // 警告三角形 (Lucide alert-triangle)
  alertTriangle: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',

  // 用户X (Lucide user-x)
  userX: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM17 8l5 5M22 8l-5 5',

  // 用户减 (Lucide user-minus)
  userMinus: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM17 11h5',

  // 盾牌 (Lucide shield)
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',

  // 盾牌警告 (Lucide shield-alert)
  shieldAlert: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM12 8v4M12 16h.01',

  // RSS (Lucide rss)
  rss: 'M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16M5 19a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',

  // 用户 (Lucide user)
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',

  // 柱状图 (Lucide bar-chart-2)
  barChart2: 'M18 20V10M12 20V4M6 20v-6',

  // 趋势 (Lucide trending-up)
  trendingUp: 'M23 6l-9.5 9.5-5-5L1 18 M17 6h6v6',

  // 时钟 (Lucide clock)
  clock: 'M21 12a9 9 0 1 1-9-9 9 9 0 0 1 9 9z M12 6v6l4 2'
}

export const icons = {
  dashboard: createIcon(iconPaths.dashboard),
  config: createIcon(iconPaths.config),
  warn: createStrokeIcon(strokePaths.warn),
  blacklist: createIcon(iconPaths.blacklist),
  log: createIcon(iconPaths.log),
  subscription: createIcon(iconPaths.subscription),
  settings: createIcon(iconPaths.settings),
  chat: createIcon(iconPaths.chat),
  npm: createIcon(iconPaths.npm),
  box: createIcon(iconPaths.box),
  activity: createIcon(iconPaths.activity),
  gitBranch: createIcon(iconPaths.gitBranch),
  // stat 组件常用图标
  users: createStrokeIcon(strokePaths.users),
  ban: createStrokeIcon(strokePaths.ban),
  bell: createStrokeIcon(strokePaths.bell),
  alertTriangle: createStrokeIcon(strokePaths.alertTriangle),
  userX: createStrokeIcon(strokePaths.userX),
  userMinus: createStrokeIcon(strokePaths.userMinus),
  shield: createStrokeIcon(strokePaths.shield),
  shieldAlert: createStrokeIcon(strokePaths.shieldAlert),
  rss: createStrokeIcon(strokePaths.rss),
  user: createStrokeIcon(strokePaths.user),
  barChart2: createStrokeIcon(strokePaths.barChart2),
  trendingUp: createStrokeIcon(strokePaths.trendingUp),
  clock: createStrokeIcon(strokePaths.clock)
}