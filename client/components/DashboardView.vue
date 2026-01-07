<template>
  <div class="dashboard-view">
    <h2 class="view-title">仪表盘</h2>
    
    <!-- 统计卡片 -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon groups">
          <k-icon name="users" />
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.totalGroups }}</div>
          <div class="stat-label">已配置群组</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon warns">
          <k-icon name="alert-triangle" />
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.totalWarns }}</div>
          <div class="stat-label">警告记录</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon blacklist">
          <k-icon name="user-x" />
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.totalBlacklisted }}</div>
          <div class="stat-label">黑名单用户</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon subscriptions">
          <k-icon name="rss" />
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.totalSubscriptions }}</div>
          <div class="stat-label">活跃订阅</div>
        </div>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-overlay">
      <k-icon name="loader" class="spin" />
      <span>加载中...</span>
    </div>

    <!-- 错误提示 -->
    <div v-if="error" class="error-message">
      <k-icon name="alert-circle" />
      <span>{{ error }}</span>
      <k-button size="small" @click="loadStats">重试</k-button>
    </div>

    <!-- 最后更新时间 -->
    <div v-if="stats.timestamp" class="last-update">
      最后更新: {{ formatTime(stats.timestamp) }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { statsApi } from '../api'

interface DashboardStats {
  totalGroups: number
  totalWarns: number
  totalBlacklisted: number
  totalSubscriptions: number
  timestamp: number
}

const loading = ref(false)
const error = ref('')
const stats = reactive<DashboardStats>({
  totalGroups: 0,
  totalWarns: 0,
  totalBlacklisted: 0,
  totalSubscriptions: 0,
  timestamp: 0
})

const loadStats = async () => {
  loading.value = true
  error.value = ''
  try {
    const data = await statsApi.dashboard()
    Object.assign(stats, data)
  } catch (e: any) {
    error.value = e.message || '加载统计数据失败'
  } finally {
    loading.value = false
  }
}

const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleString('zh-CN')
}

onMounted(() => {
  loadStats()
})
</script>

<style scoped>
.dashboard-view {
  height: 100%;
  overflow-y: auto;
}

.view-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--k-color-text);
  margin: 0 0 1.5rem 0;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
  background: var(--k-card-bg);
  border: 1px solid var(--k-color-border);
  border-radius: 12px;
  transition: box-shadow 0.2s;
}

.stat-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.stat-icon.groups {
  background: rgba(64, 158, 255, 0.1);
  color: #409eff;
}

.stat-icon.warns {
  background: rgba(230, 162, 60, 0.1);
  color: #e6a23c;
}

.stat-icon.blacklist {
  background: rgba(245, 108, 108, 0.1);
  color: #f56c6c;
}

.stat-icon.subscriptions {
  background: rgba(103, 194, 58, 0.1);
  color: #67c23a;
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--k-color-text);
  line-height: 1.2;
}

.stat-label {
  font-size: 0.875rem;
  color: var(--k-color-text-description);
  margin-top: 4px;
}

.loading-overlay {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 2rem;
  color: var(--k-color-text-description);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 1rem;
  background: rgba(245, 108, 108, 0.1);
  border: 1px solid rgba(245, 108, 108, 0.3);
  border-radius: 8px;
  color: #f56c6c;
  margin-top: 1rem;
}

.last-update {
  margin-top: 1.5rem;
  font-size: 0.75rem;
  color: var(--k-color-text-description);
  text-align: right;
}
</style>