<template>
  <div class="card notice-card" v-if="content">
    <div class="card-header">
      <k-icon name="bell" />
      <h3>最新公告</h3>
    </div>
    <div class="notice-content">
      <k-markdown :source="content" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  content: string
}>()
</script>

<style scoped>
.card {
  background: var(--k-card-bg);
  border-radius: 20px;
  padding: 1.5rem;
  border: 1px solid var(--k-color-border);
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  max-height: 360px;
  overflow-y: auto;
  box-sizing: border-box;
}

.card:hover {
  transform: translateY(-6px);
  box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.2);
  border-color: var(--k-color-primary-fade);
}

.notice-card {
  border-left: 4px solid var(--k-color-primary);
  border-radius: 20px 20px 20px 16px;
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

.notice-content {
  color: var(--k-color-text);
  line-height: 1.7;
}
</style>