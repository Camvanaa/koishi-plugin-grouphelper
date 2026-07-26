import { Context, Logger, Schema } from 'koishi'
import type {} from '@koishijs/plugin-console'
import { resolve } from 'path'

import { GroupHelperService, registerWebSocketAPI } from './core'
import type { BaseModule } from './core/modules'
import {
  WarnModule, KeywordModule, MemberManageModule, MessageManageModule, OrderManageModule,
  AntirepeatModule, WelcomeModule, RepeatModule, DiceModule, BanmeModule, AntiRecallModule,
  AIModule, ConfigModule, LogModule, SubscriptionModule, HelpModule, ReportModule,
  GetAuthModule, AuthModule, EventModule, StatusModule, CrossGroupManageModule
} from './core/modules'

/**
 * 所有功能模块的构造器，按注册顺序排列。
 *
 * 顺序有意义：模块在 onInit 中注册命令与中间件，中间件的先后会影响消息处理，
 * 新增模块请追加到相应位置，不要随意重排。
 */
const MODULE_CLASSES: Array<new (ctx: Context, data: any, config: any) => BaseModule> = [
  WarnModule,
  KeywordModule,
  MemberManageModule,
  MessageManageModule,
  OrderManageModule,
  AntirepeatModule,
  WelcomeModule,
  RepeatModule,
  DiceModule,
  BanmeModule,
  AntiRecallModule,
  AIModule,
  ConfigModule,
  LogModule,
  SubscriptionModule,
  HelpModule,
  ReportModule,
  GetAuthModule,
  AuthModule,
  EventModule,
  StatusModule,
  CrossGroupManageModule
]

// 插件元信息
export const name = 'grouphelper'
export { usage } from './config'

// 声明配置 Schema：本插件的全部配置在自带的「群管助手」Web 面板中管理（数据存储于 data 目录 settings.json），
// 此处导出空 Schema 以消除控制台"此插件未声明配置项"的警告（issue #26）
export const Config = Schema.object({}).description(
  '本插件的所有配置均在左侧「群管助手」Web 面板中管理，无需在此配置。'
)

// 声明依赖注入
export const inject = {
  required: ['database'],
  optional: ['console', 'puppeteer']
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
      const config = ctx.groupHelper.pluginConfig

      for (const ModuleClass of MODULE_CLASSES) {
        ctx.groupHelper.registerModule(new ModuleClass(ctx, ctx.groupHelper.data, config))
      }

      // 初始化所有模块
      await ctx.groupHelper.initModules()
      logger.info('All modules initialized (%d)', MODULE_CLASSES.length)
    })
  })

  logger.info('GroupHelper plugin loaded')
}
