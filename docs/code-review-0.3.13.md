# grouphelper v0.3.13 全项目代码审查报告

审查范围:`src/`(40 个文件,约 12000 行)+ `client/`(20 个文件,约 20000 行),覆盖插件入口、核心服务、数据层、22 个功能模块、WebSocket API 层、认证系统、以及全部前端视图组件。

---

## 本报告的代码基线

审查基线为本地 `dev` 分支 `790b8ac`(2026-07-26)。`origin/dev` 那条线已被舍弃,不作为参考。

## 修复状态

本报告的结论已在 `79e94de`…`b3d227b` 六次提交中落地,**P0 全部 10 条、P1 全部、P2 绝大多数均已修复**,`tsc --noEmit` 与 `yarn build` 均通过。下文行号是审查当时的位置,修复后已发生偏移,阅读时请以实际代码为准。

审查之外另行发现并一并修复的问题:

- `json.store.ts` 的 `markDirty()` 是无上限 debounce,持续写入下 flush 永不触发(叠加 CacheService 从不 dispose 会整体丢失缓存)
- `json.store.ts` 的 flush 失败后不重试也不告警,表现为"界面提示保存成功、重启后改动消失"
- `event.module.ts:50,177` 同样把关键词当正则编译,与 keyword 模块是同一个 ReDoS 面
- `event.module.ts` 的入群审核从不读取 `groupConfig.auto`,自动拒绝是死配置
- `client/types.ts` 与 `src/types/index.ts` 中两处已漂移的类型声明

仍未处理、留待后续的项:

- 大文件拆分(5.1)——`api/index.ts` 1561 行、三个 3000 行级 Vue 组件仍未拆
- 公共组件与 composable 提取(5.2)——确认弹窗、弹窗骨架、`formatTime` 等重复仍在
- `client/styles/*.css` 未接线的设计系统草案(已收敛全局选择器,未删除)
- ChatView 的虚拟滚动与 `renderMessage` 渲染期副作用
- Dashboard 直连 GitHub/npm 的请求下沉到后端代理

---

## 一、整体评价

架构分层清晰:`GroupHelperService` 作为服务中枢,`BaseModule` 统一模块生命周期,`JsonDataStore` 抽象数据持久化,前端按视图拆分。模块的定时器清理、缓存 TTL 等基础工程做得比较扎实。

但存在三类系统性问题:

1. **Web 控制台 API 完全没有接入鉴权**——这是最严重的问题,55 个端点全部对未认证连接开放。
2. **同一份数据存在多个互不知情的写入者**——`command_logs.json` 被两套不兼容格式并发写,`mutes` 到期检查被两个模块各实现一遍。
3. **代码体量失控**——单个 API 文件 1561 行、单个 Vue 组件 3121 行,重复实现遍布(`parseUserId` 三份、`recordMute` 三份、确认弹窗五份)。

---

## 二、P0 — 必须优先修复

### P0-1. 全部 55 个 WebSocket 端点无鉴权,认证被完全绕过

**位置**:`src/core/api/index.ts` 全文(55 处 `ctx.console.addListener`,无一传入 `{ authority }` 选项)

`@koishijs/plugin-auth` 的拦截器逻辑是:

```js
ctx.on("console/intercept", async (client, listener) => {
  if (!listener.authority) return false;   // 未设置 authority → 直接放行
  if (!client.auth) return true; ...
})
```

本插件所有 `addListener` 均为两参形式,`listener.authority` 恒为 undefined,拦截器对每个 grouphelper 端点都放行。若未安装 plugin-auth 则更是全开放。

**攻击场景**:任何能连到 console WebSocket 的一方(WebSocket 不受同源策略限制,局域网暴露即可)无需登录即可:

- `grouphelper/settings/get` 读取 OpenAI API Key
- `grouphelper/chat/send` 以机器人身份向任意群发消息
- `grouphelper/blacklist/*`、`grouphelper/config/*`、`grouphelper/warns/*` 任意篡改数据

**修复**:封装 `addGuardedListener(event, cb, authority)` 统一注册,管理类端点 `authority: 4`;或在插件内注册一个 `console/intercept` 钩子对 `grouphelper/*` 前缀强制校验 `client.auth`。`docs/design-auth.md` 描述的 `check()` 权限体系目前完全没有接入 API 层。

### P0-2. 角色管理端点无鉴权 → 可提权到聊天平台

**位置**:`src/core/api/index.ts:176`(`auth/role/update`)、`:221`(`auth/user/assign`);`src/core/services/auth.service.ts:422`(`saveRole` 对权限列表无校验)、`:521`(`assignRole` 只拦内置角色)

**攻击场景**:未认证攻击者调用 `auth/role/update` 创建 `{ permissions: ['*'], scope: { type: 'global' } }` 的自定义角色,再用 `auth/user/assign` 把自己的 QQ 号绑上去,之后在群内即拥有机器人全部命令权限。Web 层越权由此转化为聊天平台的持久提权。

### P0-3. `settings/get` 明文回传 OpenAI API Key

