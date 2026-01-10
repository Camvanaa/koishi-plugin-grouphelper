<template>
  <div class="card stat-card" :class="type">
    <div class="stat-icon">
      <k-icon :name="icon" />
    </div>
    <div class="stat-content">
      <div v-if="loading" class="skeleton skeleton-text"></div>
      <div v-else class="stat-value">{{ value }}</div>
      <div class="stat-label">{{ label }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  type: string
  icon: string
  value: number | string
  label: string
  loading?: boolean
}>()
</script>

<style scoped>
.card {
  background: var(--k-card-bg);
  border-radius: 20px;
  padding: 1.5rem;
  border: 1px solid var(--k-color-border);
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  position: relative;
  overflow: hidden;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-sizing: border-box;
}

.card:hover {
  transform: translateY(-6px);
  box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.2);
  border-color: var(--k-color-primary-fade);
}

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

.stat-card.blue { --stat-color: #409eff; --stat-color-fade: rgba(64, 158, 255, 0.1); }
.stat-card.orange { --stat-color: #e6a23c; --stat-color-fade: rgba(230, 162, 60, 0.1); }
.stat-card.red { --stat-color: #f56c6c; --stat-color-fade: rgba(245, 108, 108, 0.1); }
.stat-card.green { --stat-color: #67c23a; --stat-color-fade: rgba(103, 194, 58, 0.1); }

.skeleton {
  height: 44px;
  width: 80%;
  background: linear-gradient(90deg, var(--k-color-bg-2) 25%, var(--k-color-bg-1) 50%, var(--k-color-bg-2) 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
  border-radius: 6px;
}

@keyframes skeleton-loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>