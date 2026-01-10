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
        :style="{ gridColumn: `span ${item.span}`, animationDelay: `${Math.min(index * 0.05, 0.6)}s` }"
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
  { id: 'stat-groups', type: 'StatCard', span: 1, props: { type: 'blue', icon: 'users', label: '已配置群组' }, dynamicProps: { value: 'stats.totalGroups', loading: 'loading' } },
  { id: 'stat-warns', type: 'StatCard', span: 1, props: { type: 'orange', icon: 'alert-triangle', label: '警告记录' }, dynamicProps: { value: 'stats.totalWarns', loading: 'loading' } },
  { id: 'stat-blacklist', type: 'StatCard', span: 1, props: { type: 'red', icon: 'user-x', label: '黑名单用户' }, dynamicProps: { value: 'stats.totalBlacklisted', loading: 'loading' } },
  { id: 'stat-subscriptions', type: 'StatCard', span: 1, props: { type: 'green', icon: 'rss', label: '活跃订阅' }, dynamicProps: { value: 'stats.totalSubscriptions', loading: 'loading' } },
  { id: 'notice', type: 'NoticeCard', span: 4, dynamicProps: { content: 'notice' } }
]

const layout = ref<WidgetConfig[]>(loadLayout())

function loadLayout() {
  const saved = localStorage.getItem('gh-dashboard-layout')
  if (saved) {
    try {
      // 合并默认配置，防止组件改名后丢失
      return JSON.parse(saved)
    } catch (e) { console.error(e) }
  }
  return JSON.parse(JSON.stringify(defaultLayout))
}

function saveLayout() {
  localStorage.setItem('gh-dashboard-layout', JSON.stringify(layout.value))
}

// 可用组件定义（StatCard 为内置组件，不可手动添加）
const availableWidgets = [
  { type: 'NoticeCard', name: '公告卡片', description: '显示公告内容', icon: 'grouphelper:bell', span: 4, defaultDynamicProps: { content: 'notice' } },
  { type: 'TrendChartCard', name: '趋势图表', description: '显示命令使用趋势', icon: 'grouphelper:trending-up', span: 2, defaultDynamicProps: { data: 'chartData.trend', loading: 'chartLoading' } },
  { type: 'DistChartCard', name: '命令排行', description: '显示命令使用分布', icon: 'grouphelper:bar-chart-2', span: 1, defaultDynamicProps: { data: 'chartData.distribution', loading: 'chartLoading' } },
  { type: 'RankChartCard', name: '群聊排行', description: '显示群聊活跃排行', icon: 'grouphelper:users', span: 1, defaultProps: { type: 'guild', title: '群聊排行', icon: 'users' }, defaultDynamicProps: { data: 'chartData.guildRank', loading: 'chartLoading' } },
  { type: 'RankChartCard', name: '个人排行', description: '显示用户活跃排行', icon: 'grouphelper:user', span: 1, defaultProps: { type: 'user', title: '个人排行', icon: 'user' }, defaultDynamicProps: { data: 'chartData.userRank', loading: 'chartLoading' } },
  { type: 'VersionCard', name: '版本信息', description: '显示版本信息', icon: 'tag', span: 1, defaultDynamicProps: { stats: 'stats', versions: 'versions' } },
  { type: 'UpdatesCard', name: '最近更新', description: '显示最近的代码提交', icon: 'grouphelper:clock', span: 2, defaultDynamicProps: { commits: 'commits', error: 'commitsError' } }
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
   去 AI 味，硬核专业高信噪比
   ======================================== */

.dashboard-container {
  padding: 1.25rem;
  max-width: 1600px;
  margin: 0 auto;
  height: 100%;
  overflow-y: auto;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
}

/* Hero Section - 更紧凑的顶部区域 */
.hero-section {
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0.25rem;
}

.hero-content {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.hero-icon {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hero-icon :deep(svg) {
  width: 44px;
  height: 44px;
}

.hero-text h1 {
  margin: 0 0 0.125rem 0;
  font-size: 1.375rem;
  font-weight: 600;
  letter-spacing: -0.25px;
  color: var(--fg1, var(--k-color-text));
}

.hero-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--fg2, var(--k-color-text-description));
  font-size: 0.8rem;
}

/* 状态指示器 - 实心小圆点，无发光效果 */
.status-indicator {
  display: flex;
  align-items: center;
  gap: 5px;
  color: #3ba55e;
  font-weight: 500;
  font-size: 0.75rem;
  background: rgba(59, 165, 94, 0.12);
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid rgba(59, 165, 94, 0.2);
}

/* 克制的实心圆点，无高斯模糊 */
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #3ba55e;
}

