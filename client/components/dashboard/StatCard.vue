<template>
  <div class="card stat-card" :class="type">
    <div class="stat-icon">
      <k-icon :name="resolvedIcon" />
    </div>
    <div class="stat-content">
      <div v-if="loading" class="skeleton skeleton-text"></div>
      <div v-else class="stat-value">{{ value }}</div>
      <div class="stat-label">{{ label }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  type: string
  icon: string
  value: number | string
  label: string
  loading?: boolean
}>()

// 自动添加 grouphelper 命名空间前缀
const resolvedIcon = computed(() => {
  if (!props.icon) return 'grouphelper:dashboard'
  if (props.icon.includes(':')) return props.icon
  return `grouphelper:${props.icon}`
})
</script>

<style scoped>
/* GitHub Dimmed 风格统计卡片 */
.card {
  background: var(--bg2, var(--k-card-bg));
  border-radius: 6px;
  padding: 1rem 1.25rem;
  border: 1px solid var(--k-color-divider, rgba(82, 82, 89, 0.5));
  transition: border-color 0.15s ease;
  position: relative;
  overflow: hidden;
  height: auto;
  min-height: 120px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-sizing: border-box;
}

.card:hover {
  border-color: var(--k-color-border, rgba(82, 82, 89, 0.8));
}

/* 底部指示条 - 直角风格 */
.stat-card::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--stat-color);
  opacity: 0.7;
}

/* 图标 - 更小更紧凑 */
.stat-icon {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  margin-bottom: 0.875rem;
  background: var(--stat-color-fade);
  color: var(--stat-color);
}

/* 数值 - 等宽字体，更克制的颜色 */
.stat-value {
  font-size: 2rem;
  font-weight: 600;
  font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace;
  color: var(--fg1, var(--k-color-text));
  line-height: 1;
  margin-bottom: 0.375rem;
  letter-spacing: -1px;
}

/* 标签 - 次要文字颜色 */
.stat-label {
  color: var(--fg3, var(--k-color-text-description));
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* 克制的颜色方案 - 暗色调 */
.stat-card.blue {
  --stat-color: #58a6ff;
  --stat-color-fade: rgba(88, 166, 255, 0.1);
}
.stat-card.orange {
  --stat-color: #d29922;
  --stat-color-fade: rgba(210, 153, 34, 0.1);
}
.stat-card.red {
  --stat-color: #f85149;
  --stat-color-fade: rgba(248, 81, 73, 0.1);
}
.stat-card.green {
  --stat-color: #3fb950;
  --stat-color-fade: rgba(63, 185, 80, 0.1);
}

/* 骨架屏 */
.skeleton {
  height: 32px;
  width: 60%;
  background: linear-gradient(90deg,
    var(--bg3, #313136) 25%,
    var(--bg2, #252529) 50%,
    var(--bg3, #313136) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-loading 1.2s infinite;
  border-radius: 4px;
}

@keyframes skeleton-loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>