**位置**:`src/core/api/index.ts:904-907`(`return success(service.settings.settings)`),敏感字段定义于 `src/core/settings/settings.manager.ts:74`

整个 settings 对象原样序列化返回,无字段脱敏。叠加 P0-1 即可未认证窃取密钥,或配合 `settings/update` 替换 `apiUrl` 做中间人。

**修复**:返回前掩码 `apiKey`,写入走单独的"只设置不回显"通道。

### P0-4. ChatView 存储型 XSS

**位置**:`client/components/ChatView.vue:80`(`v-html="renderMessage(msg)"`),渲染逻辑 `:858-1026`

`renderMessage` 用字符串拼接构造 HTML,全程无转义:

- `:923` at 名称 `@${displayName}` —— 后端 `src/core/api/index.ts:1505` 把群成员昵称原样写进 `name` 属性
- `:956`、`:1017` 引用块 `${quotedContent}` / `${quotedUser}` —— 后端 `:1407` 只转义了 `"`,未处理 `<>`
- `:883`、`:890` 图片 `onclick="window.open('${src}',...)"` —— src 正则 `[^"]+` 允许单引号,可闭合注入

**攻击场景**:群成员把昵称改为 `<img src=x onerror=...>`(不含双引号即绕过),其消息被 @ 或正常显示时,管理员打开聊天页即触发脚本,可窃取控制台会话、调用后端全部已授权 API。

**修复**:改为结构化节点用模板渲染(`<span>{{ name }}</span>` + `:src` 绑定),或引入 `DOMPurify`;移除内联 `onclick`,改事件委托 + `data-src`。

### P0-5. `command_logs.json` 被两套不兼容格式并发写

**位置**:`src/core/modules/log.module.ts:64-80`(裸 `fs` 读写,**顶层数组**格式)、`src/core/data/data.service.ts:222-230`(JsonDataStore,`{ logs: [] }` 格式,延迟 1s 整体回写)、`src/core/modules/report.module.ts:916-941`

**失败场景**:

- 举报触发 store 写入时,若文件当前是数组,`set('logs', ...)` 只是给数组挂了具名属性,`JSON.stringify` 序列化数组时该属性被静默丢弃 → **举报日志全部丢失**
- 反向,若文件已被 store 写成 `{logs:[]}`,`log.module.ts:167` 的 `logs.push()` 抛 `TypeError` 被 catch 吞掉 → **此后所有命令日志记录失败**;`loadStats` 的 `logs.forEach` 同样崩溃导致 `onInit` 失败
- `src/core/modules/status.module.ts:94` 对对象取 `.length` 得 `undefined`,状态页显示 "Logs: undefined"(这是该问题的旁证)
- 即使格式碰巧一致,store 的内存快照与 LogModule 的磁盘写互不感知,任一方 flush 都会用旧快照覆盖对方的新记录

**修复**:统一唯一写入者(建议全部走 `DataManager.commandLogs`),LogModule 删除自建 fs 读写。

### P0-6. 欢迎模块共享静态默认对象,跨群配置串数据

**位置**:`src/core/modules/welcome.module.ts:16-25`(`static readonly defaultWelcomeConfig`)、`:97` 与 `:184`(`|| WelcomeModule.defaultWelcomeConfig`),随后 `:105/:118/:127/:137/:189/:198` 直接改写并 `setAll`

无配置的群直接引用**静态单例**,接着对其字段赋值;`setAll` 不做深拷贝(`json.store.ts:97-100`),静态对象被永久污染。

**失败场景**:群 A(无配置)执行 `welcome -s 你好` → 静态默认对象的 `welcomeMsg` 变成"你好"。之后群 B(无配置)查看 welcome 或执行 `welcome -l 5`,读到的"默认值"已带群 A 的欢迎语。多个无配置群在内存中还指向同一对象。

**修复**:取用默认值时深拷贝,或把 `defaultWelcomeConfig` 改为返回新对象的工厂函数。

### P0-7. keyword 模块把用户输入当正则,ReDoS 可挂死整个 bot

**位置**:`src/core/modules/keyword.module.ts:473-481`(`new RegExp(keyword, 'i')`),中间件入口 `:329-363`

**失败场景**:管理员执行 `forbidden -a (a+)+$`,之后任何成员发一条 `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!` → 灾难性回溯阻塞 Node 事件循环,机器人全平台无响应。语义上也会误伤:关键词 `.` 会导致全群每条消息被撤回/禁言。此外 autoDelete 与 autoBan 两个循环对每条消息把所有关键词各编译匹配一遍(`:346/:353/:358`),无缓存。

**修复**:默认字面量匹配(`includes`),正则需显式前缀(如 `re:`)且添加时校验限长;编译结果缓存。

### P0-8. banme 形似字符映射未转义正则,可让消息中间件整体断链

**位置**:`src/core/modules/banme.module.ts:113-115`(`new RegExp(char, 'g')`)、`:371-374`(`banme.alias` 把引用消息原文直接做 key)、`:345-353`

