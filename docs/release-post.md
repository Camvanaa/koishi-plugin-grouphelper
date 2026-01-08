# 🎉 koishi-plugin-grouphelper - 功能全面的群管理插件（带 WebUI）

[![npm](https://img.shields.io/npm/v/koishi-plugin-grouphelper?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-grouphelper)

## 📌 插件简介

**grouphelper** 是一款功能全面的 Koishi 群管理插件，提供完整的 **WebUI 管理面板**，让群管理变得简单高效。

无论是基础的踢人禁言，还是高级的 AI 审核、防撤回记录、关键词过滤，grouphelper 都能帮你轻松搞定！

---

## ✨ 核心特性

### 🖥️ 完整的 WebUI 管理面板

![WebUI 预览](https://your-image-url/webui-preview.png)

- **仪表盘**: 群组统计、警告数量、黑名单数量一目了然
- **群组配置**: 可视化配置每个群的功能开关
- **警告管理**: 查看、编辑、清除用户警告记录
- **黑名单管理**: 管理全局黑名单用户
- **日志检索**: 强大的命令日志搜索和统计
- **实时聊天**: 在 WebUI 中实时收发群消息，支持粘贴图片发送
- **角色权限管理**: 自定义角色和权限节点分配

### 🔐 灵活的权限系统

- **内置角色**: Authority 1-4、群管理员角色自动识别
- **自定义角色**: 创建任意角色，分配细粒度权限
- **权限节点**: 每个功能都有独立权限节点，支持通配符
- **多角色并集**: 用户多角色权限自动合并

### 🛡️ 丰富的管理功能

| 模块 | 功能 |
|------|------|
| **基础管理** | 踢人、禁言、解禁、全体禁言、设置群昵称 |
| **警告系统** | 警告用户、查看警告记录、自动处罚 |
| **黑名单** | 全局黑名单、踢出时自动拉黑 |
| **防撤回** | 记录撤回消息、查询用户撤回记录 |
| **防复读** | 检测刷屏行为、自动禁言 |
| **关键词过滤** | 入群验证关键词、禁言关键词、自动撤回 |
| **欢迎语** | 自定义入群欢迎消息，支持变量 |
| **消息管理** | 精华消息、撤回消息、跨群发送 |
| **订阅通知** | 操作日志、成员变动、禁言到期等推送 |

### 🤖 AI 智能功能

- **AI 对话**: 与 AI 进行上下文对话
- **智能翻译**: 自动识别语言翻译
- **违规检测**: AI 辅助举报审核（需配置 OpenAI）
- **@机器人** 直接触发对话

### 🎲 趣味功能

- **掷骰子**: `dice 100 3` 投3个100面骰
- **随机禁言**: `banme` 抽卡式随机禁言自己
  - 金卡概率 0.6%，73抽软保底，89抽硬保底
  - UP奖励 24小时禁言，歪了12小时

---

## 📦 安装方式

```bash
# npm
npm install koishi-plugin-grouphelper

# yarn  
yarn add koishi-plugin-grouphelper
```

或在 Koishi 插件市场搜索 `grouphelper` 安装。

---

## 🚀 快速开始

1. 安装并启用插件
2. 访问 Koishi 控制台，左侧菜单找到「群管助手」
3. 在仪表盘查看统计数据
4. 点击「群组配置」为各群开启/关闭功能
5. 在「角色权限」中配置权限节点

---

## 📋 命令示例

```
# 踢人并拉黑
kick @用户 -b

# 禁言10分钟
ban @用户 10m

# 警告用户
warn @用户

# 设置入群欢迎语
welcome -s "欢迎 {at} 加入本群！"

# 查看防撤回记录
antirecall @用户 10

# AI对话
ai 你好，请介绍一下自己
```

---

## 🌟 WebUI 实时聊天功能

![实时聊天预览](https://your-image-url/chat-preview.png)

- 📱 在 WebUI 中实时接收群消息
- 💬 直接发送消息到群聊/私聊
- 🖼️ 支持粘贴图片发送
- 👥 群成员列表侧边栏
- ↩️ 回复、@、复制、撤回消息
- 📝 完整的消息渲染（图片、表情、引用等）

---

## 📌 依赖说明

- **必需**: `database` 服务（用于存储配置）
- **推荐**: `console` 服务（用于 WebUI）
- 兼容 OneBot、Red、QQ 等主流适配器

---

## 🤝 贡献者

[![Contributors](https://contrib.rocks/image?repo=camvanaa/koishi-plugin-grouphelper)](https://github.com/camvanaa/koishi-plugin-grouphelper/graphs/contributors)

---

## 📝 反馈与建议

- **GitHub Issues**: [提交问题](https://github.com/camvanaa/koishi-plugin-grouphelper/issues)
- **Pull Request**: 欢迎贡献代码

---

**⭐ 如果觉得好用，请给个 Star 支持一下！**

---

*版本 0.3.3 | MIT License*