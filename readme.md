# koishi-plugin-grouphelper

[![npm](https://img.shields.io/npm/v/koishi-plugin-grouphelper?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-grouphelper)

群管理插件，提供一系列群管理功能。

## 功能

- 踢出用户（可选加入黑名单）
- 警告系统（累计警告自动禁言）
- 用户记录查询
- 禁言管理（包括全体禁言）
- 关键词自动禁言（支持正则表达式）
- 消息撤回
- 入群欢迎语设置（支持变量）
- 入群审核关键词设置（忽略大小写）
- 群关键词管理（支持批量添加）
- 禁言后重进自动续费禁言时长
- 随机禁言自己（娱乐功能）

## 命令列表

所有命令需要权限等级 3 或以上。

### 基础命令
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
- `remoteban {QQ号} {群号} {时长}` 远程禁言用户（支持私聊）

### 警告系统
- `warn {@用户} [次数]` 警告用户，默认1次
- `check {@用户}` 查询用户记录
- `autoban {@用户}` 根据警告次数自动禁言

### 关键词管理
- `groupkw` 群关键词管理：
  - `-l` 列出本群关键词
  - `-a <关键词>` 添加本群关键词，多个关键词用英文逗号分隔
  - `-r <关键词>` 移除本群关键词，多个关键词用英文逗号分隔
  - `-p` 管理入群审核关键词（需配合上述参数使用）

### 欢迎设置
- `welcome` 入群欢迎语管理：
  - `-s <消息>` 设置欢迎语
  - `-r` 移除欢迎语
  - `-t` 测试当前欢迎语
支持变量：
  - `{at}` @新成员
  - `{user}` 新成员QQ号
  - `{group}` 群号

### 配置管理
- `config` 配置管理：
  - `-t` 显示所有配置和记录
  - `-b` 黑名单管理
    - `-a {QQ号}` 添加黑名单
    - `-r {QQ号}` 移除黑名单
  - `-w` 警告管理
    - `-a {QQ号} [次数]` 增加警告
    - `-r {QQ号} [次数]` 减少警告

## 时间表达式

支持以下格式：
- 基本单位：s（秒）、min（分钟）、h（小时）
- 基本格式：数字+单位，如：1h、10min、30s
- 支持的运算：
  - 加减乘除：+, -, *, /
  - 幂运算：^
  - 开方：sqrt()
  - 科学计数：1e2
- 表达式示例：
  - `(sqrt(100)+1e1)^2s` = 400秒 = 6分40秒
  - `sqrt(100)min` = 10分钟
  - `(1+2)^3s` = 27秒
  - `1e2s` = 100秒
- 时间范围：1秒 ~ 29天23小时59分59秒

## 配置项

- `keywords`: 入群审核关键词列表
- `defaultWelcome`: 默认入群欢迎语
- `warnLimit`: 警告达到多少次触发自动禁言
- `banTimes`: 自动禁言时长设置
  - `first`: 第一次自动禁言时长
  - `second`: 第二次自动禁言时长
  - `third`: 第三次自动禁言时长
- `keywordBan`: 关键词禁言设置
  - `enabled`: 是否启用关键词自动禁言
  - `keywords`: 触发禁言的关键词列表
  - `duration`: 关键词触发的禁言时长
- `banme`: banme指令设置
  - `enabled`: 是否启用banme功能
  - `baseMin`: 基础最小禁言时长（秒）
  - `baseMax`: 基础最大禁言时长（分钟）
  - `growthRate`: 递增系数
  - `jackpot`: 金卡系统设置
    - `enabled`: 是否启用金卡系统
    - `baseProb`: 金卡基础概率
    - `softPity`: 软保底抽数
    - `hardPity`: 硬保底抽数
    - `upDuration`: UP奖励时长
    - `loseDuration`: 歪了奖励时长

## 注意事项

1. 关键词支持正则表达式
2. 每个群可以设置独立的禁言关键词和入群审核关键词
3. 入群审核关键词匹配忽略大小写
4. 支持批量添加/删除关键词，用英文逗号分隔
5. 警告记录持久化保存
6. 禁言记录会在用户退群后保存，重新入群会继续执行剩余时间
7. 需要机器人具有相应的群管理权限
8. 所有命令执行都会记录详细日志
9. ban/kick/unban 命令支持指定群号进行远程操作
10. banme 功能完全可配置，包括概率、时长和递增曲线


