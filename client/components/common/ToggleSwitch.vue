<template>
  <label class="gh-toggle">
    <input
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    />
    <span class="gh-toggle-track"></span>
  </label>
</template>

<script setup lang="ts">
/**
 * 开关控件。
 *
 * 提取自 ConfigView / RolesView / SettingsView 中三份近乎逐字相同的实现
 * （前两者用 .slider、后者用 .toggle-track，样式规则各写一遍）。
 */
withDefaults(
  defineProps<{
    modelValue?: boolean
    disabled?: boolean
  }>(),
  { modelValue: false, disabled: false }
)

defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()
</script>

<style scoped>
.gh-toggle {
  position: relative;
  display: inline-block;
  width: 36px;
  height: 20px;
  flex-shrink: 0;
}

.gh-toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.gh-toggle-track {
  position: absolute;
  inset: 0;
  cursor: pointer;
  background-color: var(--bg3);
  border: 1px solid var(--k-color-border);
  border-radius: 10px;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.gh-toggle-track::before {
  position: absolute;
  content: "";
  height: 14px;
  width: 14px;
  left: 2px;
  bottom: 2px;
  background-color: var(--fg2);
  border-radius: 50%;
  transition: transform 0.15s ease, background-color 0.15s ease;
}

.gh-toggle input:checked + .gh-toggle-track {
  background-color: var(--k-color-primary);
  border-color: var(--k-color-primary);
}

.gh-toggle input:checked + .gh-toggle-track::before {
  transform: translateX(16px);
  background-color: #fff;
}

.gh-toggle input:disabled + .gh-toggle-track {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 移动端略微收窄。这段原先写在 ConfigView 的媒体查询里，
   但父组件的 scoped 样式命中不了子组件内部，只能由组件自己负责 */
@media (max-width: 768px) {
  .gh-toggle {
    width: 32px;
    height: 18px;
  }

  .gh-toggle-track::before {
    height: 12px;
    width: 12px;
  }

  .gh-toggle input:checked + .gh-toggle-track::before {
    transform: translateX(14px);
  }
}
</style>
