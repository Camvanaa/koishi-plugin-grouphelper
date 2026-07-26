# v0.3.13 Issue 修复说明

> 基于 `f004e49` 对全部 11 个开放 GitHub issue 的逐一分析与修复。
> 服务端 `tsc` 与客户端 `koishi-console build` 均构建通过。

---

## 已修复的 Bug

### #27 / #31-3 — AI 关闭后 @ 机器人仍唤醒 / 刷屏"已禁用"

**根因**
- 全局设置 `openai.chatEnabled` 是"死配置"：WebUI 能保存，但服务端没有任何代码读取它，关闭对话后 @ 机器人仍走完整 AI 流程。
- @ 触发中间件在群级禁用时，把 `processMessage` 返回的"抱歉，当前群聊已禁用AI对话功能。"当作回复发送，并且不调用 `next()`——既刷屏，又吞掉消息导致 chatluna 等后续插件永远收不到 @ 消息。

**修复**（`src/core/modules/ai.module.ts`）
- @ 触发路径上四级开关（全局 AI / 全局对话 / 群级 AI / 群级对话）任一处于禁用时，一律**静默 `return next()`**，把消息让给其他插件。
- `processMessage` 补上全局 `chatEnabled` 检查；`translateText` 补上全局 `translateEnabled` 检查（此前同为死配置）。
- 判断语义使用 `=== false`（`undefined` 视为开启），旧配置无需迁移。
- 与 chatluna 共存：关闭本插件"对话"开关即可让 chatluna 正常接管 @ 消息；`translate` / `report` 命令不受影响。

---

### #32 / #28 — gstatus 报"Navigation timeout of 30000 ms exceeded"

**根因**（三点叠加）
1. 状态图 HTML 的 `<style>` 第一行 `@import` Google Fonts（`fonts.googleapis.com`），这是页面唯一的外部网络请求；大陆环境下该域名连接呈黑洞式挂起。
2. `page.setContent(html, { waitUntil: 'load' })` 的 `load` 事件会被 CSS `@import` 阻塞。
3. 代码从未设置超时，30000ms 是 puppeteer 默认 navigation timeout。

**修复**（`src/core/modules/status.module.ts` 等）
- 删除 Google Fonts 外链，改为本地字体栈（`Segoe UI / PingFang SC / Microsoft YaHei / Noto Sans CJK SC`），HTML 100% 内联、零网络请求——治本。
- `setContent` 改为 `waitUntil: 'domcontentloaded'` 并显式传入超时。
- 新增配置 `status.renderTimeout`（毫秒，默认 30000，0 = 不限制），WebUI 设置页新增「状态图」节可调。
- 顺带修复：Koishi 版本号此前硬编码 `'4.18.7'`，改为运行时读取 `koishi/package.json`。

---

### #20 — 踢出群和撤回消息不能同时生效

**根因**
- `handleAutoBan` 的 `autoKick` 分支只调用 `kickGuildMember`，全程没有 `deleteMessage`；只开 `-k` 不开 `-d` 时消息不撤回。
- 附带缺陷：中间件入口只判断 `autoBan`，`autoKick` 分支在 `handleAutoBan` 内部——**只开 `-k` 不开 `-b` 时踢出从来不会触发**。

**修复**（`src/core/modules/keyword.module.ts`）
- 踢出前先撤回触发消息（`autoDelete` 已开时不重复撤回；撤回失败不阻塞踢出）。
- 中间件入口改为 `autoBan || autoKick`。
- 仅开踢出且踢出失败时不再误走禁言兜底。

> ⚠️ **行为变更提示**：历史上执行过 `forbidden -k true` 但因旧 bug 从未生效的群，升级后关键词命中会真正撤回并踢人。请在发布说明中显著提示。

---

### #33 — 反撤回推送无来源、无法按群订阅、不显示撤回操作者

**根因**
- 推送文案只有"检测到撤回消息 + 用户 + 内容"，未包含来源群；`pushMessage` 仅按布尔开关广播给所有订阅者。
- OneBot `group_recall` 事件的 `operator_id`（适配器已映射为 `session.operatorId`）从未被记录。

**修复**
- `RecalledMessage` 新增 `operatorId` 字段并在撤回事件中记录。
- 推送文案改为：`[防撤回] 来源群: 群名(群号)`，操作者与发送者不同时追加"操作者: xxx（管理员/群主撤回）"。
- `Subscription` 新增 `sourceGuildIds`（空 = 接收全部来源，向后兼容）；`pushMessage` 增加可选 `sourceGuildId` 过滤参数。
- 新增 `sub.antirecall [群号...]` 命令（不带参数为开关切换，带群号为设置来源过滤；非法参数会提示而不是误切换）。
- WebUI 订阅编辑弹窗新增"防撤回来源群过滤"输入框。
- `antirecall` 查询命令显示"由管理员 X 撤回"。
- 补齐订阅命令层此前遗漏的 antiRecall：`sub.all`、`sub.status`、`getFeatureName`。
- bot 自己执行的撤回（举报自动撤回、踢出前撤回等处置动作）只记录不推送，避免二次扩散违规内容。

---

### #31-1 — 举报成功后只禁言不撤回

**根因**：举报流程拿到了被举报消息的 `quoteId`（已用于查重和 `getMessage`），但从未传入处罚流程，模块内没有任何 `deleteMessage` 调用。

