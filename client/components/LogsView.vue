<template>
  <div class="logs-view">
    <!-- 顶部标题栏 -->
    <div class="view-header">
      <div class="header-left">
        <k-icon name="grouphelper:file-text" class="header-icon" />
        <h2 class="view-title">日志检索</h2>
        <span class="record-count" v-if="total > 0">{{ total.toLocaleString() }} 条记录</span>
      </div>
      <div class="header-actions">
        <button class="btn btn-ghost" @click="resetColumnWidths" title="重置列宽">
          <k-icon name="columns" />
        </button>
        <button class="btn btn-secondary" @click="resetFilters">
          <k-icon name="x" />
          重置
        </button>
        <button class="btn btn-primary" @click="searchLogs">
          <k-icon name="search" />
          搜索
        </button>
      </div>
    </div>

    <!-- 搜索栏 - 更紧凑的网格布局 -->
    <div class="search-panel">
      <!-- 时间范围单独一行 -->
      <div class="search-row-time">
        <div class="search-field search-field-time">
          <label>时间范围</label>
          <el-date-picker
            v-model="dateRange"
            type="datetimerange"
            range-separator="→"
            start-placeholder="开始"
            end-placeholder="结束"
            value-format="x"
            size="small"
            class="date-picker"
          />
        </div>
      </div>
      <!-- 其他筛选条件 -->
      <div class="search-grid">
        <div class="search-field">
          <label>命令</label>
          <el-input v-model="searchParams.command" placeholder="命令名..." clearable size="small" />
        </div>
        <div class="search-field">
          <label>用户ID</label>
          <el-input v-model="searchParams.userId" placeholder="用户ID..." clearable size="small" />
        </div>
        <div class="search-field">
          <label>用户名</label>
          <el-input v-model="searchParams.username" placeholder="用户名..." clearable size="small" />
        </div>
        <div class="search-field">
          <label>群组ID</label>
          <el-input v-model="searchParams.guildId" placeholder="群组ID..." clearable size="small" />
        </div>
        <div class="search-field">
          <label>详情</label>
          <el-input v-model="searchParams.details" placeholder="关键词..." clearable size="small" />
        </div>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <k-icon name="loader" class="spin" />
      <span>正在加载数据...</span>
    </div>

    <!-- 日志列表 -->
    <div v-else class="logs-container">
      <div v-if="logs.length === 0" class="empty-state">
        <k-icon name="inbox" class="empty-icon" />
        <p>暂无日志记录</p>
        <span class="empty-hint">尝试调整筛选条件或等待新数据</span>
      </div>

      <div class="logs-table" v-else>
        <div class="table-header">
          <div class="col col-time" :style="{ width: columnWidths.time + 'px' }">
            时间
            <div class="resize-handle" @mousedown="startResize($event, 'time')"></div>
          </div>
          <div class="col col-cmd" :style="{ width: columnWidths.cmd + 'px' }">
            命令
            <div class="resize-handle" @mousedown="startResize($event, 'cmd')"></div>
          </div>
          <div class="col col-user" :style="{ width: columnWidths.user + 'px' }">
            用户
            <div class="resize-handle" @mousedown="startResize($event, 'user')"></div>
          </div>
          <div class="col col-userid" :style="{ width: columnWidths.userid + 'px' }">
            用户ID
            <div class="resize-handle" @mousedown="startResize($event, 'userid')"></div>
          </div>
          <div class="col col-group" :style="{ width: columnWidths.group + 'px' }">
            群组
            <div class="resize-handle" @mousedown="startResize($event, 'group')"></div>
          </div>
          <div class="col col-status" :style="{ width: columnWidths.status + 'px' }">
            状态
            <div class="resize-handle" @mousedown="startResize($event, 'status')"></div>
          </div>
          <div class="col col-detail">详情</div>
        </div>
        <div class="table-body">
          <div
            v-for="(log, index) in logs"
            :key="log.id"
            class="table-row"
            :style="{ animationDelay: `${Math.min(index * 0.015, 0.2)}s` }"
            @click="openDetail(log)"
          >
            <div class="col col-time" :style="{ width: columnWidths.time + 'px' }">
              <span class="time-value">{{ formatTime(log.timestamp) }}</span>
            </div>
            <div class="col col-cmd" :style="{ width: columnWidths.cmd + 'px' }">
              <code class="cmd-tag">{{ log.command }}</code>
            </div>
            <div class="col col-user" :style="{ width: columnWidths.user + 'px' }" :title="log.username">{{ log.username || '-' }}</div>
            <div class="col col-userid" :style="{ width: columnWidths.userid + 'px' }" :title="log.userId">
              <code>{{ log.userId }}</code>
            </div>
            <div class="col col-group" :style="{ width: columnWidths.group + 'px' }" :title="log.guildId">{{ log.guildName || log.guildId || '私聊' }}</div>
            <div class="col col-status" :style="{ width: columnWidths.status + 'px' }">
              <span class="status-badge" :class="log.success ? 'success' : 'fail'">
                <span class="status-dot"></span>
                {{ log.success ? '成功' : '失败' }}
              </span>
            </div>
            <div class="col col-detail" :title="getDetail(log)">
              {{ getDetail(log) }}
            </div>
          </div>
        </div>
      </div>

      <!-- 分页 -->
      <div class="pagination-bar" v-if="total > 0">
        <el-pagination
          v-model:current-page="searchParams.page"
          v-model:page-size="searchParams.pageSize"
          :total="total"
          :page-sizes="[20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          size="small"
          @size-change="refreshLogs"
          @current-change="refreshLogs"
        />
      </div>
    </div>

    <!-- 详情弹窗 -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="detailLog" class="detail-overlay" @click="closeDetail">
          <div class="detail-modal" @click.stop>
            <div class="detail-header">
              <div class="detail-title">
                <code class="detail-cmd">{{ detailLog.command }}</code>
                <span class="status-badge" :class="detailLog.success ? 'success' : 'fail'">
                  <span class="status-dot"></span>
                  {{ detailLog.success ? '成功' : '失败' }}
                </span>
              </div>
              <button class="detail-close" @click="closeDetail">
                <k-icon name="x" />
              </button>
            </div>
            <div class="detail-body">
              <div class="detail-section">
                <h4>基本信息</h4>
                <div class="detail-grid">
                  <div class="detail-item">
                    <label>时间</label>
                    <span class="mono">{{ formatTime(detailLog.timestamp) }}</span>
                  </div>
                  <div class="detail-item">
                    <label>用户</label>
                    <span>{{ detailLog.username || '-' }}</span>
                  </div>
                  <div class="detail-item">
                    <label>用户ID</label>
                    <span class="mono">{{ detailLog.userId }}</span>
                  </div>
                  <div class="detail-item">
                    <label>群组</label>
                    <span>{{ detailLog.guildName || detailLog.guildId || '私聊' }}</span>
                  </div>
                  <div class="detail-item" v-if="detailLog.guildId">
                    <label>群组ID</label>
                    <span class="mono">{{ detailLog.guildId }}</span>
                  </div>
                </div>
              </div>
              <div class="detail-section" v-if="detailLog.args && detailLog.args.length > 0">
                <h4>命令参数</h4>
                <div class="detail-code">
                  <code>{{ detailLog.args.join(' ') }}</code>
                </div>
              </div>
              <div class="detail-section" v-if="detailLog.options && Object.keys(detailLog.options).length > 0">
                <h4>命令选项</h4>
                <div class="detail-code">
                  <pre>{{ JSON.stringify(detailLog.options, null, 2) }}</pre>
                </div>
              </div>
              <div class="detail-section" v-if="detailLog.result">
                <h4>执行结果</h4>
                <div class="detail-code">
                  <pre>{{ detailLog.result }}</pre>
                </div>
              </div>
              <div class="detail-section" v-if="!detailLog.success && detailLog.error">
                <h4>错误信息</h4>
                <div class="detail-code error">
                  <pre>{{ detailLog.error }}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
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

