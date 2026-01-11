<template>
  <div class="warns-view">
    <!-- Header -->
    <div class="view-header">
      <h2 class="view-title">警告记录</h2>
      <div class="header-actions">
        <div class="toggle-wrapper">
          <span class="toggle-label">解析名称</span>
          <el-switch v-model="fetchNames" @change="refreshWarns" size="small" />
        </div>
        <div class="btn-group">
          <k-button @click="showAddDialog = true">
            <template #icon><k-icon name="plus" /></template>
            添加
          </k-button>
          <k-button @click="reloadWarns" :loading="reloading" title="从文件重新加载">
            <template #icon><k-icon name="database" /></template>
            重载
          </k-button>
          <k-button type="primary" @click="refreshWarns">
            <template #icon><k-icon name="refresh-cw" /></template>
            刷新
          </k-button>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      <k-icon name="loader" class="spin" />
      <span class="loading-text">加载中...</span>
    </div>

    <!-- Main Layout -->
    <div v-else-if="Object.keys(groupedWarns).length > 0" class="warns-layout">
      <!-- Sidebar -->
      <div class="sidebar">
        <div class="sidebar-header">
          <span class="sidebar-title">群组</span>
          <span class="sidebar-count">{{ Object.keys(groupedWarns).length }}</span>
        </div>
        <div class="sidebar-list">
          <div
            v-for="(groupWarns, guildId) in groupedWarns"
            :key="guildId"
            class="sidebar-item"
            :class="{ active: selectedGuildId === guildId }"
            @click="selectGuild(guildId as string)"
          >
            <div class="item-avatar">
              <img
                v-if="fetchNames && groupWarns[0].guildAvatar"
                :src="groupWarns[0].guildAvatar"
                class="guild-avatar"
                @error="(e) => (e.target as HTMLImageElement).style.display = 'none'"
              />
              <k-icon v-else name="users" />
            </div>
            <div class="item-content">
              <div class="item-name" :title="getGuildName(groupWarns[0])">
                {{ getGuildName(groupWarns[0]) }}
              </div>
              <div class="item-meta">
                <span class="meta-count">{{ groupWarns.length }}</span> 条记录
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Content -->
      <div class="content-area">
        <div v-if="selectedGuildId && groupedWarns[selectedGuildId]" class="group-detail">
          <div class="detail-header">
            <div class="detail-info">
              <h3 class="detail-name">{{ getGuildName(groupedWarns[selectedGuildId][0]) }}</h3>
              <code class="detail-id">{{ selectedGuildId }}</code>
            </div>
            <div class="detail-stats">
              <span class="stat-value">{{ groupedWarns[selectedGuildId].length }}</span>
              <span class="stat-label">条记录</span>
            </div>
          </div>

          <div class="user-list">
            <div class="list-header">
              <span class="col-user">用户</span>
              <span class="col-time">时间</span>
              <span class="col-action">操作</span>
            </div>
            <div
              v-for="item in groupedWarns[selectedGuildId]"
              :key="item.key"
              class="user-row"
            >
              <div class="user-info">
                <div class="user-avatar-wrap">
                  <img
                    v-if="fetchNames && item.userAvatar"
                    :src="item.userAvatar"
                    class="user-avatar"
                    @error="(e) => (e.target as HTMLImageElement).style.display = 'none'"
                  />
                  <k-icon v-else name="user" />
                </div>
                <div class="user-meta">
                  <span class="user-name">{{ item.userName !== 'Unknown' ? item.userName : '未知用户' }}</span>
                  <code class="user-id">{{ item.userId }}</code>
                </div>
              </div>

              <div class="warn-time">
                <code>{{ formatTime(item.timestamp) }}</code>
              </div>

              <div class="warn-control">
                <el-input-number
                  v-model="item.count"
                  :min="0"
                  size="small"
                  controls-position="right"
                  @change="(val) => updateWarn(item, val)"
                />
                <k-button size="small" type="danger" @click="updateWarn(item, 0)" title="清除">
                  <template #icon><k-icon name="trash-2" /></template>
                </k-button>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="empty-selection">
          <k-icon name="chevron-left" />
          <span>选择群组</span>
        </div>
      </div>
    </div>

    <!-- Empty -->
    <div v-else class="empty-state">
      <div class="empty-icon-wrap">
        <k-icon name="check-circle" />
      </div>
      <p class="empty-text">暂无警告记录</p>
    </div>

    <!-- Dialog -->
    <div v-if="showAddDialog" class="dialog-overlay" @click.self="showAddDialog = false">
      <div class="dialog-card">
        <div class="dialog-header">
          <h3>添加警告</h3>
          <button class="close-btn" @click="showAddDialog = false">
            <k-icon name="x" />
          </button>
        </div>
        <div class="dialog-body">
          <div class="form-group">
            <label class="form-label">群号</label>
            <input
              v-model="newWarn.guildId"
              type="text"
              placeholder="输入群号"
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label class="form-label">用户ID</label>
            <input
              v-model="newWarn.userId"
              type="text"
              placeholder="输入用户ID"
              class="form-input"
            />
          </div>
        </div>
        <div class="dialog-footer">
          <k-button @click="showAddDialog = false">取消</k-button>
          <k-button type="primary" @click="addWarn" :loading="adding">添加</k-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { message } from '@koishijs/client'
