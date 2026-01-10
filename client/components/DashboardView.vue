<template>
  <div class="dashboard-container">
    <!-- Hero Section -->
    <div class="hero-section">
      <div class="hero-content">
        <div class="hero-icon">
          <k-icon name="activity" />
        </div>
        <div class="hero-text">
          <h1>GroupHelper</h1>
          <div class="hero-meta">
            <span class="version-tag">v{{ stats.version || '...' }}</span>
            <span class="status-indicator">
              <span class="dot"></span>
              运行正常
            </span>
            <span class="uptime" v-if="stats.timestamp">
              上次更新: {{ formatTime(stats.timestamp) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Grid -->
    <div class="bento-grid">
      <!-- Statistics Cards -->
      <div class="card stat-card blue">
        <div class="stat-icon">
          <k-icon name="users" />
        </div>
        <div class="stat-content">
          <div v-if="loading" class="skeleton skeleton-text"></div>
          <div v-else class="stat-value">{{ stats.totalGroups }}</div>
          <div class="stat-label">已配置群组</div>
        </div>
      </div>

      <div class="card stat-card orange">
        <div class="stat-icon">
          <k-icon name="alert-triangle" />
        </div>
        <div class="stat-content">
          <div v-if="loading" class="skeleton skeleton-text"></div>
          <div v-else class="stat-value">{{ stats.totalWarns }}</div>
          <div class="stat-label">警告记录</div>
        </div>
      </div>

      <div class="card stat-card red">
        <div class="stat-icon">
          <k-icon name="user-x" />
        </div>
        <div class="stat-content">
          <div v-if="loading" class="skeleton skeleton-text"></div>
          <div v-else class="stat-value">{{ stats.totalBlacklisted }}</div>
          <div class="stat-label">黑名单用户</div>
        </div>
      </div>

      <div class="card stat-card green">
        <div class="stat-icon">
          <k-icon name="rss" />
        </div>
        <div class="stat-content">
          <div v-if="loading" class="skeleton skeleton-text"></div>
          <div v-else class="stat-value">{{ stats.totalSubscriptions }}</div>
          <div class="stat-label">活跃订阅</div>
        </div>
      </div>


      <!-- Notice Card -->
      <div class="card notice-card" v-if="notice">
        <div class="card-header">
          <k-icon name="bell" />
          <h3>最新公告</h3>
        </div>
        <div class="notice-content">
          <k-markdown :source="notice" />
        </div>
      </div>

      <!-- Command Trend Chart -->
      <div class="card chart-card trend-card">
        <div class="card-header">
          <k-icon name="trending-up" />
          <h3>命令趋势</h3>
          <span class="chart-subtitle">7 天</span>
        </div>
        <div class="chart-container">
          <div v-if="chartLoading" class="chart-loading">
            <k-icon name="loader" class="spin" />
          </div>
          <div v-else-if="chartData.trend.length === 0" class="chart-empty">
            暂无数据
          </div>
          <div v-else class="bar-chart">
            <div class="chart-bars">
              <div
                v-for="item in chartData.trend"
                :key="item.date"
                class="bar-wrapper"
                :title="`${item.date}: ${item.count} 次`"
              >
                <div
                  class="bar"
                  :style="{ height: getBarHeight(item.count, maxTrendCount) + '%' }"
                ></div>
                <span class="bar-label">{{ item.date.slice(5) }}</span>
              </div>
            </div>
            <div class="chart-total">
              总计: {{ totalCommands }} 次
            </div>
          </div>
        </div>
      </div>

      <!-- Command Distribution Chart -->
      <div class="card chart-card distribution-card">
        <div class="card-header">
          <k-icon name="bar-chart-2" />
          <h3>命令排行</h3>
          <span class="chart-subtitle">Top 10</span>
        </div>
        <div class="chart-container">
          <div v-if="chartLoading" class="chart-loading">
            <k-icon name="loader" class="spin" />
          </div>
          <div v-else-if="chartData.distribution.length === 0" class="chart-empty">
            暂无数据
          </div>
          <div v-else class="horizontal-bar-chart">
            <div
              v-for="(item, index) in chartData.distribution"
              :key="item.command"
              class="h-bar-item"
            >
              <div class="h-bar-label">
                <span class="h-bar-rank">{{ index + 1 }}</span>
                <span class="h-bar-name">{{ item.command }}</span>
              </div>
              <div class="h-bar-track">
                <div
                  class="h-bar-fill"
                  :style="{ width: getBarHeight(item.count, maxDistCount) + '%' }"
                ></div>
              </div>
              <span class="h-bar-count">{{ item.count }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Guild Rank Chart -->
      <div class="card chart-card rank-card">
        <div class="card-header">
          <k-icon name="users" />
          <h3>群聊排行</h3>
          <span class="chart-subtitle">Top 10</span>
        </div>
        <div class="chart-container">
          <div v-if="chartLoading" class="chart-loading">
            <k-icon name="loader" class="spin" />
          </div>
          <div v-else-if="chartData.guildRank.length === 0" class="chart-empty">
            暂无数据
          </div>
          <div v-else class="horizontal-bar-chart">
            <div
              v-for="(item, index) in chartData.guildRank"
              :key="item.guildId"
              class="h-bar-item"
            >
              <div class="h-bar-label">
                <span class="h-bar-rank">{{ index + 1 }}</span>
                <span class="h-bar-name" :title="item.guildId">{{ item.guildId }}</span>
              </div>
              <div class="h-bar-track">
                <div
                  class="h-bar-fill guild"
                  :style="{ width: getBarHeight(item.count, maxGuildCount) + '%' }"
                ></div>
              </div>
              <span class="h-bar-count">{{ item.count }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- User Rank Chart -->
      <div class="card chart-card rank-card">
        <div class="card-header">
          <k-icon name="user" />
          <h3>个人排行</h3>
          <span class="chart-subtitle">Top 10</span>
        </div>
        <div class="chart-container">
          <div v-if="chartLoading" class="chart-loading">
            <k-icon name="loader" class="spin" />
          </div>
          <div v-else-if="chartData.userRank.length === 0" class="chart-empty">
            暂无数据
          </div>
          <div v-else class="horizontal-bar-chart">
            <div
              v-for="(item, index) in chartData.userRank"
              :key="item.userId"
              class="h-bar-item"
            >
              <div class="h-bar-label">
                <span class="h-bar-rank">{{ index + 1 }}</span>
                <span class="h-bar-name" :title="item.userId">{{ item.name || item.userId }}</span>
              </div>
              <div class="h-bar-track">
                <div
                  class="h-bar-fill user"
                  :style="{ width: getBarHeight(item.count, maxUserCount) + '%' }"
                ></div>
              </div>
              <span class="h-bar-count">{{ item.count }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Version Info -->
      <div class="card version-card">
        <div class="card-header">
          <k-icon name="tag" />
          <h3>版本信息</h3>
        </div>
        <div class="version-grid">
          <div class="version-item">
            <span class="version-label">当前</span>
            <span class="version-value current">{{ stats.version || '...' }}</span>
          </div>
          <div class="version-item">
            <span class="version-label">NPM</span>
            <span class="version-value npm">{{ versions.npm || '...' }}</span>
          </div>
          <div class="version-item">
            <span class="version-label">Main</span>
            <span class="version-value main">{{ versions.main || '...' }}</span>
          </div>
          <div class="version-item">
            <span class="version-label">Dev</span>
            <span class="version-value dev">{{ versions.dev || '...' }}</span>
          </div>
        </div>
      </div>

      <!-- Recent Updates -->
      <div class="card updates-card">
        <div class="card-header">
          <k-icon name="clock" />
          <h3>最近更新 (Dev)</h3>
        </div>
        <div class="commits-list">
          <div v-if="commitsError" class="error-text">
            <k-icon name="alert-circle" />
            <span>无法获取更新记录: {{ commitsError }}</span>
          </div>
          <div v-else-if="commits.length === 0" class="loading-text">
            <k-icon name="loader" class="spin" />
            <span>加载中...</span>
          </div>
          <a v-else v-for="commit in commits" :key="commit.sha" :href="commit.html_url" target="_blank" class="commit-item">
            <div class="commit-avatar">
              <img :src="commit.author?.avatar_url || 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'" />
            </div>
            <div class="commit-info">
              <div class="commit-msg">{{ commit.commit.message }}</div>
              <div class="commit-meta">
                <span>{{ commit.commit.author.name }}</span>
                <span>{{ formatRelativeTime(commit.commit.author.date) }}</span>
              </div>
            </div>
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, computed, nextTick, watch } from 'vue'
import { statsApi } from '../api'
import type { ChartData } from '../api'

defineEmits(['change-view'])

interface DashboardStats {
  totalGroups: number
  totalWarns: number
  totalBlacklisted: number
  totalSubscriptions: number
  timestamp: number
  version?: string
}

const loading = ref(false)
const error = ref('')
const notice = ref('')
const commits = ref<any[]>([])
const commitsError = ref('')

// 图表相关
const chartLoading = ref(false)
const chartData = reactive<ChartData>({
  trend: [],
  distribution: [],
  successRate: { success: 0, fail: 0 },
  guildRank: [],
  userRank: []
})

// 计算属性
const maxTrendCount = computed(() => {
  if (chartData.trend.length === 0) return 1
  return Math.max(...chartData.trend.map(i => i.count), 1)
})

const maxDistCount = computed(() => {
  if (chartData.distribution.length === 0) return 1
  return Math.max(...chartData.distribution.map(i => i.count), 1)
})

const maxGuildCount = computed(() => {
  if (chartData.guildRank.length === 0) return 1
  return Math.max(...chartData.guildRank.map(i => i.count), 1)
})

const maxUserCount = computed(() => {
  if (chartData.userRank.length === 0) return 1
  return Math.max(...chartData.userRank.map(i => i.count), 1)
})

const totalCommands = computed(() => {
  return chartData.trend.reduce((sum, item) => sum + item.count, 0)
})

// 计算柱状图高度百分比
const getBarHeight = (count: number, max: number) => {
  if (max === 0) return 0
  return Math.max((count / max) * 100, 2) // 最小 2%
}

const stats = reactive<DashboardStats>({
  totalGroups: 0,
  totalWarns: 0,
  totalBlacklisted: 0,
  totalSubscriptions: 0,
  timestamp: 0,
  version: ''
})

const versions = reactive({
  npm: '',
  main: '',
  dev: ''
})

const loadNotice = async () => {
  try {
    // 添加时间戳参数防止浏览器缓存
    const timestamp = Date.now()
    const res = await fetch(`https://raw.githubusercontent.com/Camvanaa/koishi-plugin-grouphelper/dev/notice.md?t=${timestamp}`, {
      cache: 'no-store'
    })
    if (res.ok) {
      notice.value = await res.text()
    }
  } catch (e) {
    console.error('Failed to fetch notice:', e)
  }
}

const loadVersions = async () => {
  const timestamp = Date.now()
  const fetchOptions = { cache: 'no-store' as RequestCache }

  try {
    // GitHub Main
    fetch(`https://raw.githubusercontent.com/Camvanaa/koishi-plugin-grouphelper/main/package.json?t=${timestamp}`, fetchOptions)
      .then(res => res.json())
      .then(pkg => versions.main = pkg.version)
      .catch(() => versions.main = '获取失败')

    // GitHub Dev
    fetch(`https://raw.githubusercontent.com/Camvanaa/koishi-plugin-grouphelper/dev/package.json?t=${timestamp}`, fetchOptions)
      .then(res => res.json())
      .then(pkg => versions.dev = pkg.version)
      .catch(() => versions.dev = '获取失败')

    // NPM
    fetch('https://registry.npmjs.org/koishi-plugin-grouphelper/latest', fetchOptions)
      .then(res => res.json())
      .then(pkg => versions.npm = pkg.version)
      .catch(() => versions.npm = '获取失败')
  } catch (e) {
    console.error('Failed to load versions', e)
  }
}

const loadCommits = async () => {
  try {
    commitsError.value = ''
    const res = await fetch('https://api.github.com/repos/Camvanaa/koishi-plugin-grouphelper/commits?sha=dev&per_page=5')
    if (res.ok) {
      commits.value = await res.json()
    } else {
      commitsError.value = `HTTP ${res.status}`
    }
  } catch (e: any) {
    console.error('Failed to load commits', e)
    commitsError.value = e.message || '网络错误'
  }
}

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

const loadCharts = async () => {
  chartLoading.value = true
  try {
    const data = await statsApi.charts(7)
    chartData.trend = data.trend
    chartData.distribution = data.distribution
    chartData.successRate = data.successRate
    chartData.guildRank = data.guildRank || []
    chartData.userRank = data.userRank || []
  } catch (e: any) {
    console.error('加载图表数据失败:', e)
  } finally {
    chartLoading.value = false
  }
}

const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleString('zh-CN')
}

const formatRelativeTime = (dateStr: string) => {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes} 分钟前`
  
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} 天前`
  
  return date.toLocaleDateString('zh-CN')
}


onMounted(() => {
  loadStats()
  loadNotice()
  loadVersions()
  loadCommits()
  loadCharts()
})

onUnmounted(() => {
})
</script>

<style scoped>
.dashboard-container {
  padding: 1.5rem;
  max-width: 1600px;
  margin: 0 auto;
  height: 100%;
  overflow-y: auto;
  box-sizing: border-box;
}

/* Hero Section - 更加通透现代 */
.hero-section {
  margin-bottom: 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0.5rem;
}

.hero-content {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.hero-icon {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: var(--k-color-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
}

.hero-text h1 {
  margin: 0 0 0.25rem 0;
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: -0.5px;
  color: var(--k-color-text);
}

.hero-meta {
  display: flex;
  align-items: center;
  gap: 1rem;
  color: var(--k-color-text-description);
  font-size: 0.85rem;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--k-color-success);
  font-weight: 600;
  font-size: 0.8rem;
  background: var(--k-color-success-fade);
  padding: 2px 10px;
  border-radius: 12px;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 8px currentColor;
}

.version-tag {
  background: var(--k-bg-light);
  padding: 2px 8px;
  border-radius: 6px;
  font-family: monospace;
  font-size: 0.8rem;
  border: 1px solid var(--k-color-border);
}

/* Grid Layout */
.bento-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-auto-rows: minmax(160px, auto);
  gap: 1.25rem;
}

.card {
  background: var(--k-card-bg);
  border-radius: 20px;
  padding: 1.5rem;
  border: 1px solid var(--k-color-border);
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  position: relative;
  overflow: hidden;
  animation: fadeInUp 0.4s ease-out backwards;
}

.card:nth-child(1) { animation-delay: 0.05s; }
.card:nth-child(2) { animation-delay: 0.1s; }
.card:nth-child(3) { animation-delay: 0.15s; }
.card:nth-child(4) { animation-delay: 0.2s; }
.card:nth-child(5) { animation-delay: 0.25s; }
.card:nth-child(6) { animation-delay: 0.3s; }
.card:nth-child(7) { animation-delay: 0.35s; }

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

.card:hover {
  transform: translateY(-6px);
  box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.2);
  border-color: var(--k-color-primary-fade);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
  color: var(--k-color-text);
  font-weight: 600;
}

.card-header h3 {
  margin: 0;
  font-size: 1.1rem;
}

/* Stat Cards - 更有质感 */
.stat-card {
  grid-column: span 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

/* 底部装饰条 */
.stat-card::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--stat-color);
  opacity: 0.8;
  transition: opacity 0.3s;
}

