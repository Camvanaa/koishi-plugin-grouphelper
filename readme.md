# koishi-plugin-grouphelper

[![npm](https://img.shields.io/npm/v/koishi-plugin-grouphelper?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-grouphelper)

> 全方位的群组管理解决方案，为 Koishi 机器人提供强大的群管理能力。

## 特性亮点

- **完善的成员管理** - 踢人、禁言、设置管理员、批量操作等
- **灵活的警告系统** - 累计警告达到阈值自动禁言，支持自定义表达式
- **自定义角色权限** - 基于角色的权限控制，细粒度的命令权限管理
- **智能关键词系统** - 入群验证、违禁词检测，支持自动处理
- **防撤回/防复读** - 记录撤回消息，检测并处理复读行为
- **AI 智能审核** - 举报系统集成 AI，自动判断违规等级并处理
- **丰富的娱乐功能** - 掷骰子、自助禁言抽卡（带保底机制）
- **可视化控制台** - Web 面板管理权限、查看日志、配置功能

---

## 快速开始

### 安装

```bash
npm install koishi-plugin-grouphelper
```

或在 Koishi 控制台插件市场搜索 `grouphelper` 安装。

### 依赖

| 类型 | 服务         | 说明                           |
| ---- | ------------ | ------------------------------ |
| 必需 | `database`   | 数据库服务，用于存储配置和数据 |
| 可选 | `console`    | 控制台面板，提供 Web 管理界面  |
| 可选 | `puppeteer`  | 浏览器服务，用于生成状态图片   |

### 基础配置

在 Koishi 控制台中启用插件后，主要配置项包括：

- **warnLimit** - 警告次数阈值，达到后触发自动禁言
- **banTimes.expression** - 禁言时长表达式，支持数学运算
- **forbidden** - 违禁词设置（自动撤回、禁言、踢出等）
- **openai** - AI 功能配置（API Key、模型、提示词等）
- **report** - 举报功能配置（启用、自动处理、上下文等）
- **banme** - 自助禁言抽卡配置（概率、保底机制等）
- **antiRecall** - 防撤回配置（保留天数、记录数量）
- **antiRepeat** - 防复读配置（阈值设置）

---

## 权限系统

### 权限来源

用户权限由以下三部分组成：

1. **Koishi Authority 等级** - 基于 `user.authority` 自动映射到对应的内置角色
2. **群管理员身份** - 群主/管理员自动获得 `guild-admin` 角色权限（仅当前群生效）
3. **自定义角色** - 通过控制台或命令手动分配的角色

### 内置角色

内置角色由系统自动分配，不支持手动添加或移除成员：

| 角色 ID        | 名称         | 自动分配条件                   |
| -------------- | ------------ | ------------------------------ |
| `authority1`   | Authority 1  | user.authority ≥ 1             |
| `authority2`   | Authority 2  | user.authority ≥ 2             |
| `authority3`   | Authority 3  | user.authority ≥ 3             |
| `authority4+`  | Authority ≥4 | user.authority ≥ 4             |
| `guild-admin`  | 群管理员     | 群主或管理员身份（仅群内生效） |

> 在 Web 控制台中为内置角色配置权限节点，即可控制不同等级用户的命令访问权限。

### 自定义角色

可通过控制台创建自定义角色，并通过命令分配给用户：

```bash
gauth.list                   # 列出所有可用角色
gauth.add @用户 moderator    # 给用户添加角色
gauth.remove @用户 moderator # 移除用户的角色
gauth.info @用户             # 查看用户的所有角色
```

### 权限检查逻辑

1. 精确匹配权限节点（如 `warn.add`）
2. 超级通配符 `*`（拥有所有权限）
3. 模块通配符（如 `warn.*` 匹配 `warn.add`、`warn.clear` 等）

---

## 时间表达式

禁言时长支持灵活的时间表达式：

| 格式     | 示例                       | 说明               |
| -------- | -------------------------- | ------------------ |
| 基本单位 | `30s`, `10m`, `1h`, `1d`   | 秒、分钟、小时、天 |
| 组合格式 | `1h30m`, `2d12h`           | 多单位组合         |
| 数学运算 | `(10+5)*2m`                | 支持 +, -, *, /, ^ |
| 函数     | `sqrt(100)s`               | 支持 sqrt()        |
| 科学计数 | `1e2s`                     | 100 秒             |

**示例**：`(sqrt(100)+1e1)^2s` = 400秒 = 6分40秒

---

## 模块架构

插件采用模块化设计，各功能独立：

| 模块           | 功能                             |
| -------------- | -------------------------------- |
| `MemberManage` | 成员管理（踢人、设管理、头衔等） |
| `OrderManage`  | 禁言管理（禁言、解禁、全体禁言） |
| `Warn`         | 警告系统                         |
| `Auth`         | 角色权限管理                     |
| `Keyword`      | 关键词管理（验证词、违禁词）     |
| `Welcome`      | 欢迎/欢送语                      |
| `Antirecall`   | 防撤回                           |
| `Antirepeat`   | 防复读                           |
| `Report`       | 举报系统（AI 审核）              |
| `AI`           | AI 对话和翻译                    |
| `Log`          | 日志记录和查询                   |
| `Subscription` | 通知订阅                         |
| `Dice`         | 掷骰子                           |
| `Banme`        | 自助禁言抽卡                     |
| `Status`       | 系统状态                         |

---

## 控制台面板

启用 `console` 服务后，可通过 Web 面板进行管理：

- **权限管理** - 可视化配置角色和权限节点
- **日志查看** - 查看操作日志和命令执行记录
- **数据统计** - 命令使用统计、用户活跃度等
- **功能配置** - 各模块的开关和参数设置

---

## 命令列表

完整的命令列表请在 Koishi 控制台的插件配置页面查看，或使用命令：

```bash
grouphelper -a    # 显示所有可用命令
grouphelper -v    # 显示版本信息
```

---

## 开发

### 项目结构

```bash
src/
├── index.ts              # 插件入口
├── config.ts             # 配置和文档
├── types/                # 类型定义
├── utils/                # 工具函数
└── core/
    ├── services/         # 核心服务
    │   ├── auth.service.ts    # 权限服务
    │   └── grouphelper.service.ts
    ├── data/             # 数据管理
    └── modules/          # 功能模块
        ├── base.module.ts     # 模块基类
        ├── warn.module.ts
        ├── auth.module.ts
        └── ...
```

### 添加新模块

1. 创建模块文件继承 `BaseModule`
2. 实现 `onInit()` 方法注册命令
3. 在 `modules/index.ts` 导出
4. 在 `src/index.ts` 注册模块

---

## 贡献

欢迎提交 Issue 和 Pull Request！

- [GitHub Issues](https://github.com/camvanaa/koishi-plugin-grouphelper/issues) - 问题反馈和功能建议
- [Pull Requests](https://github.com/camvanaa/koishi-plugin-grouphelper/pulls) - 代码贡献

[![Contributors](https://contrib.rocks/image?repo=camvanaa/koishi-plugin-grouphelper)](https://github.com/camvanaa/koishi-plugin-grouphelper/graphs/contributors)

---

## 许可证

MIT License