**失败场景**:有权限者引用一条内容为 `(` 的消息执行 `banme.alias xxx` → key 写入文件;此后 `normalizeCommand`(对**每条群消息**调用两次)执行 `new RegExp('(')` 抛 SyntaxError,中间件未捕获 → 该 bot 后续所有消息在此中间件断链,**命令全部失效**,直到手工删文件。

**修复**:写入前试编译校验;匹配改用 `split/join` 字符替换,不走正则。

### P0-9. 前端「恢复默认」实际恢复的是服务器当前值

**位置**:`client/components/SettingsView.vue:966`(`deepMerge({ ...defaultSettings }, data)`),配合 `:949-959`、`:769`、`:1013`

`{ ...defaultSettings }` 是浅拷贝,`forbidden`/`banme`/`openai`/`report` 等嵌套对象仍是同一引用;deepMerge 递归写入时**原地改写了模块级 defaultSettings**。表单编辑也会同步污染。

**失败场景**:加载设置后点「恢复默认」,所有嵌套分区恢复出来的是刚从服务器加载/正在编辑的值,功能完全失效且用户无感知。

**修复**:`deepMerge(JSON.parse(JSON.stringify(defaultSettings)), data)`,并对 defaultSettings 深冻结以便开发期暴露此类问题。

### P0-10. ConfigView 编辑群配置时浅拷贝直接篡改内存数据

**位置**:`client/components/ConfigView.vue:921`(`applyConfigDefaults({ ...configs.value[guildId] })`)、`:930-943`

两层都是浅拷贝,`applyConfigDefaults` 仅在嵌套对象缺失时才新建;原配置已有 `forbidden/banme/openai/antiRecall/report` 时是引用共享,表单 `v-model` 直接改到 `configs.value` 上。

**失败场景**:打开已有配置 → 切换若干开关 → 点「取消」不保存 → 列表卡片的功能徽章已反映未提交的修改,内存与持久化数据产生偏差。

对比:`openGroupGroupConfig`(`:958-959`)与 `createGroupGroup`(`:897-898`)都正确用了 `cloneConfig` 深拷贝,唯独 guild 编辑路径漏了。

---

## 三、P1 — 高优先级

### 权限与越权

| # | 位置 | 问题 |
| --- | --- | --- |
| P1-1 | `src/core/api/index.ts:1129/1147/1013/394/132` | 端点无 scope 校验。`AuthService` 建了完整的按群作用域体系(`auth.service.ts:144-208`),API 层**完全没调用**,`guildId` 由前端任意传入 |
| P1-2 | `src/core/modules/memberManage.module.ts:87-90` | `kick` 允许显式传任意群号,但权限检查基于当前会话群。在群 A 有 kick 权限即可踢群 B 的人 |
| P1-3 | `src/core/modules/crossGroupManage.module.ts:40-50/68-88` | `quit-group`/`send` 同源问题,可让 Bot 退出任意群、向任意群投送内容 |
| P1-4 | `src/core/modules/subscription.module.ts:130-139/208-212` | `sub.antirecall` 可指定任意来源群,把别群被撤回的消息内容拉到本群 |
| P1-5 | `src/utils/index.ts:347-402` | `executeCommand` 在**共享的** `session.user` 上临时提权到 5;并发交错时第二次捕获的 `originalAuthority` 已是 5,finally 恢复后用户在该会话内**保持权限 5** |

**根因建议**:在 `base.module.ts:190-198` 的命令网关统一接入 `getPermissionScopes`/`isScopeAllowed`,从根上修复 P1-2/3/4,而非逐命令打补丁。

### 功能静默失效

**P1-6. report 自动处罚的临时提权对 AuthService 无效,处罚失败却回复成功**
`src/core/modules/report.module.ts:680-681` 设置 `session.user = { authority: Infinity, permissions: ['*'] }`,但 `auth.service.ts:600-644` 的 `getUserPermissions` **从不读取** `session.user.permissions`。默认部署下 AI 判定禁言 → `ban` 的 before 钩子返回"你没有权限执行此操作喵",该字符串不含"失败",失败检测(`:843/:860/:902` 用 `result.includes('失败')`)判为成功 → 回复"已对用户执行:禁言1800秒",**实际什么都没发生**。

**P1-7. 禁言到期检查:单位错乘 1000 + 脏标记缺失**
`src/core/modules/subscription.module.ts:358` 计算 `mute.startTime + mute.duration * 1000`,但 duration 全部以**毫秒**存入(`warn.module.ts:229-233`、`keyword.module.ts:403`)。10 分钟禁言被算成约 7 天后到期。此外 `:365` 的 `mute.notified = true` 直接改 `getAll()` 返回的对象,dirty 未置位,`flush()` 在 `json.store.ts:163` 因 `!this.dirty` 直接 return,**notified 永不落盘**。

**P1-8. 禁言到期检查被实现了两遍**
`event.module.ts:266-306` 与 `subscription.module.ts:329-391` 各起一个 60 秒定时器扫描 mutes。event 会**删除**到期记录,subscription 只标记 notified 且从不删。两者竞态:可能重复通知,也可能(叠加 P1-7)永不触发。