import { warnsApi } from '../api'
import type { WarnRecord } from '../types'

const loading = ref(false)
const adding = ref(false)
const reloading = ref(false)
const fetchNames = ref(true)
const showAddDialog = ref(false)
const selectedGuildId = ref<string>('')

const newWarn = reactive({
  guildId: '',
  userId: ''
})

interface ProcessedWarn {
  key: string
  userId: string
  userName: string
  userAvatar: string
  guildId: string
  guildName: string
  guildAvatar: string
  count: number
  timestamp: number
}

const groupedWarns = ref<Record<string, ProcessedWarn[]>>({})

const selectGuild = (guildId: string) => {
  selectedGuildId.value = guildId
}

const getGuildName = (item: ProcessedWarn | undefined) => {
  if (!item) return ''
  return (item.guildName && item.guildName !== 'Unknown') ? item.guildName : item.guildId
}

const refreshWarns = async () => {
  loading.value = true
  try {
    const data = await warnsApi.list(fetchNames.value)
    const groups: Record<string, ProcessedWarn[]> = {}
    
    // @ts-ignore
    data.forEach(item => {
      if (!groups[item.guildId]) groups[item.guildId] = []
      groups[item.guildId].push(item)
    })
    
    groupedWarns.value = groups
    
    // 如果当前选中的群组不在列表中（可能被清空了），或者还没选中，默认选中第一个
    const guildIds = Object.keys(groups)
    if (guildIds.length > 0) {
      if (!selectedGuildId.value || !groups[selectedGuildId.value]) {
        selectedGuildId.value = guildIds[0]
      }
    } else {
      selectedGuildId.value = ''
    }
    
  } catch (e: any) {
    message.error(e.message || '加载警告记录失败')
  } finally {
    loading.value = false
  }
}

const reloadWarns = async () => {
  reloading.value = true
  try {
    await warnsApi.reload()
    message.success('警告数据已重新加载')
    await refreshWarns()
  } catch (e: any) {
    message.error(e.message || '重新加载失败')
  } finally {
    reloading.value = false
  }
}

const addWarn = async () => {
  if (!newWarn.guildId.trim() || !newWarn.userId.trim()) {
    message.warning('请输入群号和用户ID')
    return
  }

  adding.value = true
  try {
    await warnsApi.add(newWarn.guildId, newWarn.userId)
    message.success('添加成功')
    showAddDialog.value = false
    
    // 自动切换到新添加的群组
    const targetGuildId = newWarn.guildId
    newWarn.guildId = ''
    newWarn.userId = ''
    
    await refreshWarns()
    selectedGuildId.value = targetGuildId
    
  } catch (e: any) {
    message.error(e.message || '添加失败')
  } finally {
    adding.value = false
  }
}

const updateWarn = async (item: ProcessedWarn, count: number | undefined) => {
  if (count === undefined) return
  try {
    await warnsApi.update(item.key, count)
    if (count <= 0) {
      message.success('警告已清除')
      await refreshWarns()
    }
  } catch (e: any) {
    message.error(e.message || '更新警告失败')
    await refreshWarns() 
  }
}

const formatTime = (timestamp: number | undefined) => {
  if (!timestamp) return '未知'
  return new Date(timestamp).toLocaleString('zh-CN')
}

onMounted(() => {
  refreshWarns()
})
</script>

<style scoped>
/* ============================================
   GitHub Dimmed Style - Professional & Minimal
   使用 Koishi 全局 CSS 变量
   ============================================ */

.warns-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif;
}

/* Header */
.view-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--k-color-divider);
  flex-shrink: 0;
}

.view-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--fg1);
  margin: 0;
  letter-spacing: -0.25px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.toggle-wrapper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--fg3);
  margin-right: 0.75rem;
  padding-right: 0.75rem;
  border-right: 1px solid var(--k-color-divider);
}