// ======== 列宽调整功能 ========
interface ColumnWidths {
  time: number
  cmd: number
  user: number
  userid: number
  group: number
  status: number
}

const defaultWidths: ColumnWidths = {
  time: 145,
  cmd: 90,
  user: 100,
  userid: 110,
  group: 100,
  status: 70
}

// 从 localStorage 加载列宽
const loadColumnWidths = (): ColumnWidths => {
  const saved = localStorage.getItem('gh-logs-column-widths')
  if (saved) {
    try {
      return { ...defaultWidths, ...JSON.parse(saved) }
    } catch (e) { /* ignore */ }
  }
  return { ...defaultWidths }
}

const columnWidths = reactive<ColumnWidths>(loadColumnWidths())

// 保存列宽到 localStorage
const saveColumnWidths = () => {
  localStorage.setItem('gh-logs-column-widths', JSON.stringify(columnWidths))
}

// 拖拽调整列宽
let resizing = false
let resizeColumn: keyof ColumnWidths | null = null
let startX = 0
let startWidth = 0

const startResize = (e: MouseEvent, column: keyof ColumnWidths) => {
  e.preventDefault()
  resizing = true
  resizeColumn = column
  startX = e.clientX
  startWidth = columnWidths[column]
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

const onMouseMove = (e: MouseEvent) => {
  if (!resizing || !resizeColumn) return
  const diff = e.clientX - startX
  const newWidth = Math.max(50, Math.min(400, startWidth + diff))
  columnWidths[resizeColumn] = newWidth
}

const onMouseUp = () => {
  if (resizing) {
    resizing = false
    resizeColumn = null
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    saveColumnWidths()
  }
}

// 重置列宽
const resetColumnWidths = () => {
  Object.assign(columnWidths, defaultWidths)
  saveColumnWidths()
}

onMounted(() => {
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
  refreshLogs()
})

onUnmounted(() => {
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
})

/**
 * 请求序号：切换 pageSize 时分页组件会同时触发 size-change 与 current-change，
 * 慢的那个请求后返回就会覆盖新结果，导致表格内容与分页器状态对不上。
 */
let logsRequestId = 0

const refreshLogs = async () => {
  const requestId = ++logsRequestId
  loading.value = true
  try {
    const params: LogSearchParams = { ...searchParams }
    if (dateRange.value) {
      params.startTime = dateRange.value[0]
      params.endTime = dateRange.value[1]
    }

    const result = await logsApi.search(params)
    if (requestId !== logsRequestId) return
    logs.value = result.list
    total.value = result.total
  } catch (e: any) {
    if (requestId !== logsRequestId) return
    message.error(e.message || '加载日志失败')
  } finally {
    if (requestId === logsRequestId) loading.value = false
  }
}

/** 条件变更后的查询入口：必须回到第 1 页，否则在第 5 页改筛选会查到空结果 */
const searchLogs = () => {
  searchParams.page = 1
  refreshLogs()
}

const formatTime = (timestamp: string | number) => {
  return new Date(timestamp).toLocaleString('zh-CN')
}

const resetFilters = () => {
  dateRange.value = null
  searchParams.command = undefined
  searchParams.userId = undefined
  searchParams.username = undefined
  searchParams.guildId = undefined
  searchParams.details = undefined
  searchParams.page = 1
  // 清空条件后要重新查询，否则表格仍显示旧的筛选结果，与表单状态不符
  refreshLogs()
}

const getDetail = (log: LogRecord) => {
  if (!log.success && log.error) return log.error
  if (log.result) return log.result
  if (Object.keys(log.options).length > 0) return JSON.stringify(log.options)
  if (log.args.length > 0) return log.args.join(' ')
  return '-'
}

// ======== 详情弹窗 ========
const detailLog = ref<LogRecord | null>(null)

const openDetail = (log: LogRecord) => {
  detailLog.value = log
}

const closeDetail = () => {
  detailLog.value = null
}
</script>

<style scoped>
/* ========================================
   GitHub Dimmed / Vercel 风格日志视图
   硬核专业高信噪比 · Developer-First
   ======================================== */

.logs-view {
  --mono: 'JetBrains Mono', 'SF Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace;
  --radius: 6px;
  --radius-sm: 4px;
  --border: 1px solid var(--k-color-divider);
  --border-subtle: 1px solid var(--k-color-divider);

  height: 100%;
  display: flex;
  flex-direction: column;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  gap: 10px;
  color: var(--fg2);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* ======== 头部区域 ======== */
.view-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-icon {
  font-size: 1rem;
  color: var(--fg3);
  opacity: 0.7;
}

.view-title {
  font-size: 0.9375rem;
  font-weight: 600;
  letter-spacing: -0.015em;
  color: var(--fg1);
  margin: 0;
}

.record-count {
  font-size: 0.6875rem;
  font-family: var(--mono);
  font-feature-settings: 'tnum' 1;
  color: var(--fg3);
  background: var(--bg3);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  border: var(--border-subtle);
}

.header-actions {
  display: flex;
  gap: 6px;
}

/* ======== 按钮样式 ======== */
.btn {
  cursor: pointer;
  padding: 5px 10px;
  border-radius: var(--radius);
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  transition: all 0.12s ease;
  user-select: none;
  border: var(--border);
  line-height: 1;
}

.btn-secondary {
  background: var(--bg3);
  color: var(--fg2);
}

.btn-secondary:hover {
  background: var(--bg3);
  border-color: var(--k-color-border);
  color: var(--fg1);
}

.btn-primary {
  background: var(--k-color-primary-fade);
  color: var(--k-color-primary);
  border-color: rgba(116, 89, 255, 0.2);
}

.btn-primary:hover {
  background: rgba(116, 89, 255, 0.18);
  border-color: rgba(116, 89, 255, 0.35);
  color: var(--k-color-primary);
}

.btn-ghost {
  background: transparent;
  color: var(--fg3);
  border-color: transparent;
  padding: 5px;
}

.btn-ghost:hover {
  background: var(--bg3);
  color: var(--fg2);
  border-color: var(--k-color-divider);
}

/* ======== 搜索面板 ======== */
.search-panel {
  background: var(--bg2);
  border: 1px solid var(--k-color-divider);
  border-radius: 6px;
  padding: 0.75rem 0.875rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

/* 时间范围单独一行 */
.search-row-time {
  display: flex;
}

.search-field-time {
  flex: 1;
  max-width: 380px;
}

.search-field-time :deep(.el-range-editor) {
  width: 100% !important;
}

.search-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 0.625rem;
}

.search-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.search-field label {
  font-size: 0.625rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--fg3);
}

.search-field :deep(.el-input__wrapper),
.search-field :deep(.el-range-editor) {
  background: var(--bg3) !important;
  border-color: var(--k-color-divider) !important;
  box-shadow: none !important;
  border-radius: 4px !important;
  height: 28px !important;
  line-height: 28px !important;
}

.search-field :deep(.el-input__inner),
.search-field :deep(.el-range-input) {
  font-size: 0.8rem !important;
  color: var(--fg1) !important;
}

.search-field :deep(.el-input__inner)::placeholder,
.search-field :deep(.el-range-input)::placeholder {
  color: var(--fg3) !important;
}

/* ======== 加载状态 ======== */
.loading-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  color: var(--fg3);
  font-size: 0.75rem;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ======== 日志容器 ======== */
.logs-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg2);
  border: 1px solid var(--k-color-divider);
  border-radius: 6px;
}