**P1-9. 入群审核「自动拒绝」是死配置**
`event.module.ts:115-190` 的 `guild-member-request` 处理器只在关键词命中时批准,未命中时什么都不做,**全程未读取 `groupConfig.auto`**。管理员开启自动拒绝后,答错的申请被一直挂起。

**P1-10. `settings.json` 文件监视器首次部署后失效**
`settings.manager.ts:250` 的 `fs.watch` 在文件不存在时抛 ENOENT 被 catch,而文件只在首次 flush 时才创建 → 全新安装后「外部编辑热加载」静默失效直到重启。另 `json.store.ts:175` 用 `renameSync` 原子替换,Linux 的 inotify 绑 inode,首次内部保存后 watch 即指向旧 inode。

**P1-11. `SettingsManager.update` 深合并导致 Record 型配置无法删除键**
`settings.manager.ts:298-320`。WebUI 删除某群配置后提交完整 settings,`deepMerge` 会保留旧键 → **前端删除永远不生效**。

### 数据丢失风险

**P1-12. JSON 解析失败静默回退默认值,随后 flush 覆盖原文件**
`json.store.ts:71-77` 回退 → `:162-186` flush 覆盖 → 备份 `maxBackups=3`(`:31`)轮转 3 次后损坏前的数据永久丢失,全程只有 `console.error`。

**P1-13. 热重载竞态:warmCache 定时器未取消 + DataManager dispose 后 getter「复活」**
`grouphelper.service.ts:113-197` 的 `setTimeout(…, 2000)` 未保存句柄,`stop()` 不取消;`data.service.ts:303-317` 的 `dispose()` 把 `stores = {}` 后,懒加载 getter 会**重新创建** JsonDataStore(带新 saveTimer,无人清理)。两份内存快照各自整文件回写,后写者覆盖先写者。

**P1-14. CacheService 的 store 从不 flush/dispose**
`grouphelper.service.ts:289-304` 的 `stop()` 只处理 modules、`_data`、`_settingsManager`,遗漏 `_cache`。停止前 1 秒内写入的缓存丢失;挂起的 saveTimer 会在 dispose 之后触发写盘。

### 前端(P1)

**P1-15. 设置整对象提交,并发修改被静默覆盖**
`SettingsView.vue:979` 提交含全部叶子字段的完整树,服务端 deepMerge 等价于全量覆盖。A 只改了提示词,却把 B 刚改的 `warnLimit` 无提示回滚。

**P1-16. 订阅编辑/删除按数组索引寻址**
`SubscriptionView.vue:280/349`。编辑弹窗打开期间列表前面有订阅被删 → 索引前移 → 保存会覆盖**另一条**,删除会删掉**别人的**(删除确认框校验的是 `newSub.id`,提交的却是索引)。

**P1-17. ChatView 消息订阅无清理,且全局单监听槽被覆盖**
`ChatView.vue:635-639` 注册 `receive`,`onUnmounted` 在 `:317` 被 import 但**全文从未调用**。`@koishijs/client` 的 `receive` 是 `listeners[event] = listener`,单槽覆盖且无反注册 API。当前靠 `<keep-alive>` 侥幸可用,一旦改成条件渲染就会出现"新 handler 覆盖旧闭包、旧实例收不到消息"。

**P1-18. RolesView 滚动监听绑定到不存在的元素,且从不解绑**
`RolesView.vue:903-912`:挂载时 `currentRole` 为 null,`main v-if="currentRole"` 未渲染,100ms 后 `permissionsMainRef.value` 仍是 null → **监听永远不会绑定**,权限面板的滚动高亮实际不工作。全文无 `removeEventListener`/`onUnmounted`。

**P1-19. 切换会话/角色的竞态**
`ChatView.vue:463-475`(在 `watch(currentSessionId)` 中)与 `RolesView.vue:978-987`(在 `selectRole` 中)都是"清空 → await → 赋值",无请求序号。快速切换 A→B 时若 A 的响应晚到,列表内容与 UI 选中项不匹配,管理员可能对错误对象执行移除操作。

**P1-20. `call()` 在 WS 断开时抛 TypeError**
`client/api.ts:40-48`。`@koishijs/client` 的 `send` 在 socket 为空时**直接 return undefined**(不返回 Promise),`call` 随后取 `result.success` → `TypeError`,而非可读的"连接已断开"。同时两处 `@ts-ignore` + `event: keyof any` 让类型安全形同虚设。

### 性能

**P1-21. LogModule 每条命令全量同步读写日志文件,且无条数上限**
`log.module.ts:109-125`(全局中间件拦截所有命令)、`:166-168`。与 report 侧的 1000 条截断不同,这里**永不裁剪**。运行数月后文件几十 MB,每条命令都在事件循环上做全文件 `readFileSync + JSON.parse + stringify + writeFileSync`。

**P1-22. AI 请求无超时**
`ai.module.ts:196-201` 的 `ctx.http.post` 未传 timeout,被 `report.module.ts:428` await。上游挂起时 `ai`/`tsl`/`report` 无限等待,举报者无任何反馈。

