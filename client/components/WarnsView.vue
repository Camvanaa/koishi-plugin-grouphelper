<template>
  <div class="warns-view">
    <div class="view-header">
      <h2 class="view-title">警告记录</h2>
      <div class="header-actions">
        <div class="toggle-wrapper">
          <label>解析名称</label>
          <el-switch v-model="fetchNames" @change="refreshWarns" />
        </div>
        <k-button type="primary" @click="refreshWarns">
          <template #icon><k-icon name="refresh-cw" /></template>
          刷新
        </k-button>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <k-icon name="loader" class="spin" />
      <span>加载中...</span>
    </div>

    <!-- 警告列表 -->
    <div v-else class="warns-list">
      <div v-if="Object.keys(groupedWarns).length === 0" class="empty-state">
        <k-icon name="check-circle" class="empty-icon" />
        <p>暂无警告记录</p>
      </div>

      <div v-for="(groupWarns, guildId) in groupedWarns" :key="guildId" class="guild-card">
        <div class="guild-header" @click="toggleGuild(guildId as string)">
          <div class="guild-title">
            <k-icon name="users" />
            <span>{{ (groupWarns[0]?.guildName && groupWarns[0]?.guildName !== 'Unknown') ? `${groupWarns[0].guildName} (${guildId})` : guildId }}</span>
          </div>
          <div class="guild-status">
            <div class="guild-meta">{{ groupWarns.length }} 名成员有警告记录</div>
            <k-icon :name="expandedGuilds[guildId] ? 'chevron-up' : 'chevron-down'" />
          </div>
        </div>
        
        <div class="user-list" v-show="expandedGuilds[guildId]">
          <div
            v-for="item in groupWarns"
            :key="item.key"
            class="user-row"
          >
            <div class="user-info">
              <k-icon name="user" class="user-icon" />
              <div class="user-details">
                <div class="user-name">{{ item.userName !== 'Unknown' ? item.userName : '' }}</div>
                <div class="user-id">{{ item.userId }}</div>
              </div>
            </div>
            <div class="warn-control">
              <el-input-number 
                v-model="item.count" 
                :min="0" 
                size="small"
                @change="(val) => updateWarn(item, val)"
              />
              <span class="warn-time">{{ formatTime(item.timestamp) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { message } from '@koishijs/client'
import { warnsApi } from '../api'
import type { WarnRecord } from '../types'

const loading = ref(false)
const fetchNames = ref(false)

interface ProcessedWarn {
  key: string
  userId: string
  userName: string
  guildId: string
  guildName: string
  count: number
  timestamp: number
}

const groupedWarns = ref<Record<string, ProcessedWarn[]>>({})
const expandedGuilds = ref<Record<string, boolean>>({})

const toggleGuild = (guildId: string) => {
  expandedGuilds.value[guildId] = !expandedGuilds.value[guildId]
}

const refreshWarns = async () => {
  loading.value = true
  try {
    // API 现在返回 Enriched List
    const data = await warnsApi.list(fetchNames.value)
    const groups: Record<string, ProcessedWarn[]> = {}
    
    // @ts-ignore
    data.forEach(item => {
      if (!groups[item.guildId]) groups[item.guildId] = []
      groups[item.guildId].push(item)
    })
    
    groupedWarns.value = groups
  } catch (e: any) {
    message.error(e.message || '加载警告记录失败')
  } finally {
    loading.value = false
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

const getWarnLevel = (count: number) => {
  if (count >= 3) return 'danger'
  if (count >= 2) return 'warning'
  return 'normal'
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
.warns-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.view-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.toggle-wrapper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: var(--k-color-text);
}

.view-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--k-color-text);
  margin: 0;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 3rem;
  color: var(--k-color-text-description);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.warns-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.guild-card {
  background: var(--k-card-bg);
  border: 1px solid var(--k-color-border);
  border-radius: 8px;
  overflow: hidden;
}

.guild-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: var(--k-color-bg-2);
  border-bottom: 1px solid var(--k-color-border);
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s;
}

.guild-header:hover {
  background: var(--k-color-bg-1);
}

.guild-status {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.guild-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  color: var(--k-color-text);
}

.guild-meta {
  font-size: 0.8rem;
  color: var(--k-color-text-description);
}

.user-list {
  display: flex;
  flex-direction: column;
}

.user-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid var(--k-color-border);
  transition: background-color 0.2s;
}

.user-row:last-child {
  border-bottom: none;
}

.user-row:hover {
  background-color: var(--k-color-bg-1);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 200px;
}

.user-icon {
  color: var(--k-color-active);
}

.user-details {
  display: flex;
  flex-direction: column;
}

.user-name {
  font-weight: 500;
  font-size: 0.9rem;
  color: var(--k-color-text);
}

.user-id {
  font-family: monospace;
  font-size: 0.75rem;
  color: var(--k-color-text-description);
}

.warn-control {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.warn-time {
  color: var(--k-color-text-description);
  font-size: 0.85rem;
  margin-left: auto;
}

.warn-count {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 0.8rem;
  font-weight: 500;
}

.warn-count.normal {
  background: rgba(64, 158, 255, 0.1);
  color: #409eff;
}

.warn-count.warning {
  background: rgba(230, 162, 60, 0.1);
  color: #e6a23c;
}

.warn-count.danger {
  background: rgba(245, 108, 108, 0.1);
  color: #f56c6c;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  color: var(--k-color-text-description);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 1rem;
  opacity: 0.5;
  color: #67c23a;
}

/* 滚动条样式 */
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
  transition: background-color 0.3s;
}

::-webkit-scrollbar-thumb:hover {
  background-color: var(--k-color-text-description);
}

::-webkit-scrollbar-corner {
  background: transparent;
}
</style>