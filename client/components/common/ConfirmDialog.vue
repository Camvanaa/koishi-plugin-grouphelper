<template>
  <transition name="gh-confirm-fade">
    <div v-if="state.show" class="gh-confirm-overlay" @click="$emit('cancel')">
      <div class="gh-confirm-card" @click.stop>
        <div class="gh-confirm-header">
          <h3 class="gh-confirm-title">{{ state.title }}</h3>
        </div>
        <div class="gh-confirm-body">
          <p class="gh-confirm-text">{{ state.message }}</p>
        </div>
        <div class="gh-confirm-footer">
          <button class="gh-confirm-btn" @click="$emit('cancel')">取消</button>
          <button
            class="gh-confirm-btn primary"
            :class="{ danger: state.type === 'danger' }"
            @click="$emit('accept')"
          >
            确认
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
/**
 * 统一的确认弹窗。与 useConfirm() 配合使用。
 *
 * 提取自 RolesView / SettingsView 中两份逐行相同的实现。
 */
defineProps<{
  state: {
    show: boolean
    title: string
    message: string
    type: 'normal' | 'danger'
  }
}>()

defineEmits<{
  (e: 'accept'): void
  (e: 'cancel'): void
}>()
</script>

<style scoped>
.gh-confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.gh-confirm-card {
  width: 100%;
  max-width: 400px;
  margin: 16px;
  background: var(--k-card-bg);
  border: 1px solid var(--k-color-border);
  border-radius: 8px;
  overflow: hidden;
}

.gh-confirm-header {
  padding: 16px 20px 0;
}

.gh-confirm-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--fg1);
}

.gh-confirm-body {
  padding: 12px 20px 20px;
}

.gh-confirm-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--fg2);
  white-space: pre-wrap;
}

.gh-confirm-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 0 20px 20px;
}

.gh-confirm-btn {
  padding: 6px 16px;
  font-size: 13px;
  border-radius: 6px;
  border: 1px solid var(--k-color-border);
  background: transparent;
  color: var(--fg1);
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.gh-confirm-btn:hover {
  background: var(--bg3);
}

.gh-confirm-btn.primary {
  background: var(--k-color-primary);
  border-color: var(--k-color-primary);
  color: #fff;
}

.gh-confirm-btn.primary:hover {
  opacity: 0.88;
  background: var(--k-color-primary);
}

.gh-confirm-btn.primary.danger {
  background: var(--k-color-danger);
  border-color: var(--k-color-danger);
}

.gh-confirm-fade-enter-active,
.gh-confirm-fade-leave-active {
  transition: opacity 0.15s ease;
}

.gh-confirm-fade-enter-from,
.gh-confirm-fade-leave-to {
  opacity: 0;
}
</style>
