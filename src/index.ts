import { Context, Logger } from 'koishi'
import type {} from '@koishijs/plugin-console'
import { resolve } from 'path'

import { GroupHelperService, registerWebSocketAPI } from './core'
import { WarnModule, KeywordModule, BasicModule, WelcomeModule, RepeatModule, DiceModule, BanmeModule, AntiRecallModule, AIModule, ConfigModule, LogModule, SubscriptionModule, HelpModule, ReportModule, GetAuthModule, AuthModule, EventModule } from './core/modules'

// 插件元信息
export const name = 'grouphelper'
export const usage = '群组管理助手'

// 声明依赖注入
export const inject = {
  required: ['database'],
  optional: ['console']
}

// 声明服务类型扩展（注意：这里不能使用，需要在 service 文件中声明）
// declare module 'koishi' { ... } 已在 grouphelper.service.ts 中定义

const logger = new Logger('grouphelper')

/**
 * 插件入口函数
 */
export function apply(ctx: Context) {
  // ===== 注册核心服务 =====
  ctx.plugin(GroupHelperService)
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
      // 获取配置
      const config = ctx.groupHelper.pluginConfig

      const warnModule = new WarnModule(ctx, ctx.groupHelper.data, config)
      const keywordModule = new KeywordModule(ctx, ctx.groupHelper.data, config)
      const basicModule = new BasicModule(ctx, ctx.groupHelper.data, config)
      const welcomeModule = new WelcomeModule(ctx, ctx.groupHelper.data, config)
      const repeatModule = new RepeatModule(ctx, ctx.groupHelper.data, config)
      const diceModule = new DiceModule(ctx, ctx.groupHelper.data, config)
      const banmeModule = new BanmeModule(ctx, ctx.groupHelper.data, config)
      const antiRecallModule = new AntiRecallModule(ctx, ctx.groupHelper.data, config)
      const aiModule = new AIModule(ctx, ctx.groupHelper.data, config)
      const configModule = new ConfigModule(ctx, ctx.groupHelper.data, config)
      const logModule = new LogModule(ctx, ctx.groupHelper.data, config)
      const subscriptionModule = new SubscriptionModule(ctx, ctx.groupHelper.data, config)
      const helpModule = new HelpModule(ctx, ctx.groupHelper.data, config)
      const reportModule = new ReportModule(ctx, ctx.groupHelper.data, config)
      const getAuthModule = new GetAuthModule(ctx, ctx.groupHelper.data, config)
      const authModule = new AuthModule(ctx, ctx.groupHelper.data, config)
      const eventModule = new EventModule(ctx, ctx.groupHelper.data, config)
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
      ctx.groupHelper.registerModule(authModule)
      ctx.groupHelper.registerModule(eventModule)

      // 初始化所有模块
      await ctx.groupHelper.initModules()
      logger.info('All modules initialized')
    })
  })

  logger.info('GroupHelper plugin loaded')
}
