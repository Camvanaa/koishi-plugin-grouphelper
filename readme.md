# koishi-plugin-grouphelper

[![npm](https://img.shields.io/npm/v/koishi-plugin-grouphelper?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-grouphelper)

> 🤖 强大的群管理插件，提供一系列实用的群管理功能

## 🌟 功能特点

### 👮‍♂️ 基础管理
- 踢出用户（可选加入黑名单）
- 禁言管理（包括全体禁言）
- 消息撤回
- 远程禁言（支持私聊）
- 管理员设置/取消

### ⚠️ 警告系统
- 分群记录警告
- 累计警告自动禁言
- 用户记录查询

### 🔑 关键词系统
- 关键词自动禁言（支持正则表达式）
- 入群审核关键词（忽略大小写）
- 群关键词管理（支持批量添加）

### 👋 入群管理
- 自定义欢迎语（支持变量）
- 入群审核
- 禁言后重进自动续费

### 🎯 其他功能
- 精华消息管理（设置/取消）
- 群头衔管理（设置/移除）
- 反复读管理（自动清理）
- 随机禁言自己（娱乐功能）

### 📢 订阅系统
- 操作日志订阅
- 成员变动通知
- 禁言到期通知
- 黑名单变更通知
- 警告通知

## 📝 命令列表

> 除特殊说明外，所有命令需要权限等级 3 或以上

### 🛠️ 基础命令
- `kick {@用户} [群号] [-b]` 踢出用户，-b 表示加入黑名单
- `ban {@用户} {时长} [群号]` 禁言用户，支持表达式
- `unban {@用户} [群号]` 解除用户禁言
- `ban-all` 开启全体禁言
- `unban-all` 解除全体禁言
- `unban-allppl` 解除所有人禁言
- `delmsg` (回复) 撤回指定消息
- `banme [次数]` 随机禁言自己，权限等级1即可使用
  · 普通抽卡：1秒~30分钟（每次使用递增上限）
  · 金卡概率：0.6%（73抽后概率提升，89抽保底）
  · UP奖励：24小时禁言
  · 歪奖励：12小时禁言（下次必中UP）
- `admin {@用户}` 设置管理员（权限等级4）
- `unadmin {@用户}` 取消管理员（权限等级4）

### ⚠️ 警告系统
- `warn {@用户} [次数]` 警告用户，默认1次
- `check {@用户}` 查询用户记录
- `autoban {@用户}` 根据警告次数自动禁言

### 🔑 关键词管理
- `groupkw` 群关键词管理：
  - `-l` 列出本群关键词
  - `-a <关键词>` 添加本群关键词，多个关键词用英文逗号分隔
  - `-r <关键词>` 移除本群关键词，多个关键词用英文逗号分隔
  - `-p` 管理入群审核关键词（需配合上述参数使用）

### 👋 欢迎设置
- `welcome` 入群欢迎语管理：
  - `-s <消息>` 设置欢迎语
  - `-r` 移除欢迎语
  - `-t` 测试当前欢迎语
支持变量：
  - `{at}` @新成员
  - `{user}` 新成员QQ号
  - `{group}` 群号

### ⭐ 精华消息
- `essence` 精华消息管理：
  - `-s` 设置精华消息（需回复消息）
  - `-r` 取消精华消息（需回复消息）

### 👑 群头衔
- `title` 群头衔管理：
  - `-s <文本>` 设置头衔
  - `-r` 移除头衔
  - `-u @用户` 为指定用户设置

### 📝 日志管理
- `listlog [数量]` 显示最近的操作记录，默认100条
- `clearlog` 清理日志文件（权限等级4）：
  - `-d <天数>` 保留最近几天的日志，默认7天
  - `-a` 清理所有日志

### 🔄 复读管理
- `antirepeat [阈值]` 复读管理：
  - 查看当前状态：不带参数
  - 设置阈值并启用：填写数字（至少3）
  - 关闭复读检测：0

### 📢 订阅系统
- `sub` 订阅管理：
  - `.log` 订阅操作日志
  - `.member` 订阅成员变动通知
  - `.mute` 订阅禁言到期通知
  - `.blacklist` 订阅黑名单变更通知
  - `.warning` 订阅警告通知
  - `.all` 订阅所有通知
  - `.none` 取消所有订阅
  - `.status` 查看订阅状态

### ⚙️ 配置管理
- `config` 配置管理：
  - `-t` 显示所有配置和记录，包括：
    - 入群欢迎语（默认和本群）
    - 入群审核关键词（全局和本群）
    - 禁言关键词（全局和本群）及其配置
    - 自动禁言配置（警告阈值和时长表达式）
    - 复读管理配置（全局和本群）
    - 精华消息配置（状态和权限）
    - 头衔管理配置（状态、权限和长度限制）
    - 当前警告记录
    - 当前黑名单
    - Banme 功能统计
    - 当前生效的禁言列表
  - `-b` 黑名单管理
  - `-w` 警告管理