import { Context, Logger } from 'koishi'
import type {} from '@koishijs/plugin-console'
import { resolve } from 'path'

import * as config from './config'
import { Config as PluginConfig } from './types'
import { GroupHelperService, registerWebSocketAPI } from './core'
import { WarnModule, KeywordModule, BasicModule, WelcomeModule, RepeatModule, DiceModule, BanmeModule, AntiRecallModule, AIModule, ConfigModule, LogModule, SubscriptionModule, HelpModule, ReportModule, GetAuthModule, EventModule } from './core/modules'

// 插件元信息
export const name = config.name
export const usage = config.usage
export const Config = config.ConfigSchema

// 声明依赖注入
export const inject = {
  required: ['database'],
  optional: ['console']
}

// 导出类型
export { Config as ConfigInterface } from './types'

// 声明服务类型扩展（注意：这里不能使用，需要在 service 文件中声明）
// declare module 'koishi' { ... } 已在 grouphelper.service.ts 中定义

const logger = new Logger(config.name)

/**
 * 插件入口函数
 */
export function apply(ctx: Context, pluginConfig: PluginConfig) {
  // ===== 注册核心服务 =====
  ctx.plugin(GroupHelperService, pluginConfig)
  logger.info('GroupHelperService registered')

  // ===== 注册控制台页面（使用官方推荐的 inject 模式） =====
  ctx.inject(['console'], (ctx) => {
    ctx.console.addEntry({
      dev: resolve(__dirname, '../client/index.ts'),
      prod: resolve(__dirname, '../dist')
    })
    logger.info('Console entry registered')
  })

  // ===== 注册模块和 API（确保 groupHelper 服务已注册后） =====
  ctx.inject(['groupHelper'], (ctx) => {
    // 注册 WebSocket API（如果控制台可用）
    ctx.inject(['console'], (ctx) => {
      registerWebSocketAPI(ctx, ctx.groupHelper)
      logger.info('WebSocket API registered')
    })

    // 在 ready 事件中初始化模块
    ctx.on('ready', async () => {
      // 注册并初始化新架构模块
      const warnModule = new WarnModule(ctx, ctx.groupHelper.data, pluginConfig)
      const keywordModule = new KeywordModule(ctx, ctx.groupHelper.data, pluginConfig)
      const basicModule = new BasicModule(ctx, ctx.groupHelper.data, pluginConfig)
      const welcomeModule = new WelcomeModule(ctx, ctx.groupHelper.data, pluginConfig)
      const repeatModule = new RepeatModule(ctx, ctx.groupHelper.data, pluginConfig)
      const diceModule = new DiceModule(ctx, ctx.groupHelper.data, pluginConfig)
      const banmeModule = new BanmeModule(ctx, ctx.groupHelper.data, pluginConfig)
      const antiRecallModule = new AntiRecallModule(ctx, ctx.groupHelper.data, pluginConfig)
      const aiModule = new AIModule(ctx, ctx.groupHelper.data, pluginConfig)
      const configModule = new ConfigModule(ctx, ctx.groupHelper.data, pluginConfig)
      const logModule = new LogModule(ctx, ctx.groupHelper.data, pluginConfig)
      const subscriptionModule = new SubscriptionModule(ctx, ctx.groupHelper.data, pluginConfig)
      const helpModule = new HelpModule(ctx, ctx.groupHelper.data, pluginConfig)
      const reportModule = new ReportModule(ctx, ctx.groupHelper.data, pluginConfig)
      const getAuthModule = new GetAuthModule(ctx, ctx.groupHelper.data, pluginConfig)
      const eventModule = new EventModule(ctx, ctx.groupHelper.data, pluginConfig)
      ctx.groupHelper.registerModule(warnModule)
      ctx.groupHelper.registerModule(keywordModule)
      ctx.groupHelper.registerModule(basicModule)
      ctx.groupHelper.registerModule(welcomeModule)
      ctx.groupHelper.registerModule(repeatModule)
      ctx.groupHelper.registerModule(diceModule)
      ctx.groupHelper.registerModule(banmeModule)
      ctx.groupHelper.registerModule(antiRecallModule)
      ctx.groupHelper.registerModule(aiModule)
      ctx.groupHelper.registerModule(configModule)
      ctx.groupHelper.registerModule(logModule)
      ctx.groupHelper.registerModule(subscriptionModule)
      ctx.groupHelper.registerModule(helpModule)
      ctx.groupHelper.registerModule(reportModule)
      ctx.groupHelper.registerModule(getAuthModule)
      ctx.groupHelper.registerModule(eventModule)

      // 初始化所有模块
      await ctx.groupHelper.initModules()
      logger.info('All modules initialized')
    })
  })

  logger.info('GroupHelper plugin loaded')
}