**P1-23. cache.json 只增不减 + 每次整文件重写**
`cache.service.ts:47-64/190-193`。guilds/users/members(guild×user 组合)条目从不淘汰,7 天过期仅决定是否刷新而不删除。

**P1-24. 每次 flush 前全量备份 + 目录扫描,全部同步 IO**
`json.store.ts:167-175/191-229`:每次 flush(最快 1 次/秒/store)执行 `copyFileSync` 全文件复制 + `readdirSync` + 逐文件 `statSync`。

**P1-25. 控制台聊天广播:无客户端连接也做 bot API 富化**
`api/index.ts:1434-1512`。每条群消息都可能触发 `bot.getGuild` 与逐个 at 元素的 `getGuildMember`(且未复用 CacheService),即使 WebUI 无人打开。

---

## 四、P2 — 中等优先级

### 后端

- **`nickname` 命令三个参数全必选**(`orderManage.module.ts:425`),按文档示例调用直接报"缺少参数",清昵称分支永远不可达
- **antirecall 撤回通知原样转发消息元素**(`antirecall.module.ts:251-254`,已有 `sanitizeContentForDisplay` 却未调用):用户发 `<at id="all"/>` 后撤回,bot 会在订阅群里 **@全体**
- **unban-random/batch 循环中 bot 调用未捕获**(`orderManage.module.ts:346-350/405-409`):名单中某人已退群则整个 action 中断,已成功解禁的用户在 mutes.json 里仍是禁言状态
- **report 命令任何异常都惩罚举报者**(`report.module.ts:507-523`):网络故障、消息过旧取不到,举报者一样被冷却 60 分钟
- **命令失败双重记录且状态矛盾**(`log.module.ts:104-106` + `:109-125`):一条 ❌ 一条 ✅,成功率统计失真
- **AI 上下文每条消息同步写盘两次**(`ai.module.ts:170` → `:91-101` 全量 writeFileSync)
- **`processMessage` 未校验响应结构**(`ai.module.ts:288`),与同文件 `callModeration`(`:402-411`)的完整校验不一致
- **配置写入无 schema 校验**(`api/index.ts:132-136` 等):`params.config` 任意形状 JSON 直接落盘,`guildId` 无格式校验
- **深合并缺 `__proto__`/`constructor` 过滤**(`api/index.ts:30-49`、`settings.manager.ts:298-320`):当前实现下全局原型污染不易达成,但模式脆弱,一旦重构为 `Object.assign` 即可被利用
- **错误处理格式不一致**:`config/*`、`warns/*`、`blacklist/*`、`subscriptions/*`、`stats/*` 等端点**无 try/catch**,异常冒泡后返回 `{ error }` 而非约定的 `{ success:false, error }`,前端统一解析会误判
- **并发写配置的 TOCTOU**(`api/index.ts:679/690/334/63-77`):按数组下标删改,检查-使用间隙可能删错条目
- **每条群消息创建一个 5 分钟 setTimeout**(`antirecall.module.ts:145`、`api/index.ts:1525`):高流量群常态数万个挂起定时器,且 antirecall 的 `onDispose` 不清理它们
- **warn 次数参数缺校验**(`warn.module.ts:130-131`):负数会累减,`warnCount` 变负后阈值判断永假
- **dice 无效 count 绕过校验**(`dice.module.ts:97-111`):`NaN < 1` 为 false,最终输出"总和:0"
- **warn 用 `split(':')[1]` 解析用户 ID**(`warn.module.ts:173/283/319`):无平台前缀时得 undefined,以 `'undefined'` 为键写入记录
- **`banme` 数据文件用相对路径 `./data/similarChars.json`**(`banme.module.ts:18`),不在插件数据目录内,且每条消息同步读盘两次
- **时区 hack**(`grouphelper.service.ts:274-279`、`data.service.ts:277-282`):用 `setHours(+8)+toISOString` 生成"北京时间",在本就是 UTC+8 的服务器上快 8 小时;`clearlog` 按该时间反解会误删

### 前端(P2)