/* ======== 空状态 ======== */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  color: var(--fg3);
  padding: 2.5rem;
}

.empty-icon {
  font-size: 2rem;
  opacity: 0.35;
}

.empty-state p {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--fg2);
}

.empty-hint {
  font-size: 0.7rem;
}

/* ======== 表格样式 ======== */
.logs-table {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.table-header {
  display: flex;
  padding: 0.5rem 0.875rem;
  background: var(--bg3);
  border-bottom: 1px solid var(--k-color-divider);
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--fg3);
  flex-shrink: 0;
}

.table-header .col {
  position: relative;
  user-select: none;
}

/* ======== 拖拽调整手柄 ======== */
.resize-handle {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: col-resize;
}

.resize-handle::after {
  content: '';
  position: absolute;
  right: 2px;
  top: 20%;
  bottom: 20%;
  width: 1px;
  background: var(--k-color-divider);
  opacity: 0;
  transition: opacity 0.1s;
}

.table-header .col:hover .resize-handle::after {
  opacity: 0.6;
}

.resize-handle:hover::after,
.resize-handle:active::after {
  opacity: 1;
  background: var(--k-color-primary);
}

.table-body {
  flex: 1;
  overflow-y: auto;
}

.table-row {
  display: flex;
  padding: 0.4375rem 0.875rem;
  border-bottom: 1px solid var(--k-color-divider);
  align-items: center;
  font-size: 0.8rem;
  cursor: pointer;
  transition: background-color 0.1s ease;
}

