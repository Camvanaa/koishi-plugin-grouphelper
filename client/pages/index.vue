<template>
  <k-layout class="grouphelper-app">
    <!-- 顶部导航 -->
    <div class="top-nav">
      <div class="nav-container">
        <!-- Logo 区域 -->
        <div class="logo-area">
          <span class="logo-text">GROUP HELPER</span>
          <span class="version-text">v0.3.6</span>
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
  { id: 'dashboard', label: '仪表盘', icon: 'grouphelper:dashboard' },
  { id: 'config', label: '群组配置', icon: 'grouphelper:config' },
  { id: 'warns', label: '警告记录', icon: 'grouphelper:warn' },
  { id: 'blacklist', label: '黑名单', icon: 'grouphelper:blacklist' },
  { id: 'roles', label: '角色权限', icon: 'grouphelper:roles' },
  { id: 'logs', label: '日志检索', icon: 'grouphelper:log' },
  { id: 'chat', label: '实时聊天', icon: 'grouphelper:chat' },
  { id: 'subscriptions', label: '订阅管理', icon: 'grouphelper:subscription' },
  { id: 'settings', label: '设置', icon: 'grouphelper:settings' },
]
</script>

<style scoped>
.grouphelper-app {
  background: var(--k-color-bg-1);
  height: 100vh;
  min-height: 0;
}

.top-nav {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--k-color-bg-2);
  border-bottom: 1px solid var(--k-color-border);
  height: 50px;
}

.nav-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
  height: 50px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.logo-area {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.logo-text {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.5px;
  color: var(--k-color-text);
}

.version-text {
  font-size: 11px;
  color: var(--k-color-text-description);
  opacity: 0.7;
}

.nav-tabs {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.nav-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  cursor: pointer;
  color: var(--k-color-text-description);
  border-bottom: 2px solid transparent;
  transition: color 0.15s ease, border-color 0.15s ease;
  margin-bottom: -1px;
}

.nav-tab:hover {
  color: var(--k-color-text);
}

.nav-tab.active {
  color: var(--k-color-active);
  border-bottom-color: var(--k-color-active);
  font-weight: 600;
}

.tab-icon {
  font-size: 14px;
  width: 14px;
  height: 14px;
}

.main-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  height: calc(100vh - 50px - 40px); /* 减去顶部导航和padding */
  overflow: hidden; /* 默认不滚动，让子组件自己管理滚动 */
  box-sizing: border-box;
}

/* 某些视图需要外层滚动 */
.main-content:has(.needs-scroll) {
  overflow: auto;
}

/* 默认隐藏外层滚动条，由子组件自行管理 */
</style>

<style>
/* 全局滚动条样式美化 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background-color: rgba(150, 150, 150, 0.3);
  border-radius: 4px;
  border: 2px solid transparent;
  background-clip: content-box;
}

::-webkit-scrollbar-thumb:hover {
  background-color: rgba(150, 150, 150, 0.5);
}
</style>