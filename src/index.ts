import { Context } from 'koishi'


import * as config from './config'


import { DataService } from './services'
import { AIService } from './services/ai.service'
import { CommandLogService } from './services/command-log.service'
import { AntiRecallService } from './services/anti-recall.service'
import { registerEventListeners, setupScheduledTasks } from './services/event.service'


import {
  registerBasicCommands,
  registerWelcomeCommands,
  registerWarnCommands,
  registerHelpCommands,
  registerRepeatMiddleware,
  registerKeywordMiddleware,
  registerKeywordCommands,
  setupRepeatCleanupTask,
  registerConfigCommands,
  registerBanmeCommands,
  registerLogCommands,
  registerSubscriptionCommands,
  registerAICommands,
  registerReportCommands,
  registerCommandLogCommands,
  registerAntiRecallCommands,
  registerDiceCommands
} from './commands'


export const name = config.name
export const usage = config.usage
export const Config = config.ConfigSchema

export const inject = ['database']

export { Config as ConfigInterface } from './types'


export function apply(ctx: Context) {

  const dataService = new DataService(ctx)

  const commandLogService = new CommandLogService(ctx, dataService)

  const antiRecallService = new AntiRecallService(ctx, dataService)

  const aiService = new AIService(ctx, dataService.dataPath)


  registerBasicCommands(ctx, dataService)
  registerWelcomeCommands(ctx, dataService)
  registerWarnCommands(ctx, dataService)
  registerHelpCommands(ctx, dataService)
  registerKeywordMiddleware(ctx, dataService)
  registerKeywordCommands(ctx, dataService)
  registerRepeatMiddleware(ctx, dataService)
  registerConfigCommands(ctx, dataService)
  registerBanmeCommands(ctx, dataService)
  registerLogCommands(ctx, dataService)
  registerSubscriptionCommands(ctx, dataService)
  registerAICommands(ctx, dataService, aiService)
  registerReportCommands(ctx, dataService, aiService)
  registerCommandLogCommands(ctx, commandLogService)
  registerAntiRecallCommands(ctx, antiRecallService, dataService)
  registerDiceCommands(ctx, dataService)


  registerEventListeners(ctx, dataService)
  setupScheduledTasks(ctx, dataService)
  setupRepeatCleanupTask()


  ctx.on('dispose', () => {
    dataService.dispose()
    aiService.dispose()
    commandLogService.dispose()
    antiRecallService.dispose()
  })
}