- **弹窗关闭后 300ms 延时重置与快速重开竞态**(`SubscriptionView.vue:308-327`):关 A 后 300ms 内开 B,残留定时器会清空表单并把 editMode 重置,用户填完点添加会新增重复订阅
- **破坏性操作确认强度三档并存**:输入 ID 确认(Subscription)/ 弹窗确认(Settings)/ **完全无确认**(`WarnsView.vue:122`、`BlacklistView.vue:47/133`)
- **搜索不重置页码**(`LogsView.vue:335-352`):翻到第 5 页后改筛选再搜索,仍带 `page:5`,结果为空显示"暂无日志记录"
- **保存按钮无并发锁**(`SettingsView.vue:738`:`saving` ref 已维护但模板未绑定 `:disabled`)
- **提交值未 trim**(`WarnsView.vue:269 vs 276`、`BlacklistView.vue:112 vs 118`、`SubscriptionView.vue:264 vs 280`):用 trim 校验却发送原始值,脏 key 落盘
- **非法来源群号被静默丢弃**(`SubscriptionView.vue:272-277`):全部非法时 `delete newSub.sourceGuildIds`,订阅从"只收 2 个群"静默变成**接收全部来源群**
- **剪贴板写入未处理 Promise**(`SubscriptionView.vue:361-364`、`ConfigView.vue:1159-1163`):非 HTTPS 环境抛未捕获错误却仍提示"已复制"
- **`onDrop` 拖拽排序整段无 try/catch**(`RolesView.vue:1450-1465`):后端失败时本地 priority 已改却不回滚也无提示
- **群组组 diff 无法清除已有覆盖项**(`ConfigView.vue:1069-1096`):`undefined` 被 `continue` 跳过,无法生成删除指令
- **ChatView 消息列表无上限、无虚拟滚动**(`:692` 只增不删),且 `renderMessage` 在渲染期**产生副作用**(`:405` 计数器自增、`:889` nextTick 调度),每次重渲染都让历史图片重新代理拉取
- **外部请求无超时且禁用缓存**(`DashboardView.vue:318-343`):从管理员浏览器直连 `raw.githubusercontent.com`/`registry.npmjs.org`/`api.github.com`,无 AbortController;国内环境 VersionCard 永远 `Fail`,GitHub commits 受 60 次/小时/IP 限流
- **`loadStats`/`loadCharts` 空 catch 吞错**(`DashboardView.vue:345-358`):用户无法区分"真没数据"与"请求失败"
- **`index.vue` 非 scoped 全局样式污染整个控制台**(`:345-426`):全局 `::-webkit-scrollbar`、`@keyframes fadeIn/spin`、`@media(prefers-reduced-motion) *`
- **`client/styles/*.css` 是死代码**:全仓库无 import,`.gh-*` 类 0 引用;但内含 `*,*::before{box-sizing}` 等全局选择器,一旦引入即污染全站
- **`sections` 无 icon 字段却传给 k-icon**(`SettingsView.vue:53`):PC 端侧边栏图标全部渲染失败
- **移动端 `data-label` 缺失**(`LogsView.vue:1152-1158`):卡片字段标签全为空;`.col-status` 绝对定位无定位父级

---

## 五、重构建议

### 5.1 代码体量与拆分

| 文件 | 行数 | 建议 |
| --- | --- | --- |
| `src/core/api/index.ts` | 1561 | 按域拆 10 个注册器(config/auth/warns/blacklist/subscriptions/stats/logs/settings/cache/chat)+ `api/utils.ts` 放统一的 `addGuardedListener` 包装器。这个拆分同时为 P0-1 的鉴权修复提供天然落点 |
| `client/components/RolesView.vue` | 3121 | 拆 `RoleSidebar`/`RoleDisplayTab`/`RolePermissionsTab`/`RoleMembersTab`/`ImportMembersDialog` + `useRoles`/`useRoleEditor`/`usePermissionTree` composable |
| `client/components/ConfigView.vue` | 3058 | 拆 `ConfigToolbar`/`ConfigListTable`/`ConfigCardGrid`/`ConfigEditDialog`(内部再按 tab 拆)+ `configDefaults.ts` 纯函数(便于给 `buildConfigDiff` 写单测) |
| `client/components/ChatView.vue` | 2408 | 拆 `ChatSessionList`/`ChatMessageList`/`ChatMessageItem`/`ChatInput`/`GuildMemberSidebar` + `useChatSocket`(修 P1-17)/`useMessageRenderer`(改纯函数,修 P0-4 与副作用) |
| `src/index.ts:61-104` | — | 22 个模块手工 `new` + `registerModule` 改为 `const MODULES = [WarnModule, ...]` 数组循环 |

### 5.2 重复代码

| 重复项 | 位置 | 建议 |
| --- | --- | --- |
| `parseUserId` ×3 | `utils/index.ts:36`、`auth.module.ts:25-36`、`getauth.module.ts:25-36`(后两者逐字相同) | 统一到 utils,并让其支持 `<at id="...">` |
| `recordMute` ×3 | `orderManage.module.ts:458`、`keyword.module.ts:486`、`warn.module.ts:258`(字段还不一致,keyword 多写 remainingTime) | 下沉到数据层统一 mute 服务 |
| 禁言到期扫描 ×2 | `event.module.ts` + `subscription.module.ts` | 合并为一处(见 P1-8) |
| 举报 Prompt 全文 ×2 | `report.module.ts:80-199` 与 `settings.manager.ts:103-196`,**内容已分叉**(settings 版缺 `reporterPenalty` 说明,用户点"重置默认"后举报者惩罚功能会静默退化) | 单一来源导出 |
| 布尔选项解析 ×4 | `keyword.module.ts:316/115`、`antirecall.module.ts:479`、`banme.module.ts:413/432` | 抽 `parseBool` |
| at 标签+参数解析 ×3 | `orderManage.module.ts:62-74/180-191`、`antirecall.module.ts:368-397`(细节还不一致) | 抽 `parseTargetArgs` |
| `formatTime` ×5 | Warns/Blacklist/Logs/Dashboard/Chat 各一份 | `client/utils/format.ts` |
| 确认弹窗 ×2(逐行相同) | `SettingsView.vue:875`、`RolesView.vue:859` | `useConfirm()` composable + `<ConfirmDialog>`,顺带解决"无确认删除" |
| 弹窗骨架 + CSS ×6 | Warns/Blacklist/Subscription ×2/Config/Chat | `<BaseModal>` 组件 |
| 多选群组面板 ×3 | `RolesView.vue:133-154/292-313`、`ConfigView.vue:317-355` | `<GuildGroupPicker>` |
| toggle-switch CSS ×2(逐字相同) | `ConfigView.vue:2330-2377`、`RolesView.vue:2143-2186` | `<ToggleSwitch>` |

