<template>
  <div class="dashboard-container">
    <!-- Hero Section -->
    <div class="hero-section">
      <div class="hero-content">
        <div class="hero-icon">
          <k-icon name="grouphelper:logo" />
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
      <div class="hero-actions">
        <div class="button is-primary" @click="toggleEditMode">
          <k-icon :name="isEditing ? 'check' : 'edit-2'" />
          {{ isEditing ? '完成' : '编辑布局' }}
        </div>
      </div>
    </div>

    <!-- Main Grid -->
    <div class="bento-grid" :class="{ 'is-editing': isEditing }">
      <div
        v-for="(item, index) in layout"
        :key="item.id"
        class="grid-item"
        :style="{ gridColumn: `span ${item.span}`, animationDelay: `${Math.min(index * 0.03, 0.3)}s` }"
        :draggable="isEditing"
        @dragstart="dragStart($event, index)"
        @dragover.prevent
        @dragenter="dragEnter(index)"
        @drop="drop($event)"
        @dragend="dragEnd($event)"
      >
        <!-- 编辑模式遮罩 -->
        <div class="edit-overlay" v-if="isEditing">
          <div class="drag-handle">
            <k-icon name="move" />
          </div>
          <div class="remove-btn" v-if="item.type !== 'StatCard'" @click="removeWidget(index)">
            <k-icon name="trash-2" />
          </div>
        </div>

        <!-- 动态组件渲染 -->
        <component
          :is="getComponent(item.type)"
          v-bind="resolveProps(item)"
        />
      </div>

      <!-- 添加组件占位符 -->
      <div v-if="isEditing" class="grid-item add-widget-placeholder" @click="showAddModal = true">
        <k-icon name="plus" />
        <span>添加组件</span>
      </div>
    </div>

    <!-- 添加组件模态框 -->
    <div class="modal-overlay" v-if="showAddModal" @click="showAddModal = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>添加组件</h3>
          <div class="close-btn" @click="showAddModal = false">
            <k-icon name="x" />
          </div>
        </div>
        <div class="widget-list">
          <div
            v-for="widget in availableWidgets"
            :key="widget.type"
            class="widget-option"
            @click="addWidget(widget)"
          >
            <div class="widget-preview">
              <k-icon :name="widget.icon" />
            </div>
            <div class="widget-info">
              <h4>{{ widget.name }}</h4>
              <p>{{ widget.description }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { statsApi } from '../api'
import type { ChartData } from '../api'

// 同步引入组件（修复生产构建问题）
import StatCard from './dashboard/StatCard.vue'
import NoticeCard from './dashboard/NoticeCard.vue'
import TrendChartCard from './dashboard/TrendChartCard.vue'
import DistChartCard from './dashboard/DistChartCard.vue'
import RankChartCard from './dashboard/RankChartCard.vue'
import VersionCard from './dashboard/VersionCard.vue'
import UpdatesCard from './dashboard/UpdatesCard.vue'

const componentMap: Record<string, any> = {
  StatCard,
  NoticeCard,
  TrendChartCard,
  DistChartCard,
  RankChartCard,
  VersionCard,
  UpdatesCard
}

const getComponent = (type: string) => componentMap[type]

// --- 数据状态 ---
const loading = ref(false)
const notice = ref('')
const commits = ref<any[]>([])
const commitsError = ref('')
const chartLoading = ref(false)
const chartData = reactive<ChartData>({
  trend: [],
  distribution: [],
  successRate: { success: 0, fail: 0 },
  guildRank: [],
  userRank: []
})
const stats = reactive({
  totalGroups: 0,
  totalWarns: 0,
  totalBlacklisted: 0,
  totalSubscriptions: 0,
  timestamp: 0,
  version: ''
})
const versions = reactive({ npm: '', main: '', dev: '' })

// --- 布局系统 ---
interface WidgetConfig {
  id: string
  type: string
  span: number
  props?: Record<string, any>
  dynamicProps?: Record<string, string> // key: propName, value: statePath
}

const isEditing = ref(false)
const showAddModal = ref(false)
const dragIndex = ref<number | null>(null)

// 默认布局 - 包含四个统计卡片和公告
const defaultLayout: WidgetConfig[] = [
  { id: 'stat-groups', type: 'StatCard', span: 1, props: { type: 'blue', icon: 'octicons.people', label: '已配置群组' }, dynamicProps: { value: 'stats.totalGroups', loading: 'loading' } },
  { id: 'stat-warns', type: 'StatCard', span: 1, props: { type: 'orange', icon: 'octicons.alert', label: '警告记录' }, dynamicProps: { value: 'stats.totalWarns', loading: 'loading' } },
  { id: 'stat-blacklist', type: 'StatCard', span: 1, props: { type: 'red', icon: 'octicons.blocked', label: '黑名单用户' }, dynamicProps: { value: 'stats.totalBlacklisted', loading: 'loading' } },
  { id: 'stat-subscriptions', type: 'StatCard', span: 1, props: { type: 'green', icon: 'octicons.broadcast', label: '活跃订阅' }, dynamicProps: { value: 'stats.totalSubscriptions', loading: 'loading' } },
  { id: 'notice', type: 'NoticeCard', span: 2, dynamicProps: { content: 'notice' } }
]

const layout = ref<WidgetConfig[]>(loadLayout())

function loadLayout() {
  const saved = localStorage.getItem('gh-dashboard-layout')
  if (saved) {
    try {
      // 合并默认配置，防止组件改名后丢失
      const parsed = JSON.parse(saved)
      // 迁移：将 NoticeCard 的 span 从 4 改为 2，并迁移图标到 Octicons
      const iconMigration: Record<string, string> = {
        'users': 'octicons.people',
        'alert-triangle': 'octicons.alert',
        'user-x': 'octicons.blocked',
        'rss': 'octicons.broadcast'
      }
      for (const item of parsed) {
        if (item.type === 'NoticeCard' && item.span === 4) {
          item.span = 2
        }
        // 迁移 StatCard 图标
        if (item.type === 'StatCard' && item.props?.icon && iconMigration[item.props.icon]) {
          item.props.icon = iconMigration[item.props.icon]
        }
      }
      return parsed
    } catch (e) { console.error(e) }
  }
  return JSON.parse(JSON.stringify(defaultLayout))
}

function saveLayout() {
  localStorage.setItem('gh-dashboard-layout', JSON.stringify(layout.value))
}

// 可用组件定义（StatCard 为内置组件，不可手动添加）
const availableWidgets = [
  { type: 'NoticeCard', name: '公告卡片', description: '显示公告内容', icon: 'grouphelper:octicons.megaphone', span: 2, defaultDynamicProps: { content: 'notice' } },
  { type: 'TrendChartCard', name: '趋势图表', description: '显示命令使用趋势', icon: 'grouphelper:octicons.graph', span: 2, defaultDynamicProps: { data: 'chartData.trend', loading: 'chartLoading' } },
  { type: 'DistChartCard', name: '命令排行', description: '显示命令使用分布', icon: 'grouphelper:octicons.bar-chart', span: 1, defaultDynamicProps: { data: 'chartData.distribution', loading: 'chartLoading' } },
  { type: 'RankChartCard', name: '群聊排行', description: '显示群聊活跃排行', icon: 'grouphelper:octicons.people', span: 1, defaultProps: { type: 'guild', title: '群聊排行', icon: 'octicons.people' }, defaultDynamicProps: { data: 'chartData.guildRank', loading: 'chartLoading' } },
  { type: 'RankChartCard', name: '个人排行', description: '显示用户活跃排行', icon: 'grouphelper:octicons.person', span: 1, defaultProps: { type: 'user', title: '个人排行', icon: 'octicons.person' }, defaultDynamicProps: { data: 'chartData.userRank', loading: 'chartLoading' } },
  { type: 'VersionCard', name: '版本信息', description: '显示版本信息', icon: 'grouphelper:octicons.tag', span: 1, defaultDynamicProps: { stats: 'stats', versions: 'versions' } },
  { type: 'UpdatesCard', name: '最近更新', description: '显示最近的代码提交', icon: 'grouphelper:octicons.history', span: 2, defaultDynamicProps: { commits: 'commits', error: 'commitsError' } }
]

// 属性解析
const resolveProps = (item: WidgetConfig) => {
  const props: Record<string, any> = { ...item.props }
  if (item.dynamicProps) {
    for (const [key, path] of Object.entries(item.dynamicProps)) {
      props[key] = getNestedValue(path)
    }
  }
  return props
}

function getNestedValue(path: string) {
  const parts = path.split('.')
  // 顶层数据源映射 (注意：ref 需要取 .value)
  const dataMap: Record<string, any> = {
    stats,
    chartData,
    versions,
    loading: loading.value,
    chartLoading: chartLoading.value,
    notice: notice.value,
    commits: commits.value,
    commitsError: commitsError.value
  }

  if (parts.length === 1) {
    return dataMap[parts[0]]
  }

  let current: any = dataMap[parts[0]]
  for (let i = 1; i < parts.length; i++) {
    if (current === undefined || current === null) return undefined
    current = current[parts[i]]
  }
  return current
}

// --- 交互逻辑 ---

function toggleEditMode() {
  isEditing.value = !isEditing.value
  if (!isEditing.value) {
    saveLayout()
  }
}

function removeWidget(index: number) {
  layout.value.splice(index, 1)
}

function addWidget(widgetTemplate: any) {
  layout.value.push({
    id: `widget-${Date.now()}`,
    type: widgetTemplate.type,
    span: widgetTemplate.span,
    props: widgetTemplate.defaultProps,
    dynamicProps: widgetTemplate.defaultDynamicProps
  })
  showAddModal.value = false
}

// --- 拖拽逻辑 ---
function dragStart(e: DragEvent, index: number) {
  dragIndex.value = index
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.dropEffect = 'move'
    // 稍微延迟一下，避免拖拽开始时元素立即消失的视觉问题
    setTimeout(() => {
      if (e.target instanceof HTMLElement) {
        e.target.style.opacity = '0.5'
      }
    }, 0)
  }
}

