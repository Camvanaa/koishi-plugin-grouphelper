# CSS 变量迁移计划

## 概述

将所有 View 组件的硬编码颜色值迁移到 Koishi 全局 CSS 变量，确保：
- 自动跟随用户的明/暗主题切换
- 与 Koishi 控制台保持一致的配色风格
- 便于维护和主题定制

## 已完成 ✓

- [x] **ConfigView.vue** - 已迁移
- [x] **BlacklistView.vue** - 已迁移

## 待迁移组件

### 1. WarnsView.vue (优先级: 高)

**问题**: 大量硬编码颜色值

| 硬编码值 | 应替换为 |
|---------|---------|
| `#313136` | `var(--bg3)` |
| `#252529` | `var(--k-card-bg)` |
| `#1e1e20` | `var(--bg1)` |
| `rgba(255, 255, 245, 0.9)` | `var(--fg1)` |
| `rgba(255, 255, 245, 0.6)` | `var(--fg2)` |
| `rgba(255, 255, 245, 0.4)` | `var(--fg3)` |
| `rgba(82, 82, 89, 0.4)` | `var(--k-color-divider)` |
| `rgba(82, 82, 89, 0.68)` | `var(--k-color-border)` |
| `#7459ff` | `var(--k-color-primary)` |
| `rgba(116, 89, 255, 0.15)` | `var(--k-color-primary-fade)` |
| `rgba(116, 89, 255, 0.3)` | `var(--k-color-primary-tint)` |
| `#3ba55e` | `var(--k-color-success)` |
| `rgba(59, 165, 94, 0.1)` | `var(--k-color-success-fade)` |

**特殊问题**:
- Header 区域使用独立样式，未使用 CSS 变量
- El-Switch 样式硬编码

---

### 2. LogsView.vue (优先级: 高)

**问题**: 混合使用 fallback 语法和硬编码值

| 硬编码值 | 应替换为 |
|---------|---------|
| `#3a3a3f` | `var(--bg3)` |
| `#9b87f5` | `var(--k-color-primary)` |
| `rgba(116, 89, 255, *)` | `var(--k-color-primary-fade/tint)` |
| `#2ea043` | `var(--k-color-success)` |
| `rgba(46, 160, 67, *)` | `var(--k-color-success-fade)` |
| `#da3633` | `var(--k-color-danger)` |
| `rgba(218, 54, 51, *)` | `var(--k-color-danger-fade)` |
| `rgba(82, 82, 89, 0.35)` | `var(--k-color-divider)` |

**特殊问题**:
- 自定义变量 `--border-subtle` 应移除
- 滚动条样式硬编码

---

### 3. ChatView.vue (优先级: 高)

**问题**: 大量硬编码值，包括特殊状态色

| 硬编码值 | 应替换为 |
|---------|---------|
| `#2ea043` | `var(--k-color-success)` |
| `#6e7681` | `var(--fg3)` |
| `#d29922` | `var(--k-color-warning)` |
| `#f85149` | `var(--k-color-danger)` |
| `#58a6ff` | `var(--k-color-info)` 或保留作为链接色 |

**特殊问题**:
- 定义了自定义 CSS 变量 `--status-online/offline/warning/danger`
- 建议统一使用 Koishi 的语义化颜色变量

---

### 4. RolesView.vue (优先级: 高)

**问题**: 最复杂的组件，大量硬编码值

| 硬编码值 | 应替换为 |
|---------|---------|
| `#999999` | `var(--fg3)` |
| `#3fb950` | `var(--k-color-success)` |
| `rgba(63, 185, 80, *)` | `var(--k-color-success-fade/tint)` |
| `#f85149` | `var(--k-color-danger)` |
| `rgba(248, 81, 73, *)` | `var(--k-color-danger-fade)` |
| `#58a6ff` | 保留或定义 `--k-color-info` |
| `rgba(88, 166, 255, *)` | info 色的 fade/tint 变体 |

**特殊问题**:
- 按钮样式复杂，有多种变体
- 权限树组件样式复杂

---

### 5. SubscriptionView.vue (优先级: 中)

**问题**: 少量硬编码值

| 硬编码值 | 应替换为 |
|---------|---------|
| `#58a6ff` | `var(--k-color-info)` |
| `rgba(88, 166, 255, *)` | info 色变体 |
| `#a371f7` | 紫色标签色，可保留或定义变量 |
| `#347d39` | `var(--k-color-success-shade)` |
| `rgba(255, 89, 90, 0.2)` | `var(--k-color-danger-fade)` |