.toggle-label {
  font-weight: 500;
  letter-spacing: 0.01em;
}

.btn-group {
  display: flex;
  gap: 0.5rem;
}

/* Header Buttons Override */
.header-actions :deep(.k-button) {
  font-size: 0.75rem;
  padding: 0.375rem 0.625rem;
  border-radius: 6px;
  border: 1px solid var(--k-color-divider);
  background: var(--bg3);
  color: var(--fg2);
  font-weight: 500;
  transition: all 0.15s ease;
}

.header-actions :deep(.k-button:hover) {
  background: var(--bg2);
  border-color: var(--k-color-border);
  color: var(--fg1);
}

.header-actions :deep(.k-button.primary),
.header-actions :deep(.k-button[type="primary"]) {
  background: var(--k-color-primary-fade);
  border-color: var(--k-color-primary-tint);
  color: var(--k-color-primary);
}

.header-actions :deep(.k-button.primary:hover),
.header-actions :deep(.k-button[type="primary"]:hover) {
  background: rgba(116, 89, 255, 0.25);
  border-color: rgba(116, 89, 255, 0.5);
}

.header-actions :deep(.k-icon) {
  font-size: 14px;
}

/* El-Switch Override */
.toggle-wrapper :deep(.el-switch) {
  --el-switch-on-color: var(--k-color-primary);
  --el-switch-off-color: var(--bg3);
  --el-switch-border-color: var(--k-color-border);
  height: 18px;
}

.toggle-wrapper :deep(.el-switch__core) {
  min-width: 32px;
  height: 18px;
  border-radius: 9px;
  border: 1px solid var(--k-color-border);
}

.toggle-wrapper :deep(.el-switch__core .el-switch__action) {
  width: 14px;
  height: 14px;
}

/* Main Layout */
.warns-layout {
  display: flex;
  flex: 1;
  border: 1px solid var(--k-color-divider);
  border-radius: 6px;
  background: var(--bg2);
  overflow: hidden;
  height: 0;
}

/* Sidebar */
.sidebar {
  width: 260px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--k-color-divider);
  background: var(--bg1);
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--k-color-divider);
}

.sidebar-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--fg2);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.sidebar-count {
  font-size: 11px;
  font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  color: var(--fg3);
  background: var(--bg3);
  padding: 2px 6px;
  border-radius: 4px;
}

.sidebar-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px;
}

.sidebar-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.15s ease;
  margin-bottom: 1px;
  border: 1px solid transparent;
}

.sidebar-item:hover {
  background: var(--bg3);
}

.sidebar-item.active {
  background: var(--k-color-primary-fade);
  border-color: var(--k-color-primary);
}

.item-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--bg3);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--fg3);
  flex-shrink: 0;
  overflow: hidden;
}

.guild-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
}

.item-content {
  flex: 1;
  min-width: 0;
}

.item-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--fg1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-item.active .item-name {
  color: var(--k-color-primary-tint);
}

.item-meta {
  font-size: 11px;
  color: var(--fg3);
  margin-top: 1px;
}

.meta-count {
  font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  color: var(--fg2);
}

/* Content Area */
.content-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--bg2);
  min-width: 0;
}

.group-detail {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--k-color-divider);
  background: var(--bg1);
}

.detail-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.detail-name {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--fg1);
}

.detail-id {
  font-size: 11px;
  font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  color: var(--fg3);
  background: transparent;
}

.detail-stats {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.stat-value {
  font-size: 20px;
  font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  font-weight: 600;
  color: var(--fg1);
}

.stat-label {
  font-size: 12px;
  color: var(--fg3);
}

/* User List */
.user-list {
  flex: 1;
  overflow-y: auto;
}

.list-header {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  font-size: 11px;
  font-weight: 600;
  color: var(--fg3);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 1px solid var(--k-color-divider);
  background: var(--bg1);
  position: sticky;
  top: 0;
}

.col-user {
  width: 220px;
}

.col-time {
  flex: 1;
}

.col-action {
  width: 160px;
  text-align: right;
}

.user-row {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  border-bottom: 1px solid var(--k-color-divider);
  transition: background-color 0.15s ease;
}

.user-row:hover {
  background: var(--bg3);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 220px;
}

.user-avatar-wrap {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--bg3);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--fg3);
  flex-shrink: 0;
  overflow: hidden;
}

.user-avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

.user-meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 1px;
}

.user-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--fg1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-id {
  font-size: 11px;
  font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  color: var(--fg3);
  background: transparent;
}

