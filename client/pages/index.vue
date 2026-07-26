<template>
  <k-layout class="grouphelper-app">
    <!-- 顶部导航 -->
    <div class="top-nav">
      <div class="nav-container">
        <!-- Logo 区域 -->
        <div class="logo-area">
          <span class="logo-text">GROUP HELPER</span>
          <span class="version-text">v{{ pkg.version }}</span>
        </div>
        <!-- 移动端菜单按钮 -->
        <button class="mobile-menu-btn" @click="mobileMenuOpen = !mobileMenuOpen">
          <k-icon :name="mobileMenuOpen ? 'grouphelper:octicons.x' : 'grouphelper:octicons.three-bars'" />
        </button>
        <!-- 导航标签 -->
        <div class="nav-tabs" :class="{ open: mobileMenuOpen }">
          <div
            v-for="item in menuItems"
            :key="item.id"
            class="nav-tab"
            :class="{ active: currentView === item.id }"
            @click="selectView(item.id)"
          >
            <k-icon :name="item.icon" class="tab-icon" />
            <span>{{ item.label }}</span>
          </div>
        </div>
        <!-- 移动端菜单遮罩 -->
        <div class="mobile-menu-overlay" v-if="mobileMenuOpen" @click="mobileMenuOpen = false"></div>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="main-content">
      <keep-alive>
        <component :is="activeComponent" @change-view="currentView = $event" />
      </keep-alive>
    </div>
  </k-layout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import pkg from '../../package.json'
import DashboardView from '../components/DashboardView.vue'
import ConfigView from '../components/ConfigView.vue'
import WarnsView from '../components/WarnsView.vue'
import BlacklistView from '../components/BlacklistView.vue'
import LogsView from '../components/LogsView.vue'
import SubscriptionView from '../components/SubscriptionView.vue'
import SettingsView from '../components/SettingsView.vue'
import ChatView from '../components/ChatView.vue'
import RolesView from '../components/RolesView.vue'

const currentView = ref('dashboard')
const mobileMenuOpen = ref(false)

const selectView = (id: string) => {
  currentView.value = id
  mobileMenuOpen.value = false
}

const activeComponent = computed(() => {
  switch (currentView.value) {
    case 'dashboard': return DashboardView
    case 'config': return ConfigView
    case 'warns': return WarnsView
    case 'blacklist': return BlacklistView
    case 'roles': return RolesView
    case 'logs': return LogsView
    case 'chat': return ChatView
    case 'subscriptions': return SubscriptionView
    case 'settings': return SettingsView
    default: return DashboardView
  }
})

const menuItems = [
  { id: 'dashboard', label: '仪表盘', icon: 'grouphelper:octicons.apps' },
  { id: 'config', label: '群组配置', icon: 'grouphelper:octicons.tools' },
  { id: 'warns', label: '警告记录', icon: 'grouphelper:octicons.warning' },
  { id: 'blacklist', label: '黑名单', icon: 'grouphelper:octicons.personadd' },
  { id: 'roles', label: '角色权限', icon: 'grouphelper:octicons.people' },
  { id: 'logs', label: '日志检索', icon: 'grouphelper:octicons.log' },
  { id: 'chat', label: '实时聊天', icon: 'grouphelper:octicons.discussion' },
  { id: 'subscriptions', label: '订阅管理', icon: 'grouphelper:octicons.sub' },
  { id: 'settings', label: '设置', icon: 'grouphelper:octicons.gear' },
]
</script>

<style scoped>
/* ========================================
   GitHub Dimmed / Vercel 风格主布局
   使用 Koishi 全局 CSS 变量
   ======================================== */

.grouphelper-app {
  background: var(--bg1);
  height: 100vh;
  height: 100dvh;
  min-height: 0;
  font-family: var(--gh-font-sans, -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif);
}

/* 顶部导航 - 紧凑专业 */
.top-nav {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--k-card-bg);
  border-bottom: 1px solid var(--k-color-divider);
  height: 48px;
}