.table-row:last-child {
  border-bottom: none;
}

.table-row:hover {
  background: var(--k-hover-bg);
}

/* ======== 列样式 ======== */
.col {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
  padding-right: 6px;
}

.col-time {
  min-width: 80px;
}

.time-value {
  font-family: 'JetBrains Mono', 'SF Mono', 'Cascadia Code', Consolas, monospace;
  font-size: 0.7rem;
  font-feature-settings: 'tnum' 1;
  color: var(--fg3);
  letter-spacing: -0.01em;
}

.col-cmd {
  min-width: 60px;
}

.cmd-tag {
  font-family: 'JetBrains Mono', 'SF Mono', 'Cascadia Code', Consolas, monospace;
  font-size: 0.6875rem;
  background: var(--k-color-primary-fade);
  color: var(--k-color-primary);
  padding: 2px 5px;
  border-radius: 3px;
  border: 1px solid rgba(116, 89, 255, 0.18);
}

.col-user {
  min-width: 60px;
  color: var(--fg2);
}

.col-userid {
  min-width: 60px;
}

.col-userid code {
  font-family: 'JetBrains Mono', 'SF Mono', 'Cascadia Code', Consolas, monospace;
  font-size: 0.6875rem;
  color: var(--fg3);
}

.col-group {
  min-width: 60px;
  color: var(--fg2);
}

