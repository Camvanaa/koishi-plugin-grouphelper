<template>
  <div class="card chart-card distribution-card">
    <div class="card-header">
      <k-icon name="grouphelper:octicons.bar-chart" />
      <h3>命令排行</h3>
      <span class="chart-subtitle">Top 10</span>
    </div>
    <div class="chart-container">
      <div v-if="loading" class="chart-loading">
        <k-icon name="loader" class="spin" />
      </div>
      <div v-else-if="!data || data.length === 0" class="chart-empty">
        暂无数据
      </div>
      <div v-else class="horizontal-bar-chart">
        <div
          v-for="(item, index) in data"
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
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  data: any[]
  loading?: boolean
}>()

const maxDistCount = computed(() => {
  if (!props.data || props.data.length === 0) return 1
  return Math.max(...props.data.map(i => i.count), 1)
})

const getBarHeight = (count: number, max: number) => {
  if (max === 0) return 0
  return Math.max((count / max) * 100, 2)
}
</script>

<style scoped>
/* GitHub Dimmed 风格命令排行卡片 */
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

.card-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.875rem;
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
  align-items: flex-start;
}

.chart-loading, .chart-empty {
  width: 100%;
  text-align: center;
  color: var(--fg3, var(--k-color-text-description));
  font-size: 0.8rem;
  padding: 1rem 0;
}

.horizontal-bar-chart {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* 列表项 - hover 效果 */
.h-bar-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  margin: 0 -6px;
  border-radius: 4px;
  transition: background 0.15s ease;
}

.h-bar-item:hover {
  background: var(--bg3, var(--k-hover-bg));
}

.h-bar-label {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 85px;
  flex-shrink: 0;
}

/* 排名徽章 */
.h-bar-rank {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  background: var(--bg3, var(--k-color-bg-2));
  color: var(--fg3, var(--k-color-text-description));
  font-size: 0.6rem;
  font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 前三名 */
.h-bar-item:nth-child(1) .h-bar-rank {
  background: #b5892c;
  color: #1e1e20;
}
.h-bar-item:nth-child(2) .h-bar-rank {
  background: #8b949e;
  color: #1e1e20;
}
.h-bar-item:nth-child(3) .h-bar-rank {
  background: #8b5a2b;
  color: #fff;
}

.h-bar-name {
  font-size: 0.75rem;
  font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  color: var(--fg2, var(--k-color-text));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 60px;
}

/* 进度条轨道 */
.h-bar-track {
  flex: 1;
  height: 6px;
  background: var(--bg3, var(--k-color-bg-2));
  border-radius: 1px;
  overflow: hidden;
}

/* 进度条填充 - 直角风格 */
.h-bar-fill {
  height: 100%;
  background: var(--k-color-primary, #7459ff);
  border-radius: 1px;
  transition: width 0.4s ease;
}

/* 数值 */
.h-bar-count {
  min-width: 32px;
  font-size: 0.7rem;
  font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  font-weight: 500;
  color: var(--fg3, var(--k-color-text-description));
  text-align: right;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>