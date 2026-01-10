<template>
  <div class="logs-view">
    <div class="view-header">
      <h2 class="view-title">日志检索</h2>
      <div class="header-actions">
        <k-button type="primary" @click="refreshLogs">
          <template #icon><k-icon name="search" /></template>
          搜索
        </k-button>
      </div>
    </div>

    <!-- 搜索栏 -->
    <div class="search-bar">
      <div class="search-item">
        <label>时间范围</label>
        <el-date-picker
          v-model="dateRange"
          type="datetimerange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          value-format="x"
          size="default"
        />
      </div>
      <div class="search-item">
        <label>命令</label>
        <el-input v-model="searchParams.command" placeholder="搜索命令..." clearable />
      </div>
      <div class="search-item">
        <label>用户ID</label>
        <el-input v-model="searchParams.userId" placeholder="搜索用户ID..." clearable />
      </div>
      <div class="search-item">
        <label>用户名</label>
        <el-input v-model="searchParams.username" placeholder="搜索用户名..." clearable />
      </div>
      <div class="search-item">
        <label>群组ID</label>
        <el-input v-model="searchParams.guildId" placeholder="搜索群组ID..." clearable />
      </div>
      <div class="search-item">
        <label>详情</label>
        <el-input v-model="searchParams.details" placeholder="搜索详情..." clearable />
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <k-icon name="loader" class="spin" />
      <span>加载中...</span>
    </div>

    <!-- 日志列表 -->
    <div v-else class="logs-container">
      <div v-if="logs.length === 0" class="empty-state">
        <k-icon name="inbox" class="empty-icon" />
        <p>暂无日志记录</p>
      </div>

      <div class="logs-table" v-else>
        <div class="table-header">
          <div class="col-time">时间</div>
          <div class="col-cmd">命令</div>
          <div class="col-user">用户</div>
          <div class="col-userid">用户ID</div>
          <div class="col-group">群组</div>
          <div class="col-status">状态</div>
          <div class="col-detail">详情</div>
        </div>
        <div
          v-for="(log, index) in logs"
          :key="log.id"
          class="table-row"
          :style="{ animationDelay: `${Math.min(index * 0.02, 0.3)}s` }"
        >
          <div class="col-time">{{ formatTime(log.timestamp) }}</div>
          <div class="col-cmd"><code>{{ log.command }}</code></div>
          <div class="col-user" :title="log.username">{{ log.username || '-' }}</div>
          <div class="col-userid" :title="log.userId">{{ log.userId }}</div>
          <div class="col-group" :title="log.guildId">{{ log.guildName || log.guildId || '私聊' }}</div>
          <div class="col-status">
            <span :class="log.success ? 'status-success' : 'status-fail'">
              {{ log.success ? '成功' : '失败' }}
            </span>
          </div>
          <div class="col-detail" :title="getDetail(log)">
            {{ getDetail(log) }}
          </div>
        </div>
      </div>
      
      <!-- 分页 -->
      <div class="pagination" v-if="total > 0">
        <el-pagination
          v-model:current-page="searchParams.page"
          v-model:page-size="searchParams.pageSize"
          :total="total"
          :page-sizes="[20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          @size-change="refreshLogs"
          @current-change="refreshLogs"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { message } from '@koishijs/client'
import { logsApi } from '../api'
import type { LogRecord, LogSearchParams } from '../types'

const loading = ref(false)
const logs = ref<LogRecord[]>([])
const total = ref(0)
const dateRange = ref<[number, number] | null>(null)

const searchParams = reactive<LogSearchParams>({
  page: 1,
  pageSize: 20
})

const refreshLogs = async () => {
  loading.value = true
  try {
    const params: LogSearchParams = { ...searchParams }
    if (dateRange.value) {
      params.startTime = dateRange.value[0]
      params.endTime = dateRange.value[1]
    }
    
    const result = await logsApi.search(params)
    logs.value = result.list
    total.value = result.total
  } catch (e: any) {
    message.error(e.message || '加载日志失败')
  } finally {
    loading.value = false
  }
}

const formatTime = (timestamp: string | number) => {
  return new Date(timestamp).toLocaleString('zh-CN')
}

const getDetail = (log: LogRecord) => {
  if (!log.success && log.error) return log.error
  if (log.result) return log.result
  if (Object.keys(log.options).length > 0) return JSON.stringify(log.options)
  if (log.args.length > 0) return log.args.join(' ')
  return '-'
}

onMounted(() => {
  refreshLogs()
})
</script>

<style scoped>
.logs-view {
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

.view-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--k-color-text);
  margin: 0;
}

.search-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1rem;
  background: var(--k-card-bg);
  padding: 1rem;
  border-radius: 20px;
  border: 1px solid var(--k-color-border);
  animation: fadeInUp 0.3s ease-out backwards;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.search-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.search-item label {
  font-size: 0.9rem;
  color: var(--k-color-text-description);
  white-space: nowrap;
}

.loading-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--k-color-text-description);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.logs-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--k-card-bg);
  border: 1px solid var(--k-color-border);
  border-radius: 20px;
  animation: fadeInUp 0.4s ease-out backwards;
  animation-delay: 0.1s;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--k-color-text-description);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.logs-table {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.table-header {
  display: flex;
  padding: 10px 16px;
  background: var(--k-color-bg-2);
  border-bottom: 1px solid var(--k-color-border);
  font-weight: 600;
  color: var(--k-color-text);
  font-size: 0.9rem;
}

.table-row {
  display: flex;
  padding: 8px 16px;
  border-bottom: 1px solid var(--k-color-border);
  align-items: center;
  font-size: 0.9rem;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  animation: row-enter 0.3s ease-out backwards;
}

@keyframes row-enter {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.table-row:last-child {
  border-bottom: none;
}

.table-row:hover {
  background: var(--k-color-bg-1);
  transform: translateX(4px);
}

.col-time { width: 160px; flex-shrink: 0; color: var(--k-color-text-description); }
.col-cmd { width: 100px; flex-shrink: 0; font-family: monospace; color: var(--k-color-active); }
.col-user { width: 120px; flex-shrink: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.col-userid { width: 120px; flex-shrink: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: monospace; color: var(--k-color-text-description); }
.col-group { width: 120px; flex-shrink: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.col-status { width: 60px; flex-shrink: 0; }
.col-detail { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--k-color-text-description); }

.status-success { color: #67c23a; }
.status-fail { color: #f56c6c; }

.pagination {
  padding: 10px;
  border-top: 1px solid var(--k-color-border);
  display: flex;
  justify-content: flex-end;
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
}
::-webkit-scrollbar-thumb:hover {
  background-color: var(--k-color-text-description);
}
</style>