---

### 6. SettingsView.vue (优先级: 低)

**问题**: 较少硬编码值，主要是阴影和透明遮罩

| 硬编码值 | 应替换为 |
|---------|---------|
| `rgba(116, 89, 255, 0.2)` | `var(--k-color-primary-tint)` |
| `rgba(0, 0, 0, 0.4)` | 保留（阴影色） |
| `rgba(0, 0, 0, 0.6)` | 保留（遮罩色） |

---

### 7. DashboardView.vue (优先级: 低)

**问题**: 使用了 fallback 语法，相对规范

| 需要清理 | 说明 |
|---------|------|
| `#3fb950` | 替换为 `var(--k-color-success)` |
| `rgba(63, 185, 80, *)` | 替换为 success 变体 |
| `#f85149` | 替换为 `var(--k-color-danger)` |
| `rgba(248, 81, 73, *)` | 替换为 danger 变体 |
| `rgba(116, 89, 255, *)` | 替换为 primary 变体 |

---

## 通用替换规则

### 背景色
| 原值 | 新变量 | 用途 |
|------|--------|------|
| `#000000` | `var(--bg0)` | 最深背景 |
| `#1e1e20` | `var(--bg1)` | 侧边栏/表头背景 |
| `#252529` | `var(--k-card-bg)` | 卡片/对话框背景 |
| `#313136` | `var(--bg3)` | 悬停/激活背景 |

### 文字色
| 原值 | 新变量 | 用途 |
|------|--------|------|
| `rgba(255, 255, 245, 0.9)` | `var(--fg1)` | 主要文字 |
| `rgba(255, 255, 245, 0.6)` | `var(--fg2)` | 次要文字 |
| `rgba(255, 255, 245, 0.4)` | `var(--fg3)` | 辅助文字/禁用 |

### 边框色
| 原值 | 新变量 | 用途 |
|------|--------|------|
| `rgba(82, 82, 89, 0.4)` | `var(--k-color-divider)` | 分割线 |
| `rgba(82, 82, 89, 0.68)` | `var(--k-color-border)` | 边框 |

### 主题色
| 原值 | 新变量 | 用途 |
|------|--------|------|
| `#7459ff` | `var(--k-color-primary)` | 主色 |
| `rgba(116, 89, 255, 0.1~0.15)` | `var(--k-color-primary-fade)` | 主色淡化 |
| `rgba(116, 89, 255, 0.25~0.3)` | `var(--k-color-primary-tint)` | 主色浅色 |

### 状态色
| 原值 | 新变量 | 用途 |
|------|--------|------|
| `#3ba55e` / `#3fb950` / `#2ea043` | `var(--k-color-success)` | 成功 |
| `#d29922` / `#f9af1b` | `var(--k-color-warning)` | 警告 |
| `#f85149` / `#da3633` | `var(--k-color-danger)` | 危险 |

### 字体
| 原值 | 新变量 |
|------|--------|
| 硬编码 sans-serif 字体栈 | `var(--font-family)` |
| 硬编码 monospace 字体栈 | `var(--font-family-code)` |

---

## 执行顺序建议

1. **WarnsView.vue** - 常用功能，优先处理
2. **LogsView.vue** - 常用功能
3. **ChatView.vue** - 复杂但重要
4. **RolesView.vue** - 最复杂，需要仔细处理
5. **SubscriptionView.vue** - 相对简单
6. **DashboardView.vue** - 已经使用 fallback，清理即可
7. **SettingsView.vue** - 问题最少

---

## 注意事项

1. **保留遮罩和阴影的 rgba 值** - `rgba(0, 0, 0, 0.x)` 用于遮罩和阴影，这些不需要跟随主题变化

2. **hover 状态的透明度变体** - 如 `rgba(116, 89, 255, 0.25)` 等 hover 状态，可以考虑：
   - 使用 CSS `color-mix()` 函数
   - 或保留硬编码值（因为 Koishi 的 fade/tint 变体透明度固定）

3. **特殊颜色** - 如 `#58a6ff` (蓝色链接) 和 `#a371f7` (紫色标签)，Koishi 没有对应变量，可以：
   - 自定义局部变量
   - 或保留硬编码

4. **测试** - 迁移后需要在明暗两种主题下测试效果