.warn-time {
  flex: 1;
}

.warn-time code {
  font-size: 12px;
  font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  color: var(--fg2);
  background: transparent;
}

.warn-control {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 160px;
  justify-content: flex-end;
}

/* Scrollbar */
.sidebar-list::-webkit-scrollbar,
.user-list::-webkit-scrollbar {
  width: 6px;
}

.sidebar-list::-webkit-scrollbar-track,
.user-list::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar-list::-webkit-scrollbar-thumb,
.user-list::-webkit-scrollbar-thumb {
  background-color: var(--bg3);
  border-radius: 3px;
}

.sidebar-list::-webkit-scrollbar-thumb:hover,
.user-list::-webkit-scrollbar-thumb:hover {
  background-color: var(--fg3);
}

/* States */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
}

.loading-text {
  font-size: 13px;
  color: var(--fg3);
}

.spin {
  animation: spin 1s linear infinite;
  color: var(--fg3);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-state,
.empty-selection {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 8px;
  color: var(--fg3);
}

.empty-icon-wrap {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: var(--k-color-success-fade);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--k-color-success);
}

.empty-text {
  font-size: 13px;
  margin: 0;
}

.empty-selection {
  flex-direction: row;
  gap: 6px;
  font-size: 13px;
}

/* Dialog */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog-card {
  background: var(--bg2);
  border: 1px solid var(--k-color-divider);
  border-radius: 6px;
  width: 90%;
  max-width: 380px;
  overflow: hidden;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--k-color-divider);
  background: var(--bg1);
}

.dialog-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--fg1);
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  color: var(--fg3);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.15s ease;
}

.close-btn:hover {
  color: var(--fg1);
  background: var(--bg3);
}

.dialog-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--fg2);
}

.form-input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--k-color-divider);
  border-radius: 6px;
  background: var(--bg1);
  color: var(--fg1);
  font-family: inherit;
  font-size: 13px;
  box-sizing: border-box;
  transition: border-color 0.15s ease;
}

.form-input::placeholder {
  color: var(--fg3);
}

.form-input:focus {
  outline: none;
  border-color: var(--k-color-primary);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--k-color-divider);
  background: var(--bg1);
}

/* Dialog Footer Buttons Override */
.dialog-footer :deep(.k-button) {
  font-size: 0.75rem;
  padding: 0.375rem 0.75rem;
  border-radius: 6px;
  border: 1px solid var(--k-color-divider);
  background: var(--bg3);
  color: var(--fg2);
  font-weight: 500;
  transition: all 0.15s ease;
}

.dialog-footer :deep(.k-button:hover) {
  background: var(--k-card-bg);
  border-color: var(--k-color-border);
  color: var(--fg1);
}

.dialog-footer :deep(.k-button[type="primary"]) {
  background: var(--k-color-primary-fade);
  border-color: var(--k-color-primary-tint);
  color: var(--k-color-primary);
}

.dialog-footer :deep(.k-button[type="primary"]:hover) {
  background: rgba(116, 89, 255, 0.25);
  border-color: rgba(116, 89, 255, 0.5);
}

/* El-InputNumber Override */
.warn-control :deep(.el-input-number) {
  width: 90px;
}

.warn-control :deep(.el-input__wrapper) {
  background: var(--bg1);
  border: 1px solid var(--k-color-divider);
  border-radius: 4px;
  box-shadow: none;
}

.warn-control :deep(.el-input__wrapper:hover) {
  border-color: var(--k-color-border);
}

.warn-control :deep(.el-input__wrapper.is-focus) {
  border-color: var(--k-color-primary) !important;
}

.warn-control :deep(.el-input__inner) {
  color: var(--fg1);
  font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  font-size: 12px;
}

.warn-control :deep(.el-input-number__decrease),
.warn-control :deep(.el-input-number__increase) {
  background: var(--bg2);
  border-color: var(--k-color-divider);
  color: var(--fg2);
}

.warn-control :deep(.el-input-number__decrease:hover),
.warn-control :deep(.el-input-number__increase:hover) {
  color: var(--k-color-primary);
}

/* Row Delete Button */
.warn-control :deep(.k-button) {
  font-size: 0.6875rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--k-color-danger);
  font-weight: 500;
  transition: all 0.15s ease;
}

.warn-control :deep(.k-button:hover) {
  background: var(--k-color-danger-fade);
  border-color: var(--k-color-danger);
}

.warn-control :deep(.k-icon) {
  font-size: 12px;
}
</style>