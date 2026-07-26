<template>
  <div class="picker" v-if="groups.length">
    <template v-if="searchable">
      <input
        v-model="search"
        type="text"
        placeholder="搜索群组组..."
        class="picker-search"
      />
      <div class="picker-actions">
        <button class="picker-btn" @click="selectAll">全选</button>
        <button class="picker-btn" @click="clearAll">清空</button>
        <span class="picker-count">已选 {{ modelValue.length }}</span>
      </div>
    </template>

    <label v-for="group in filtered" :key="group.id" class="picker-item">
      <input
        type="checkbox"
        :value="group.id"
        :checked="modelValue.includes(group.id)"
        @change="toggle(group.id)"
      />
      <span>{{ group.name }} ({{ group.id }})</span>
    </label>

    <div v-if="filtered.length === 0" class="picker-empty">未找到匹配的群组组</div>
  </div>
  <div v-else class="picker-empty">{{ emptyText }}</div>
</template>

<script setup lang="ts">
/**
 * 群组组多选面板。
 *
 * 提取自 RolesView 中三处结构相同、只是绑定变量不同的实现
 * （角色生效范围、成员范围、编辑成员范围），其中第三处没有搜索与全选，
 * 由 searchable 控制。
 *
 * 注意 ConfigView 里那个"包含的群聊"面板是另一个部件：它选的是群而非群组组，
 * 还带已选 chips，结构不同，没有合并。
 */
import { computed, ref } from 'vue'
import type { GuildGroup } from '../../types'

const props = withDefaults(
  defineProps<{
    modelValue: string[]
    groups: GuildGroup[]
    searchable?: boolean
    emptyText?: string
  }>(),
  { searchable: true, emptyText: '暂无可用群组组，请先在群组配置中创建' }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string[]): void
}>()

const search = ref('')

const filtered = computed(() => {
  const kw = search.value.trim().toLowerCase()
  if (!kw) return props.groups
  return props.groups.filter(
    g => g.name.toLowerCase().includes(kw) || g.id.toLowerCase().includes(kw)
  )
})

const toggle = (id: string) => {
  const next = props.modelValue.includes(id)
    ? props.modelValue.filter(x => x !== id)
    : [...props.modelValue, id]
  emit('update:modelValue', next)
}

/** 全选只作用于当前搜索结果，与用户所见一致 */
const selectAll = () => {
  const merged = new Set(props.modelValue)
  for (const g of filtered.value) merged.add(g.id)
  emit('update:modelValue', [...merged])
}

const clearAll = () => emit('update:modelValue', [])
</script>

<style scoped>
.picker {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 6px;
}

.picker-search {
  width: 100%;
  padding: 6px 10px;
  font-size: 0.8rem;
  color: var(--fg1);
  background: var(--bg1);
  border: 1px solid var(--k-color-border);
  border-radius: 4px;
}

.picker-search:focus {
  outline: none;
  border-color: var(--k-color-primary);
}

.picker-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 2px 0;
}

.picker-btn {
  padding: 3px 10px;
  font-size: 0.75rem;
  color: var(--fg1);
  background: var(--bg3);
  border: 1px solid var(--k-color-border);
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.picker-btn:hover {
  background: var(--k-color-border);
}

.picker-count {
  font-size: 0.75rem;
  color: var(--fg3);
}

.picker-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  color: var(--fg2);
  cursor: pointer;
}

.picker-empty {
  font-size: 0.75rem;
  color: var(--fg3);
  padding: 4px 0;
}
</style>