function dragEnter(index: number) {
  if (dragIndex.value !== null && dragIndex.value !== index) {
    // 交换位置
    const item = layout.value[dragIndex.value]
    layout.value.splice(dragIndex.value, 1)
    layout.value.splice(index, 0, item)
    dragIndex.value = index
  }
}

function drop(e: DragEvent) {
  e.preventDefault()
  if (e.target instanceof HTMLElement) {
    e.target.style.opacity = '1'
  }
  dragIndex.value = null
  saveLayout()
}

function dragEnd(e: DragEvent) {
  if (e.target instanceof HTMLElement) {
    e.target.style.opacity = '1'
  }
  dragIndex.value = null
}

// --- 数据加载逻辑 (保持原有) ---
const loadNotice = async () => {
  try {
    const timestamp = Date.now()
    const res = await fetch(`https://raw.githubusercontent.com/Camvanaa/koishi-plugin-grouphelper/dev/notice.md?t=${timestamp}`, { cache: 'no-store' })
    if (res.ok) notice.value = await res.text()
  } catch (e) { console.error(e) }
}

const loadVersions = async () => {
  const timestamp = Date.now()
  const fetchOptions = { cache: 'no-store' as RequestCache }
  try {
    fetch(`https://raw.githubusercontent.com/Camvanaa/koishi-plugin-grouphelper/main/package.json?t=${timestamp}`, fetchOptions).then(res => res.json()).then(pkg => versions.main = pkg.version).catch(() => versions.main = 'Fail')
    fetch(`https://raw.githubusercontent.com/Camvanaa/koishi-plugin-grouphelper/dev/package.json?t=${timestamp}`, fetchOptions).then(res => res.json()).then(pkg => versions.dev = pkg.version).catch(() => versions.dev = 'Fail')
    fetch('https://registry.npmjs.org/koishi-plugin-grouphelper/latest', fetchOptions).then(res => res.json()).then(pkg => versions.npm = pkg.version).catch(() => versions.npm = 'Fail')
  } catch (e) {}
}