.stat-card:hover::after {
  opacity: 1;
}

.stat-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  margin-bottom: 1.25rem;
  background: var(--stat-color-fade);
  color: var(--stat-color);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.stat-card:hover .stat-icon {
  transform: scale(1.1);
  box-shadow: 0 4px 12px var(--stat-color-fade);
}

.stat-value {
  font-size: 2.75rem;
  font-weight: 800;
  color: var(--stat-color);
  line-height: 1;
  margin-bottom: 0.5rem;
  letter-spacing: -2px;
}

.stat-label {
  color: var(--k-color-text-description);
  font-size: 0.9rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Stat Colors Configuration */
.stat-card.blue { --stat-color: #409eff; --stat-color-bg: #409eff; --stat-color-fade: rgba(64, 158, 255, 0.1); }
.stat-card.orange { --stat-color: #e6a23c; --stat-color-bg: #e6a23c; --stat-color-fade: rgba(230, 162, 60, 0.1); }
.stat-card.red { --stat-color: #f56c6c; --stat-color-bg: #f56c6c; --stat-color-fade: rgba(245, 108, 108, 0.1); }
.stat-card.green { --stat-color: #67c23a; --stat-color-bg: #67c23a; --stat-color-fade: rgba(103, 194, 58, 0.1); }

/* Notice Card */
.notice-card {
  grid-column: span 4;
  border-left: 4px solid var(--k-color-primary);
  border-radius: 20px 20px 20px 16px;
}

.notice-content {
  color: var(--k-color-text);
  line-height: 1.7;
}

/* Info Cards Layout */
.version-card {
  grid-column: span 1;
}

.updates-card {
  grid-column: span 2;
  position: relative; /* 启用定位上下文 */
  min-height: 240px; /* 确保最小高度 */
}

/* 让版本信息和最近更新同行等高 */
.updates-card .commits-list {
  position: absolute;
  top: 76px; /* 预估 Header 高度 (header height + margin + padding) */
  bottom: 1.5rem; /* 底部 padding */
  left: 1.5rem; /* 左侧 padding */
  right: 0.5rem; /* 右侧 padding (留出滚动条空间) */
  overflow-y: auto;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--k-color-border);
  color: var(--k-color-text);
  font-weight: 600;
}

/* Version Grid - 简洁紧凑 */
.version-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.version-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.75rem;
  background: var(--k-color-bg-2);
  border-radius: 10px;
}

.version-label {
  font-size: 0.75rem;
  color: var(--k-color-text-description);
  font-weight: 500;
}

.version-value {
  font-size: 0.9rem;
  font-weight: 600;
  font-family: monospace;
}

.version-value.current { color: var(--k-color-primary); }
.version-value.npm { color: #67c23a; }
.version-value.main { color: #e6a23c; }
.version-value.dev { color: #f56c6c; }

/* Updates List - 时间轴样式 */
.commits-list {
  flex: 1;
  overflow-y: auto;
  padding-right: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0;
  min-height: 0;
}

.commit-item {
  display: flex;
  gap: 1rem;
  padding: 0.875rem 0.75rem;
  position: relative;
  text-decoration: none;
  color: inherit;
  border-radius: 12px;
  transition: all 0.2s ease;
  margin-left: 0.5rem;
}

.commit-item:hover {
  background: var(--k-bg-light);
  transform: translateX(4px);
}

/* Timeline line */
.commit-item::before {
  content: '';
  position: absolute;
  left: 20px;
  top: 3rem;
  bottom: -0.25rem;
  width: 2px;
  background: var(--k-color-border);
  z-index: 0;
}

.commit-item:last-child::before {
  display: none;
}

.commit-avatar {
  position: relative;
  z-index: 1;
}

.commit-avatar img {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 3px solid var(--k-card-bg);
  box-shadow: 0 2px 8px rgba(0,0,0,0.12);
  transition: transform 0.2s;
}

.commit-item:hover .commit-avatar img {
  transform: scale(1.1);
}

.commit-info {
  flex: 1;
  min-width: 0;
  padding-top: 0.25rem;
}

.commit-msg {
  font-weight: 600;
  margin-bottom: 0.35rem;
  color: var(--k-color-text);
  font-size: 0.9rem;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-clamp: 2;
  overflow: hidden;
}

.commit-meta {
  font-size: 0.8rem;
  color: var(--k-color-text-description);
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.commit-meta span:first-child {
  font-weight: 500;
  color: var(--k-color-primary);
}

/* Scrollbar styling */
.commits-list::-webkit-scrollbar {
  width: 4px;
}
.commits-list::-webkit-scrollbar-track {
  background: transparent;
}
.commits-list::-webkit-scrollbar-thumb {
  background: var(--k-color-border);
  border-radius: 2px;
}

/* Responsive */
@media (max-width: 1200px) {
  .bento-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .notice-card {
    grid-column: span 2;
  }
  .updates-card {
    grid-column: span 2;
    grid-row: span 1;
  }
}

@media (max-width: 768px) {
  .dashboard-container {
    padding: 1rem;
  }
  .hero-section {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
  .bento-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  .card, .stat-card, .version-card, .updates-card, .notice-card, .trend-card, .distribution-card {
    grid-column: span 1;
  }
  .commit-item::before {
    display: none; /* Hide timeline on mobile */
  }
  .version-grid {
    grid-template-columns: 1fr 1fr;
  }
}

/* Loading States */
.skeleton {
  background: linear-gradient(90deg, var(--k-color-bg-2) 25%, var(--k-color-bg-1) 50%, var(--k-color-bg-2) 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
  border-radius: 6px;
}

@keyframes skeleton-loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.loading-text, .error-text {
  text-align: center;
  padding: 2rem;
  color: var(--k-color-text-description);
}

.spin {
  animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Chart Cards */
.chart-card {
  grid-column: span 1;
}

.chart-card .card-header {
  justify-content: flex-start;
}

.chart-subtitle {
  margin-left: auto;
  font-size: 0.75rem;
  font-weight: 400;
  color: var(--k-color-text-description);
  background: var(--k-color-bg-2);
  padding: 2px 8px;
  border-radius: 10px;
}

.chart-container {
  min-height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chart-loading, .chart-empty {
  color: var(--k-color-text-description);
  font-size: 0.9rem;
}

/* Bar Chart (Vertical) */
.bar-chart {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.chart-bars {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  height: 140px;
  gap: 4px;
  padding: 0 4px;
}

.bar-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  height: 100%;
  justify-content: flex-end;
}

.bar {
  width: 100%;
  max-width: 40px;
  background: var(--k-color-primary);
  border-radius: 4px 4px 0 0;
  transition: height 0.5s cubic-bezier(0.25, 0.8, 0.25, 1);
  min-height: 2px;
}

.bar-wrapper:hover .bar {
  opacity: 0.8;
  box-shadow: 0 0 12px var(--k-color-primary-fade);
}

.bar-label {
  font-size: 0.7rem;
  color: var(--k-color-text-description);
  white-space: nowrap;
}

.chart-total {
  text-align: center;
  font-size: 0.8rem;
  color: var(--k-color-text-description);
  padding-top: 0.5rem;
  border-top: 1px dashed var(--k-color-border);
}

/* Horizontal Bar Chart */
.horizontal-bar-chart {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.h-bar-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.h-bar-label {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 100px;
  flex-shrink: 0;
}

.h-bar-rank {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--k-color-bg-2);
  color: var(--k-color-text-description);
  font-size: 0.7rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.h-bar-item:nth-child(1) .h-bar-rank {
  background: #ffd700;
  color: #000;
}
.h-bar-item:nth-child(2) .h-bar-rank {
  background: #c0c0c0;
  color: #000;
}
.h-bar-item:nth-child(3) .h-bar-rank {
  background: #cd7f32;
  color: #fff;
}

.h-bar-name {
  font-size: 0.8rem;
  color: var(--k-color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 70px;
}

.h-bar-track {
  flex: 1;
  height: 12px;
  background: var(--k-color-bg-2);
  border-radius: 6px;
  overflow: hidden;
}

.h-bar-fill {
  height: 100%;
  background: var(--k-color-primary);
  border-radius: 6px;
  transition: width 0.5s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.h-bar-count {
  min-width: 36px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--k-color-text-description);
  text-align: right;
}

/* Chart cards layout */
.trend-card {
  grid-column: span 2;
}

.distribution-card {
  grid-column: span 1;
}

.rank-card {
  grid-column: span 1;
}

/* 不同排行的颜色 */
.h-bar-fill.guild {
  background: #67c23a;
}

.h-bar-fill.user {
  background: #e6a23c;
}

/* Responsive */
@media (max-width: 1200px) {
  .trend-card, .distribution-card, .rank-card {
    grid-column: span 2;
  }
}
</style>