.nav-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 16px;
  height: 48px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-area {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.logo-text {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.3px;
  color: var(--fg1);
  text-transform: uppercase;
}

/* 版本号 - 等宽字体 */
.version-text {
  font-size: 10px;
  font-family: var(--gh-font-mono, 'JetBrains Mono', 'SF Mono', Consolas, monospace);
  color: var(--fg3);
  background: var(--bg3);
  padding: 1px 5px;
  border-radius: 3px;
  border: 1px solid var(--k-color-divider);
}

.nav-tabs {
  display: flex;
  gap: 2px;
  margin-left: auto;
}

.nav-tab {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 10px;
  cursor: pointer;
  color: var(--fg3);
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  transition: color 0.12s ease, background-color 0.12s ease;
  border: 1px solid transparent;
}

.nav-tab:hover {
  color: var(--fg2);
  background: var(--bg3);
}

.nav-tab.active {
  color: var(--fg1);
  background: var(--bg3);
  border-color: var(--k-color-divider);
}

.tab-icon {
  font-size: 14px;
  width: 14px;
  height: 14px;
  opacity: 0.8;
}

.main-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 16px;
  height: calc(100vh - 48px);
  overflow: hidden;
  box-sizing: border-box;
}

.main-content:has(.needs-scroll) {
  overflow: auto;
}

/* 移动端菜单按钮 - 默认隐藏 */
.mobile-menu-btn {
  display: none;
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  color: var(--fg2);
  cursor: pointer;
  border-radius: 6px;
  margin-left: auto;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  transition: background 0.15s ease;
}

.mobile-menu-btn:hover {
  background: var(--bg3);
}

/* 移动端菜单遮罩 - 默认隐藏 */
.mobile-menu-overlay {
  display: none;
}

/* ========================================
   移动端适配 (< 768px)
   ======================================== */
@media (max-width: 768px) {
  .top-nav {
    height: 52px;
  }

  .nav-container {
    height: 52px;
    padding: 0 12px;
    position: relative;
  }

  .logo-text {
    font-size: 12px;
  }

  .version-text {
    font-size: 9px;
    padding: 1px 4px;
  }

  .mobile-menu-btn {
    display: flex;
  }

  /* 移动端菜单 - 抽屉式 */
  .nav-tabs {
    display: flex;
    position: fixed;
    top: 52px;
    right: -260px;
    width: 240px;
    height: calc(100vh - 52px);
    background: var(--k-card-bg);
    border-left: 1px solid var(--k-color-divider);
    flex-direction: column;
    gap: 2px;
    padding: 8px;
    z-index: 100;
    transition: right 0.25s ease;
    overflow-y: auto;
    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.3);
  }

  .nav-tabs.open {
    right: 0;
  }

  .nav-tab {
    padding: 12px 14px;
    font-size: 14px;
    border-radius: 6px;
  }

  .nav-tab .tab-icon {
    font-size: 16px;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  /* 遮罩层 */
  .mobile-menu-overlay {
    display: block;
    position: fixed;
    top: 52px;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 99;
    animation: fadeIn 0.2s ease;
  }

  .main-content {
    /* 移动端：内容区必须是"有界高度 + 自身滚动"（issue #34-2）。
       k-layout 的祖先容器均为 overflow:hidden，height:auto 无法形成滚动；
       需扣除移动端恢复显示的 Koishi layout-header（--header-height）与本页 52px 顶部导航；
       100dvh 适配移动端浏览器地址栏收缩 */
    height: calc(100vh - 52px - var(--header-height, 3rem));
    height: calc(100dvh - 52px - var(--header-height, 3rem));
    padding: 12px;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
}

/* 小屏手机适配 (< 480px) */
@media (max-width: 480px) {
  .logo-text {
    font-size: 11px;
    letter-spacing: 0.2px;
  }

  .version-text {
    display: none;
  }

  .main-content {
    padding: 8px;
  }

  .nav-tabs {
    width: 200px;
    right: -220px;
  }

  .nav-tabs.open {
    right: 0;
  }
}
</style>

<style>
/* 隐藏 Koishi 控制台自带的 layout-header —— 仅在桌面端隐藏；
   移动端必须保留：其中的菜单按钮是切换回控制台其他页面的唯一入口（issue #34-1）。
   使用 not (max-width) 与移动端断点严格互补，避免 768~769px 小数宽度出现双头部 */
@media not all and (max-width: 768px) {
  .grouphelper-app .layout-header {
    display: none !important;
  }
}

/* 全局滚动条样式 - GitHub 风格 */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background-color: var(--k-color-border);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background-color: var(--fg3);
}

::-webkit-scrollbar-corner {
  background: transparent;
}

/* ========================================
   全局动画规范 - 克制平衡
   ======================================== */

/* 统一的过渡时间变量 */
:root {
  --gh-transition-fast: 0.12s ease;
  --gh-transition-normal: 0.15s ease;
  --gh-transition-slow: 0.2s ease;
}

/* 减少运动偏好支持 */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* 统一的入场动画 - 简洁版本 */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes fadeInSubtle {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 统一的加载动画 */
@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 统一的骨架屏动画 */
@keyframes skeleton-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.7; }
}
</style>