const loadCommits = async () => {
  try {
    commitsError.value = ''
    const res = await fetch('https://api.github.com/repos/Camvanaa/koishi-plugin-grouphelper/commits?sha=dev&per_page=5')
    if (res.ok) commits.value = await res.json()
    else commitsError.value = `HTTP ${res.status}`
  } catch (e: any) { commitsError.value = e.message }
}

const loadStats = async () => {
  loading.value = true
  try {
    Object.assign(stats, await statsApi.dashboard())
  } catch (e) {} finally { loading.value = false }
}

const loadCharts = async () => {
  chartLoading.value = true
  try {
    const data = await statsApi.charts(7)
    Object.assign(chartData, data)
  } catch (e) {} finally { chartLoading.value = false }
}

const formatTime = (ts: number) => new Date(ts).toLocaleString('zh-CN')

onMounted(() => {
  loadStats(); loadNotice(); loadVersions(); loadCommits(); loadCharts()
})
</script>

<style scoped>
/* ========================================
   GitHub Dimmed / Vercel 风格 Dashboard
   硬核专业高信噪比
   ======================================== */

.dashboard-container {
  padding: 1rem;
  max-width: 1600px;
  margin: 0 auto;
  height: 100%;
  overflow-y: auto;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif;
}

/* Hero Section - 极简顶部 */
.hero-section {
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0;
}