/* 版本标签 - 等宽字体 */
.version-tag {
  background: var(--bg3, var(--k-bg-light));
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace;
  font-size: 0.75rem;
  color: var(--fg2, var(--k-color-text-description));
  border: 1px solid var(--k-color-divider, rgba(82, 82, 89, 0.5));
}

/* 按钮 - GitHub 风格次要按钮 */
.button {
  cursor: pointer;
  padding: 0.375rem 0.625rem;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  font-weight: 500;
  transition: all 0.15s ease;
  user-select: none;
  background: var(--bg3, #313136);
  color: var(--fg2, rgba(255, 255, 245, 0.9));
  border: 1px solid var(--k-color-divider, rgba(82, 82, 89, 0.5));
}

.button:hover {
  background: var(--bg2, #252529);
  border-color: var(--k-color-border, rgba(82, 82, 89, 0.8));
  color: var(--fg1, #fff);
}

.button.is-primary {
  background: rgba(59, 185, 80, 0.15);
  color: #3fb950;
  border-color: rgba(59, 185, 80, 0.3);
}

.button.is-primary:hover {
  background: rgba(59, 185, 80, 0.25);
  border-color: rgba(59, 185, 80, 0.5);
}

/* Grid Layout - 更紧凑的间距 */
.bento-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-auto-rows: auto;
  gap: 1rem;
  padding-bottom: 1.5rem;
}

.grid-item {
  position: relative;
  transition: transform 0.15s ease, opacity 0.15s ease;
  animation: card-enter 0.35s ease-out backwards;
}

@keyframes card-enter {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.bento-grid.is-editing .grid-item {
  border: 1px dashed var(--k-color-divider, rgba(82, 82, 89, 0.5));
  border-radius: 8px;
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
  background: rgba(0, 0, 0, 0.4);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.grid-item:hover .edit-overlay {
  opacity: 1;
}

.remove-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  background: #ff595a;
  color: #fff;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s ease;
}

.remove-btn:hover {
  background: #ff3d3e;
}

.drag-handle {
  color: var(--fg1, #fff);
  font-size: 1.5rem;
  opacity: 0.7;
}

/* Add Placeholder - 统一圆角 */
.add-widget-placeholder {
  grid-column: span 1;
  border: 1px dashed var(--k-color-divider, rgba(82, 82, 89, 0.5)) !important;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--fg3, var(--k-color-text-description));
  cursor: pointer !important;
  transition: all 0.15s ease;
  min-height: 140px;
  background: transparent;
}

.add-widget-placeholder:hover {
  border-color: var(--k-color-primary, #7459ff) !important;
  color: var(--k-color-primary, #7459ff);
  background: var(--k-color-primary-fade, rgba(116, 89, 255, 0.1));
}

.add-widget-placeholder .k-icon {
  font-size: 1.5rem;
  margin-bottom: 0.375rem;
}

/* Modal - GitHub 风格弹窗 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(2px);
}

.modal-content {
  background: var(--bg2, var(--k-card-bg));
  width: 440px;
  max-width: 90vw;
  border-radius: 8px;
  padding: 1.25rem;
  border: 1px solid var(--k-color-divider, rgba(82, 82, 89, 0.5));
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--k-color-divider, rgba(82, 82, 89, 0.5));
}

.modal-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--fg1, var(--k-color-text));
}

.close-btn {
  cursor: pointer;
  padding: 0.375rem;
  border-radius: 4px;
  color: var(--fg3, var(--k-color-text-description));
  transition: all 0.15s ease;
}

.close-btn:hover {
  background: var(--bg3, var(--k-color-bg-2));
  color: var(--fg1, var(--k-color-text));
}

.widget-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 55vh;
  overflow-y: auto;
}

.widget-option {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 0.75rem;
  border: 1px solid var(--k-color-divider, rgba(82, 82, 89, 0.5));
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  background: transparent;
}

.widget-option:hover {
  border-color: var(--k-color-primary, #7459ff);
  background: var(--k-color-primary-fade, rgba(116, 89, 255, 0.1));
}

.widget-preview {
  width: 36px;
  height: 36px;
  background: var(--bg3, var(--k-color-bg-2));
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  color: var(--fg2, var(--k-color-text));
  flex-shrink: 0;
}

.widget-info h4 {
  margin: 0 0 0.125rem 0;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--fg1, var(--k-color-text));
}

.widget-info p {
  margin: 0;
  font-size: 0.75rem;
  color: var(--fg3, var(--k-color-text-description));
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
    gap: 1rem;
  }

  .hero-actions {
    align-self: flex-end;
  }
}
</style>