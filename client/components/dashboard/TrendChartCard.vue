<template>
  <div class="card chart-card trend-card">
    <div class="card-header">
      <k-icon name="grouphelper:trending-up" />
      <h3>命令趋势</h3>
      <span class="chart-subtitle">7 天</span>
    </div>
    <div class="chart-container">
      <div v-if="loading" class="chart-loading">
        <k-icon name="loader" class="spin" />
      </div>
      <div v-else-if="!data || data.length === 0" class="chart-empty">
        暂无数据
      </div>
      <div v-else class="bar-chart">
        <div class="chart-bars">
          <div
            v-for="item in data"
            :key="item.date"
            class="bar-wrapper"
            :title="`${item.date}: ${item.count} 次`"
          >
            <span class="bar-value">{{ item.count }}</span>
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
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  data: any[]
  loading?: boolean
}>()

const maxTrendCount = computed(() => {
  if (!props.data || props.data.length === 0) return 1
  return Math.max(...props.data.map(i => i.count), 1)
})

const totalCommands = computed(() => {
  if (!props.data) return 0
  return props.data.reduce((sum, item) => sum + item.count, 0)
})

const getBarHeight = (count: number, max: number) => {
  if (max === 0) return 0
  return Math.max((count / max) * 75, 2)
}
</script>

<style scoped>
/* GitHub Dimmed 风格趋势图表卡片 */
.card {
  background: var(--bg2, var(--k-card-bg));
  border-radius: 6px;
  padding: 1rem 1.25rem;
  border: 1px solid var(--k-color-divider, rgba(82, 82, 89, 0.5));
  transition: border-color 0.15s ease;
  height: 100%;
  min-height: 320px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.card:hover {
  border-color: var(--k-color-border, rgba(82, 82, 89, 0.8));
}

/* 卡片头部 */
.card-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  color: var(--fg1, var(--k-color-text));
  font-weight: 500;
}

.card-header h3 {
  margin: 0;
  font-size: 0.875rem;
}

.chart-subtitle {
  margin-left: auto;
  font-size: 0.7rem;
  font-weight: 400;
  color: var(--fg3, var(--k-color-text-description));
  background: var(--bg3, var(--k-color-bg-2));
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
}

.chart-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.chart-loading, .chart-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--fg3, var(--k-color-text-description));
  font-size: 0.8rem;
}

.bar-chart {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.chart-bars {
  flex: 1;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 3px;
  padding: 0 2px;
  min-height: 0;
}

.bar-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  height: 100%;
  justify-content: flex-end;
}

/* 柱状图 - 直角或微圆角 */
.bar {
  width: 100%;
  max-width: 36px;
  background: var(--k-color-primary, #7459ff);
  border-radius: 2px 2px 0 0;
  transition: height 0.4s ease, opacity 0.15s ease;
  min-height: 2px;
}

.bar-wrapper:hover .bar {
  opacity: 0.8;
}

/* 数值 - 等宽字体 */
.bar-value {
  font-size: 0.65rem;
  font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  color: var(--fg3, var(--k-color-text-description));
  margin-bottom: 2px;
  transition: color 0.15s ease;
}

.bar-wrapper:hover .bar-value {
  color: var(--k-color-primary, #7459ff);
}

/* 标签 */
.bar-label {
  font-size: 0.6rem;
  font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  color: var(--fg3, var(--k-color-text-description));
  white-space: nowrap;
}

/* 底部统计 */
.chart-total {
  text-align: center;
  font-size: 0.7rem;
  font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  color: var(--fg3, var(--k-color-text-description));
  padding-top: 0.5rem;
  border-top: 1px solid var(--k-color-divider, rgba(82, 82, 89, 0.5));
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>