.hero-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.hero-icon {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hero-icon :deep(svg) {
  width: 36px;
  height: 36px;
}

.hero-text h1 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  letter-spacing: -0.3px;
  color: var(--fg1, rgba(255, 255, 245, 0.9));
}

.hero-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--fg3, rgba(255, 255, 245, 0.4));
  font-size: 0.7rem;
  margin-top: 2px;
}

/* 状态指示器 - 实心小圆点，克制配色 */
.status-indicator {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #3fb950;
  font-weight: 500;
  font-size: 0.65rem;
  background: rgba(63, 185, 80, 0.1);
  padding: 2px 6px;
  border-radius: 3px;
  border: 1px solid rgba(63, 185, 80, 0.2);
}

/* 克制的实心圆点，无高斯模糊 */
.dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #3fb950;
}

/* 版本标签 - 等宽字体 */
.version-tag {
  background: var(--bg3, #313136);
  padding: 2px 5px;
  border-radius: 3px;
  font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  font-size: 0.65rem;
  color: var(--fg3, rgba(255, 255, 245, 0.4));
  border: 1px solid var(--k-color-divider, rgba(82, 82, 89, 0.5));
}

.uptime {
  color: var(--fg3, rgba(255, 255, 245, 0.4));
  font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
}

/* 按钮 - GitHub 风格 */
.button {
  cursor: pointer;
  padding: 5px 10px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.7rem;
  font-weight: 500;
  transition: all 0.12s ease;
  user-select: none;
  background: var(--bg3, #313136);
  color: var(--fg2, rgba(255, 255, 245, 0.6));
  border: 1px solid var(--k-color-divider, rgba(82, 82, 89, 0.5));
}

.button:hover {
  background: var(--bg2, #252529);
  border-color: var(--k-color-border, rgba(82, 82, 89, 0.8));
  color: var(--fg1, rgba(255, 255, 245, 0.9));
}

.button.is-primary {
  background: rgba(63, 185, 80, 0.12);
  color: #3fb950;
  border-color: rgba(63, 185, 80, 0.25);
}

.button.is-primary:hover {
  background: rgba(63, 185, 80, 0.2);
  border-color: rgba(63, 185, 80, 0.4);
}

/* Grid Layout - 紧凑间距 */
.bento-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-auto-rows: auto;
  gap: 12px;
  padding-bottom: 1rem;
}

.grid-item {
  position: relative;
  transition: transform 0.12s ease, opacity 0.12s ease;
  animation: card-enter 0.25s ease-out backwards;
}

@keyframes card-enter {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.bento-grid.is-editing .grid-item {
  border: 1px dashed var(--k-color-divider, rgba(82, 82, 89, 0.5));
  border-radius: 6px;
  cursor: move;
}

.bento-grid.is-editing .grid-item:hover {
  border-color: var(--k-color-primary, #7459ff);
}

/* Edit Overlay */
.edit-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.12s ease;
}

.grid-item:hover .edit-overlay {
  opacity: 1;
}

.remove-btn {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 24px;
  height: 24px;
  background: rgba(248, 81, 73, 0.9);
  color: #fff;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.12s ease;
  font-size: 12px;
}

.remove-btn:hover {
  background: #f85149;
}

.drag-handle {
  color: var(--fg1, rgba(255, 255, 245, 0.9));
  font-size: 1.25rem;
  opacity: 0.8;
}

/* Add Placeholder */
.add-widget-placeholder {
  grid-column: span 1;
  border: 1px dashed var(--k-color-divider, rgba(82, 82, 89, 0.5)) !important;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--fg3, rgba(255, 255, 245, 0.4));
  cursor: pointer !important;
  transition: all 0.12s ease;
  min-height: 120px;
  background: transparent;
  gap: 4px;
}

.add-widget-placeholder:hover {
  border-color: var(--k-color-primary, #7459ff) !important;
  color: var(--k-color-primary, #7459ff);
  background: rgba(116, 89, 255, 0.08);
}

.add-widget-placeholder .k-icon {
  font-size: 1.25rem;
}

.add-widget-placeholder span {
  font-size: 0.7rem;
}

/* Modal - GitHub 风格 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.65);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(2px);
}

.modal-content {
  background: var(--bg2, #252529);
  width: 400px;
  max-width: 90vw;
  border-radius: 6px;
  padding: 1rem;
  border: 1px solid var(--k-color-divider, rgba(82, 82, 89, 0.5));
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.625rem;
  border-bottom: 1px solid var(--k-color-divider, rgba(82, 82, 89, 0.5));
}

.modal-header h3 {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--fg1, rgba(255, 255, 245, 0.9));
}

.close-btn {
  cursor: pointer;
  padding: 4px;
  border-radius: 3px;
  color: var(--fg3, rgba(255, 255, 245, 0.4));
  transition: all 0.12s ease;
}

.close-btn:hover {
  background: var(--bg3, #313136);
  color: var(--fg1, rgba(255, 255, 245, 0.9));
}

.widget-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 50vh;
  overflow-y: auto;
}

.widget-option {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem;
  border: 1px solid var(--k-color-divider, rgba(82, 82, 89, 0.5));
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.12s ease;
  background: transparent;
}

.widget-option:hover {
  border-color: var(--k-color-primary, #7459ff);
  background: rgba(116, 89, 255, 0.08);
}

.widget-preview {
  width: 32px;
  height: 32px;
  background: var(--bg3, #313136);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: var(--fg2, rgba(255, 255, 245, 0.6));
  flex-shrink: 0;
}

.widget-info h4 {
  margin: 0 0 2px 0;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--fg1, rgba(255, 255, 245, 0.9));
}

.widget-info p {
  margin: 0;
  font-size: 0.7rem;
  color: var(--fg3, rgba(255, 255, 245, 0.4));
}

/* 响应式布局 */
@media (max-width: 1200px) {
  .bento-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .bento-grid {
    grid-template-columns: 1fr;
  }

  .hero-section {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .hero-actions {
    align-self: flex-end;
  }
}
</style>