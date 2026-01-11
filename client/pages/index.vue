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
        <!-- 导航标签 -->
        <div class="nav-tabs">
          <div
            v-for="item in menuItems"
            :key="item.id"
            class="nav-tab"
            :class="{ active: currentView === item.id }"
            @click="currentView = item.id"
          >
            <k-icon :name="item.icon" class="tab-icon" />
            <span>{{ item.label }}</span>
          </div>
        </div>
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
   ======================================== */

.grouphelper-app {
  background: var(--bg1, #1e1e20);
  height: 100vh;
  min-height: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif;
}

/* 顶部导航 - 更紧凑 */
.top-nav {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--bg2, #252529);
  border-bottom: 1px solid var(--k-color-divider, rgba(82, 82, 89, 0.5));
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
  color: var(--fg1, rgba(255, 255, 245, 0.9));
  text-transform: uppercase;
}

.version-text {
  font-size: 10px;
  font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  color: var(--fg3, rgba(255, 255, 245, 0.4));
  background: var(--bg3, #313136);
  padding: 1px 5px;
  border-radius: 3px;
  border: 1px solid var(--k-color-divider, rgba(82, 82, 89, 0.5));
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
  color: var(--fg3, rgba(255, 255, 245, 0.4));
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.12s ease;
}

.nav-tab:hover {
  color: var(--fg2, rgba(255, 255, 245, 0.6));
  background: var(--bg3, #313136);
}

.nav-tab.active {
  color: var(--fg1, rgba(255, 255, 245, 0.9));
  background: var(--bg3, #313136);
  border: 1px solid var(--k-color-divider, rgba(82, 82, 89, 0.5));
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
</style>

<style>
/* 隐藏 Koishi 控制台自带的 layout-header */
.grouphelper-app .layout-header {
  display: none !important;
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
  background-color: rgba(110, 118, 129, 0.3);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background-color: rgba(110, 118, 129, 0.5);
}

::-webkit-scrollbar-corner {
  background: transparent;
}

/* ========================================
   全局动画规范 - 平衡设计
   ========================================

   原则：
   1. 交互反馈 (hover/focus) - 快速响应 0.12s-0.15s
   2. 状态切换 (toggle/select) - 中等速度 0.15s-0.2s
   3. 入场动画 - 仅用于重要元素，适度克制
   4. 避免 - 过长延迟、弹跳效果、过度位移
*/

/* 统一的过渡时间变量 */
:root {
  --transition-fast: 0.12s ease;
  --transition-normal: 0.15s ease;
  --transition-slow: 0.2s ease;
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