.col-status {
  min-width: 50px;
}

.col-detail {
  flex: 1;
  flex-shrink: 1;
  color: var(--fg3);
  font-size: 0.7rem;
}

/* ======== 状态徽章 - 实心小圆点，克制颜色 ======== */
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.6875rem;
  font-weight: 500;
  padding: 1px 5px;
  border-radius: 3px;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

/* 成功 - 暗绿色，克制 */
.status-badge.success {
  background: var(--k-color-success-fade);
  color: var(--k-color-success);
  border: 1px solid rgba(46, 160, 67, 0.15);
}

.status-badge.success .status-dot {
  background: var(--k-color-success);
}

/* 失败 - 暗红色 */
.status-badge.fail {
  background: var(--k-color-danger-fade);
  color: var(--k-color-danger);
  border: 1px solid rgba(218, 54, 51, 0.15);
}

.status-badge.fail .status-dot {
  background: var(--k-color-danger);
}

/* ======== 分页栏 ======== */
.pagination-bar {
  padding: 0.5rem 0.875rem;
  border-top: 1px solid var(--k-color-divider);
  display: flex;
  justify-content: flex-end;
  background: var(--bg3);
}

.pagination-bar :deep(.el-pagination) {
  --el-pagination-font-size: 11px;
}

.pagination-bar :deep(.el-pagination button),
.pagination-bar :deep(.el-pager li) {
  background: transparent !important;
  color: var(--fg2) !important;
  border-radius: 4px !important;
  min-width: 24px;
  height: 24px;
}

.pagination-bar :deep(.el-pager li.is-active) {
  background: var(--k-color-primary) !important;
  color: #fff !important;
}

/* ======== 滚动条 ======== */
.table-body::-webkit-scrollbar {
  width: 4px;
}

.table-body::-webkit-scrollbar-track {
  background: transparent;
}

.table-body::-webkit-scrollbar-thumb {
  background: var(--k-color-divider);
  border-radius: 2px;
}

.table-body::-webkit-scrollbar-thumb:hover {
  background: var(--fg3);
}

/* ======== 响应式 ======== */
@media (max-width: 1200px) {
  .search-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 900px) {
  .search-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .col-userid,
  .col-group {
    display: none;
  }
}

@media (max-width: 600px) {
  .search-grid {
    grid-template-columns: 1fr;
  }

  .col-detail {
    display: none;
  }
}

/* ======== 详情弹窗 ======== */
.detail-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 1.5rem;
}

.detail-modal {
  background: var(--bg2);
  border: 1px solid var(--k-color-divider);
  border-radius: 6px;
  width: 100%;
  max-width: 520px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--k-color-divider);
  background: var(--bg3);
}