### 5.3 类型治理

- **前后端类型双份维护且已分叉**:`client/types.ts:13-76` 的 `GroupConfig` 有 `guildName/guildAvatar`,`src/types/index.ts:237-279` 没有;`report.autoRecall` 仅后端有。`DashboardStats` 前端两处定义都缺 `version`,但后端返回且前端读取(`DashboardView.vue:144`)。`warns/list` 的返回类型在 types.ts / api.ts / augmentations.d.ts 三方不一致。**建议抽 `shared/types` 供两端共用**。
- **Events 接口重复声明**:`client/types.ts:232` 扩展 `@koishijs/client`,`src/augmentations.d.ts:25` 扩展 `@koishijs/plugin-console`,同名事件签名还不同(前者位置参数,后者对象)——前端那份等于失效的护栏,建议删除。
- **`as any` 共 74 处**,`api/index.ts` 独占 42 处。`src/index.ts:99` 的 `registerModule(reportModule as any)` 掩盖了 `ReportModule.logCommand`(`report.module.ts:916`)与 `BaseModule.logCommand`(`base.module.ts:217`)的签名冲突——同名不同义,极易误用。
- **`src/types/index.ts:6-78`** 把插件字段 `declare module 'koishi' { interface Config }` 合并进 Koishi 全局 App Config 类型,且已与本地 `export interface Config` 漂移(缺 dice/report/status),建议删除该全局声明。
- **`src/types/index.ts:3`** `import { deprecate } from 'util'` 未使用。

### 5.4 架构:加固 JsonDataStore(不迁移数据库)

**前提**:业务数据继续用 JSON 文件存储,这是项目的既定决定。`ctx.database` 仅用于读 Koishi 内置的 `user`/`binding` 表查 authority(`api/index.ts:280,290`、`getauth.module.ts:68`、`report.module.ts:307`、`log.module.ts:136`),`src/index.ts:20-22` 的 `required: ['database']` 声明是正确的,不要删。

由此 `JsonDataStore` 成为整个数据层的单点,没有事务与恢复兜底,以下加固项优先级相应提高:

- **`markDirty()` 是无上限 debounce**(`json.store.ts:147-157`):每次写入都 `clearTimeout` 重设 1000ms 定时器,写入频率高于 1 次/秒时 flush **永不触发**。`cache.json` 最易踩(`api/index.ts:1434-1512` 对每条群消息做 `getGuild`+`getGuildMember` 富化),叠加 P1-14(CacheService 从不 dispose)形成完整丢数据链。**改为 throttle**:记 `firstDirtyAt`,距首次脏超过阈值(如 5s)强制 flush。
- **flush 失败不重试**(`json.store.ts:183-185`):catch 里只 `console.error`,`dirty` 保持 true 但已触发的定时器不再响,要等下次写入或 dispose 才有机会重写。磁盘满/权限问题的表现是"界面提示保存成功、重启后改动消失"。应重排重试定时器并通过 logger.error 上报。
- **解析失败静默回退后覆盖原文件**(`json.store.ts:71-77`,即 P1-12)——**纯 JSON 方案下最危险的一条**。改为:把原文件重命名为 `.corrupt.<时间戳>` 永久保留,该 store 进入只读模式拒绝 flush,并用 logger.error 明确告警。
- **热重载双快照互相覆盖**(`data.service.ts:303-317`,即 P1-13):`dispose()` 清空 `stores` 后懒加载 getter 会重建 store,新旧实例各持一份快照各自整文件回写。加 `disposed` 标志让 getter 在 dispose 后抛错。
- **`getAll()` 返回内部可变引用**(`json.store.ts:82-84`):"改了不落盘"已真实发生过(P1-7 的 `mute.notified`)。签名改 `Readonly<T>` 并提供 `mutate(fn)` 统一 markDirty——这会在编译期暴露所有直接改 getAll 结果的地方。
- **备份策略**(`json.store.ts:167-169`,即 P1-24):每次 flush 都 `copyFileSync` 全文件 + `readdirSync` + 逐个 `statSync`。改为记 `lastBackupAt`,距上次超过 1 小时才备份,`cleanOldBackups` 只在真正备份后调用。另 `:195` 的备份文件名用 ISO 毫秒时间戳,同毫秒内两次备份会互相覆盖。

**P0-5 / P1-21 / P1-23 的 JSON 原生解法**:

- `command_logs.json` 双写入者 → 单一写入者。`log.module.ts:64-80` 删掉自建 fs,改走 `data.commandLogs` store,统一为 report 侧已在用的 `{ logs: [] }` 格式;启动时一次性迁移(检测裸数组则包成 `{logs:[...]}` 写回);`status.module.ts:94` 同步改为 `(this.data.commandLogs.get('logs') || []).length`。
- LogModule 全量同步读写 + 无上限 → 走 store 后自动获得延迟合并写,复用 report 侧已有的 1000 条截断。若需保留更长历史,再考虑命令日志单独改 NDJSON 追加写(追加 O(1),按文件大小轮转为 `command_logs.1.jsonl`),代价是 LogsView 分页 API 要跟着改。
- `cache.json` 只增不减 → 每条记录加 `lastAccess`,设条目上限按 LRU 淘汰;并按类型拆成 `cache/guilds.json`、`cache/users.json`、`cache/members.json` 三个 store,`members` 是 guild×user 组合增长最快,拆开后单次写放大显著下降。
- **`pushMessage` 串行推送阻塞命令响应**(`grouphelper.service.ts:244-284`,几乎所有 action 都 `await this.log(...)`)。任一订阅目标超时都会拖慢每条管理命令。建议 fire-and-forget 或 `Promise.allSettled`。
- **GitHub/npm 请求应下沉到后端代理**并加服务端缓存,解决限流、内网可达性与超时(见 P2 前端条目)。

### 5.5 部署侧提示

本插件把 Web 安全性完全托付给 `@koishijs/plugin-auth`,而后者的密码哈希是**无盐 SHA-256**(`plugin-auth/lib/index.js:45-47`)且无登录暴破限流。建议在 README 中提示启用 HTTPS、限制 console 监听地址。**但注意:即便强化 plugin-auth,P0-1 仍使 grouphelper 端点绕过其保护,必须在本插件内修复。**

---

## 六、正面确认(已验证无问题)

- **模块生命周期基本正确**:模块在 `ctx.inject(['groupHelper']) → ctx.on('ready')` 中注册,命令/监听绑在 inject fork 的 ctx 上,服务重启时旧 fork 随之销毁,不会累积重复注册。`repeat`/`subscription` 用 `ctx.on('dispose')`,`event`/`report` 用 `ctx.setInterval`,`ai`/`antirecall` 用 `onDispose` 清理定时器,均有效。
- **缓存有界**:AI 上下文 30 分钟过期、antirecall 消息 5 分钟 TTL、report 上下文按 `contextSize*2` 截断、`RepeatModule.repeatMap` 超阈值即删并有每小时清理。未发现无上限内存增长(除 P1-23 的 cache.json)。
- **无正则注入(日志侧)**:日志检索(`api/index.ts:867-890`)全部用 `String.includes` 字符串匹配,无用户可控 RegExp。
- **XSS 面收敛**:除 `ChatView.vue:80` 外,全部 20 个前端文件**无任何 v-html/innerHTML**。`NoticeCard` 走 `k-markdown`(底层 `marked-vue` 默认 `xss.filterXSS` 白名单),`UpdatesCard` 的 commit message 用 `{{ }}` 文本插值——**公告与更新日志渲染是安全的**。
- **无定时器泄漏(SettingsView/LogsView/WarnsView/SubscriptionView/BlacklistView)**:这 5 个文件没有 setInterval 轮询;`LogsView.vue:330-333` 的 document 级 mousemove/mouseup 监听在 onUnmounted 已正确移除。
- **图表组件实现健康**:纯 flex/DOM 柱状图而非 canvas/ECharts,**无需 resize 监听、无重复渲染问题**;空态处理完整,`Math.max(...,1)` 防了除零。仅需补 `Number(count) || 0` 归一化。
- **LogsView 是服务端分页**(pageSize 上限 100),无需虚拟滚动。
- **错误提示风格统一**:各视图一致使用 `message.error(e.message || 兜底文案)`。

---

## 七、建议的修复顺序

1. **P0-1 / P0-2 / P0-3**(API 鉴权 + 敏感字段脱敏)——单点根因,收益最大,改动集中在 `api/index.ts` 的注册包装器
2. **P0-4**(ChatView XSS)——可与 ChatView 拆分重构合并做
3. **JsonDataStore 加固**(5.4 全部):throttle 落盘、损坏文件保留+只读、dispose 后禁止 getter 复活、flush 失败重试、备份按间隔。因为坚持 JSON 方案、没有数据库兜底,这一层是所有业务数据的单点,应排在其余数据类问题之前
4. **P0-5 / P0-6 / P0-9 / P0-10**(数据污染与格式冲突)——都是小改动、高收益
5. **P0-7 / P0-8**(正则注入导致 bot 挂死/断链)
6. **P1-1~P1-5**(越权):在 `base.module.ts` 命令网关统一接入 scope 校验
7. **P1-6~P1-11**(静默失效的功能)
8. 前端 P1-15~P1-20,性能 P1-21~P1-25(其中 P1-21/P1-23/P1-24 的 JSON 原生解法见 5.4)
9. P2 与重构(建议随功能迭代分批做,优先 5.3 类型治理与 5.2 中已分叉的重复代码)
