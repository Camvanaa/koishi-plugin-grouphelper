# GroupHelper 回复文案 i18n 实施计划

## 目标

为 GroupHelper 增加可配置回复文案能力，使默认的赛博猫娘语气可以切换为中性风格，也可以在 WebUI 中逐条覆盖回复模板。

## 数据模型

回复配置存储在 `data/grouphelper/settings.json` 的 `replies` 字段中：

```ts
replies: {
  locale: 'zh-CN',
  activePreset: string,
  customPresets: Record<string, {
    id: string
    label: string
    base: 'cyber-neko' | 'neutral'
    overrides: Record<string, string>
  }>
}
```

内置模板不直接写入 `settings.json`。用户编辑会写入自定义 preset，每个 preset 单独保存自己的 `overrides`。模板目录由后端 `src/core/i18n/replies.ts` 维护，并通过 `grouphelper/replies/catalog` 下发给 WebUI。

## WebUI

新增与“仪表盘”“设置”等同级的“回复文案”页面：

- 切换内置或自定义 preset。
- 新建 preset。
- 复制当前 preset。
- 重命名和删除自定义 preset。
- 按模块分组浏览模板。
- 搜索 key、名称、默认文案和自定义文案。
- 编辑单条 override，修改只作用于当前自定义 preset。
- 恢复单条默认或清空当前 preset 的全部自定义。
- 使用现有 `settingsApi.update()` 保存配置，保持和设置页一致的保存条交互。

## 后端接入

`BaseModule` 提供统一 `reply(key, variables)` 方法，运行时从 `ctx.groupHelper.pluginConfig.replies` 动态读取配置。WebUI 保存后，模块无需重启即可读取最新文案。

模板变量使用 `{name}` 形式，例如 `{userId}`、`{duration}`、`{reason}`。缺失变量保留原占位符，缺失 key 回退到默认赛博猫娘模板。

## 当前替换范围

第一阶段已覆盖：

- 公共权限提示和目标群权限提示。
- `banme` 高频成功、失败、禁用、金卡文案。
- `warn` 添加警告、自动禁言、清除警告相关文案。
- `report` 举报禁用、冷却、引用缺失、重复举报、AI 格式错误、系统错误和手动处理相关文案。

## 后续替换范围

继续按模块逐步替换硬编码回复：

- `ai.module.ts`
- `auth.module.ts`
- `config.module.ts`
- `keyword.module.ts`
- `memberManage.module.ts`
- `messageManage.module.ts`
- `welcome.module.ts`
- `antiRecall.module.ts`
- 订阅推送文案

每次扩展应同步更新 `REPLY_TEMPLATE_META`、两个 preset 模板和必要的变量说明。

## 验证

- `yarn build:server`
- `yarn build:client`
- WebUI 打开“回复文案”，切换 preset、编辑模板并保存。
- 命令侧验证 `banme`、`warn`、`report` 与权限失败提示是否立即使用新文案。
