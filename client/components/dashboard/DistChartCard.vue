<template>
  <div class="card chart-card distribution-card">
    <div class="card-header">
      <k-icon name="grouphelper:bar-chart-2" />
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

.h-bar-item:nth-child(1) .h-bar-rank { background: #ffd700; color: #000; }
.h-bar-item:nth-child(2) .h-bar-rank { background: #c0c0c0; color: #000; }
.h-bar-item:nth-child(3) .h-bar-rank { background: #cd7f32; color: #fff; }

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

.spin {
  animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>