**修复**（`src/core/modules/report.module.ts`）
- `handleViolation` 在执行处罚动作前先撤回被举报消息（先撤回再处罚，保证踢出前消息已撤；失败不阻塞处罚）。
- 新增配置 `report.autoRecall`（默认开启），支持 `report-config -rc <boolean>`（全局与群级）与 WebUI 开关。
- 同时修复取值链缺陷：`getGuildConfig` 此前"群配置文件优先、全局 guildConfigs 兜底"是整体替换——WebUI 保存过群配置后，`report-config` 命令写入的字段会被整体遮蔽。现改为**两来源字段级合并**（群配置文件字段优先）。

---

### #37 — 实时聊天面板看不到 Bot 自己发送的消息

**根因**
- 通过插件发送：适配器 `'send'` 事件的会话 `content` 为空字符串，服务端靠 `get_msg` 反查恢复内容，但无重试、失败静默吞掉（`catch {}`），最终广播空消息或整个 Promise 无声 reject。
- 手机 QQ 手动发送：这类消息只会以 OneBot `message_sent` 上报（转为 `message` 事件），而 **LLOneBot/NapCat 默认不开启"上报自身消息"**——事件根本没到达 Koishi。

**修复**（`src/core/api/index.ts`）
- message / send 双通道监听；`message` 事件识别 `userId === selfId`（协议端开启自身上报后的路径）。
- 按 `平台:频道:消息ID` 去重（send 与 message_sent 会重复到达）。去重键在**成功取得内容后**才登记；自身消息内容为空且反查失败时不广播也不登记，等待带完整内容的上报补全，避免空气泡挡位。
- `get_msg` 反查失败时延迟 500ms 重试一次；广播异常记入日志不再静默。

> ⚠️ **环境前提**：要看到手机 QQ 手动发送的消息，必须在 LLOneBot/NapCat 中开启 **"上报自身消息"（reportSelfMessage）**。这是协议端配置，插件无法绕过。

---

### #26 — "此插件未声明配置项"警告、Web 面板失效

**结论**
- 警告属实：插件确实未导出 `Config` schema（设计上配置走自带 Web 面板 + `data/settings.json`）。已在 `src/index.ts` 导出带说明文字的空 `Schema.object({})`，控制台不再告警，并明确指引用户到「群管助手」面板配置。
- "Web 面板失效"为旧版本 npm 包构建产物缺失问题；当前 `package.json` 的 `files` 已包含 `lib` / `dist` / `client`，0.3.12+ 不复现。

---

### #34 — 移动端体验与群邀请手动处理

**#34-1 打开插件页后无法切回 Koishi 控制台**
- 根因：全局样式 `.grouphelper-app .layout-header { display: none !important }` 无条件隐藏 Koishi 自带头部——移动端上它是返回控制台其他页面的唯一入口。
- 修复：仅桌面端隐藏（`@media not all and (max-width: 768px)`，与移动端断点严格互补，避免 768~769px 小数宽度双头部）。

**#34-2 页面下方内容无法显示/滚动**
- 根因：`.main-content` 固定 `100vh` 高度 + `overflow: hidden`，滚动豁免依赖移动端浏览器普遍不支持的 `:has()` 选择器；且 k-layout 祖先均为 `overflow: hidden`，`height: auto` 无法形成滚动容器。
- 修复：移动端内容区改为有界高度（`100dvh − 52px − var(--header-height)`，适配地址栏收缩并扣除恢复显示的 Koishi 头部）+ `overflow-y: auto` 自身滚动。

**#34-3 群邀请希望手动处理**
- 新增 `guildRequest.manual` 配置（WebUI「入群邀请」节新增"手动处理"开关）：开启后收到群邀请不自动同意/拒绝，仅推送通知给订阅者，由管理员在 QQ 客户端手动处理。黑名单用户仍自动拒绝。

---

## 分析结论（无需改代码）

### #23 — 举报功能 chatluna `conversationId` 报错

当前源码已无任何 chatluna 引用：`callModeration` 走内置 AI 模块（OpenAI 兼容 API），错误日志中的 `ReportModule.callModeration → chatluna` 调用链只存在于旧版发布产物。**该 bug 在现版本已不存在**，可回复用户升级后关闭。

### #36 — welcome/goodbye 偶发不触发

逐项验证了插件侧完整链路：事件名（`guild-member-added` / `guild-member-removed`，satori 有 `removed/deleted` 别名兜底）、监听注册时机、开关判断逻辑、`session.send` 路径——**均正确**。`welcome -t` 正常也佐证发送路径无问题。

最可能原因是 **LLOneBot 侧 `group_increase` / `group_decrease` notice 上报缺失**（该问题在 LLOneBot 有过多次相关反馈）。本次已加入：
- 事件入口 INFO 日志（`[welcome] 收到入群事件: guild=..., user=...`）
- 配置拦截分支 DEBUG 日志

用户复现时凭日志即可区分"事件未到达"（协议端问题，建议升级 LLOneBot 或换 NapCat 对照）与"配置拦截"。

---

## 未实现（功能建议，留待排期）

- **#31-2** 自定义群规与分级处罚（需要群级审核提示词/规则体系，属较大特性）
- **#31-4** 自定义举报回复文案、禁言提示语、bot 人设

---

## 配置兼容性说明

所有新增配置字段均为可选，`SettingsManager.deepMerge` 会自动为旧 `settings.json` 补默认值，**无需迁移**：

| 配置 | 默认值 | 说明 |
|---|---|---|
| `status.renderTimeout` | `30000` | 状态图渲染超时（毫秒，0 = 不限制） |
| `report.autoRecall` | `true` | 举报处罚成功后自动撤回被举报消息 |
| `guildRequest.manual` | `false` | 群邀请手动处理模式 |
| `Subscription.sourceGuildIds` | 未设置 | 防撤回来源群过滤（空 = 全部） |
| `RecalledMessage.operatorId` | — | 撤回操作者（新记录自动携带） |
