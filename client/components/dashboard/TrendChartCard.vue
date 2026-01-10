<template>
  <div class="card chart-card trend-card">
    <div class="card-header">
      <k-icon name="trending-up" />
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
  return Math.max((count / max) * 100, 2)
}
</script>

<style scoped>
.card {
  background: var(--k-card-bg);
  border-radius: 20px;
  padding: 1.5rem;
  border: 1px solid var(--k-color-border);
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  height: 360px;
  box-sizing: border-box;
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

.spin {
  animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>