.detail-title {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.detail-cmd {
  font-family: 'JetBrains Mono', 'SF Mono', 'Cascadia Code', Consolas, monospace;
  font-size: 0.8rem;
  font-weight: 600;
  background: var(--k-color-primary-fade);
  color: var(--k-color-primary);
  padding: 3px 8px;
  border-radius: 4px;
  border: 1px solid rgba(116, 89, 255, 0.18);
}

.detail-close {
  background: transparent;
  border: none;
  color: var(--fg3);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.1s, color 0.1s;
}

.detail-close:hover {
  background: var(--k-hover-bg);
  color: var(--fg1);
}

.detail-body {
  padding: 1rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.detail-section h4 {
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--fg3);
  margin: 0 0 0.5rem 0;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.detail-item label {
  font-size: 0.6rem;
  color: var(--fg3);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.detail-item span {
  font-size: 0.75rem;
  color: var(--fg1);
}

.detail-item .mono {
  font-family: 'JetBrains Mono', 'SF Mono', 'Cascadia Code', Consolas, monospace;
  font-size: 0.7rem;
  font-feature-settings: 'tnum' 1;
  color: var(--fg2);
}

.detail-code {
  background: var(--bg1);
  border: 1px solid var(--k-color-divider);
  border-radius: 4px;
  padding: 0.625rem;
  overflow-x: auto;
}

.detail-code code,
.detail-code pre {
  font-family: 'JetBrains Mono', 'SF Mono', 'Cascadia Code', Consolas, monospace;
  font-size: 0.7rem;
  color: var(--fg2);
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.5;
}

.detail-code.error {
  border-color: rgba(218, 54, 51, 0.25);
  background: rgba(218, 54, 51, 0.04);
}

.detail-code.error pre {
  color: var(--k-color-danger);
}

/* 弹窗动画 */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.15s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .detail-modal,
.modal-leave-to .detail-modal {
  transform: scale(0.97) translateY(8px);
}

.modal-enter-active .detail-modal,
.modal-leave-active .detail-modal {
  transition: transform 0.15s ease;
}

/* ========================================
   移动端适配 (< 768px)
   ======================================== */
@media (max-width: 768px) {
  .logs-view {
    padding: 0;
  }

  .view-header {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
    padding: 0.75rem;
  }

  .header-left {
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .view-title {
    font-size: 1rem;
  }

  .record-count {
    font-size: 0.7rem;
    width: 100%;
  }

  .header-actions {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
  }

  .header-actions .btn {
    padding: 0.5rem;
    font-size: 0.75rem;
    justify-content: center;
  }

  /* 搜索面板 */
  .search-panel {
    padding: 0.75rem;
  }

  .search-row-time {
    margin-bottom: 0.75rem;
  }

  .search-field-time {
    width: 100%;
  }

  .search-field-time .date-picker {
    width: 100%;
  }

  .search-grid {
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }

  .search-field label {
    font-size: 0.65rem;
  }

  /* 表格改为卡片列表 */
  .logs-table {
    display: flex;
    flex-direction: column;
  }

  .table-header {
    display: none;
  }

  .table-row {
    display: flex;
    flex-direction: column;
    padding: 0.75rem;
    gap: 0.375rem;
    border-bottom: 1px solid var(--k-color-divider);
  }

  .table-row .col {
    width: 100% !important;
    padding: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .table-row .col::before {
    content: attr(data-label);
    font-size: 0.65rem;
    color: var(--fg3);
    min-width: 50px;
    text-transform: uppercase;
  }

  .table-row .col-time {
    order: -1;
    font-size: 0.7rem;
  }

  .table-row .col-status {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
  }

  .resize-handle {
    display: none;
  }

  /* 分页 */
  .pagination {
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem;
  }

  .page-info {
    width: 100%;
    text-align: center;
    font-size: 0.7rem;
  }

  .page-btns {
    gap: 0.25rem;
  }

  .page-btn {
    min-width: 32px;
    height: 32px;
    padding: 0.375rem;
    font-size: 0.75rem;
  }

  /* 详情弹窗 */
  .detail-overlay {
    padding: 0.5rem;
  }

  .detail-modal {
    max-width: 100%;
    max-height: 90vh;
  }

  .detail-header {
    padding: 0.75rem;
  }

  .detail-header h3 {
    font-size: 0.85rem;
  }

  .detail-body {
    padding: 0.75rem;
    max-height: 65vh;
  }

  .detail-group h4 {
    font-size: 0.7rem;
  }

  .detail-grid {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }

  .detail-item .label {
    font-size: 0.6rem;
  }

  .detail-item .value {
    font-size: 0.75rem;
  }
}

/* 小屏手机适配 (< 480px) */
@media (max-width: 480px) {
  .view-header {
    padding: 0.5rem;
  }

  .view-title {
    font-size: 0.9rem;
  }

  .search-panel {
    padding: 0.5rem;
  }

  .search-grid {
    grid-template-columns: 1fr;
  }

  .table-row {
    padding: 0.5rem;
    font-size: 0.75rem;
  }

  .page-btn {
    min-width: 28px;
    height: 28px;
    font-size: 0.7rem;
  }
}
</style>
