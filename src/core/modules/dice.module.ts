import { Context, Session } from 'koishi'
import { BaseModule, ModuleMeta } from './base.module'
import { DataManager } from '../data'

/**
 * 骰子游戏模块
 * 支持掷骰子功能，支持 XdY 语法
 */
export class DiceModule extends BaseModule {
  readonly meta: ModuleMeta = {
    name: 'dice',
    description: '骰子游戏模块',
    version: '1.0.0'
  }

  protected async onInit(): Promise<void> {
    this.registerCommands()
    this.registerMiddleware()
    this.ctx.logger.info('[DiceModule] initialized')
  }

  /**
   * 注册骰子命令
   */
  private registerCommands(): void {
    // dice 功能开关
    this.registerCommand({
      name: 'dice-config',
      desc: '掷骰子功能开关',
      permNode: 'dice-config',
      permDesc: '配置掷骰子功能'
    })
      .option('e', '-e <enabled:string> 启用或禁用掷骰子功能')
      .option('l', '-l <length:number> 设置掷骰子结果长度限制')
      .action(async ({ session, options }) => {
        if (!session.guildId) return '此命令只能在群聊中使用。'

        const configs = this.data.groupConfig.getAll()
        configs[session.guildId] = configs[session.guildId] || {}
        const diceConfig = configs[session.guildId].dice || { enabled: true, lengthLimit: 1000 }
        configs[session.guildId].dice = diceConfig

        if (options.e !== undefined) {
          const enabled = options.e.toString().toLowerCase()
          if (['true', '1', 'yes', 'y', 'on'].includes(enabled)) {
            diceConfig.enabled = true
            this.data.groupConfig.setAll(configs)
            this.log(session, 'dice-enabled', session.guildId, '成功：已启用掷骰子功能')
            return '掷骰子功能已启用喵~'
          } else if (['false', '0', 'no', 'n', 'off'].includes(enabled)) {
            diceConfig.enabled = false
            this.data.groupConfig.setAll(configs)
            this.log(session, 'dice-enabled', session.guildId, '成功：已禁用掷骰子功能')
            return '掷骰子功能已禁用喵~'
          } else {
            this.log(session, 'dice-enabled', session.guildId, '失败：设置无效')
            return '掷骰子选项无效，请输入 true/false'
          }
        } else if (options.l !== undefined) {
          const length = Number(options.l)
          if (isNaN(length) || length < 1) return '长度限制必须是大于0的数字。'

          diceConfig.lengthLimit = length
          this.data.groupConfig.setAll(configs)
          this.log(session, 'dice-length', session.guildId, `成功：已设置掷骰子结果长度限制为 ${length}`)
          return `已设置掷骰子结果长度限制为 ${length} 喵~`
        }

        return '请输入要配置的选项，如 -e true 或 -l 1000。'
      })

    // 随机数生成器，格式 dice <面数> [个数]
    this.registerCommand({
      name: 'dice',
      desc: '掷骰子',
      args: '<sides:number> [count:number]',
      permNode: 'dice',
      permDesc: '使用掷骰子功能',
      skipAuth: true  // 掷骰子是普通功能，不需要权限
    })
      .example('dice 6')
      .example('dice 20 3')
      .action(async ({ session }, sides, count = 1) => {
        if (!session.guildId) return

        const groupConfig = this.getGroupConfig(session.guildId)
        const diceConfig = groupConfig?.dice || { enabled: true, lengthLimit: 1000 }

        if (!diceConfig.enabled) {
          return ''
        }

        if (!sides) {
          return '喵呜...请指定骰子面数喵~'
        }

        if (sides < 2 || count < 1) {
          return '喵呜...骰子面数至少为2，个数至少为1喵~'
        }

        const lengthLimit = diceConfig.lengthLimit || 1000
        if ((String(sides).length + 2) * count > lengthLimit) {
          return '喵呜...掷骰子结果过长，请选择较少的面数或个数喵~'
        }

        const results = this.rollDice(sides, count)
        if (count === 1) {
          return `掷骰子结果：${results[0]}`
        } else {
          const sum = results.reduce((a, b) => a + b, 0)
          return `掷骰子结果：${results.join(', ')}\n总和：${sum}`
        }
      })
  }

  /**
   * 注册 XdY 语法中间件
   */
  private registerMiddleware(): void {
    this.ctx.middleware(async (session, next) => {
      if (!session.guildId || !session.content) return next()

      const groupConfig = this.getGroupConfig(session.guildId)
      const diceConfig = groupConfig?.dice || { enabled: true, lengthLimit: 1000 }

      if (!diceConfig.enabled) {
        return next()
      }

      // 匹配 XdY 语法
      const diceRegex = /^(\d*)d(\d+)$/i
      const match = diceRegex.exec(session.content.trim())

      if (!match) return next()

      const count = parseInt(match[1]) || 1
      const sides = parseInt(match[2])

      if (sides < 2 || count < 1) {
        return next()
      }

      const lengthLimit = diceConfig.lengthLimit || 1000
      if ((String(sides).length + 2) * count > lengthLimit) {
        await session.send('喵呜...掷骰子结果过长，请选择较少的面数或个数喵~')
        return
      }

      const results = this.rollDice(sides, count)

      if (count === 1) {
        await session.send(`掷骰子结果 (${match[0]}): ${results[0]}`)
        return
      } else {
        const sum = results.reduce((a, b) => a + b, 0)
        await session.send(`掷骰子结果 (${match[0]}): ${results.join(', ')}\n总和：${sum}`)
        return
      }
    })
  }

  /**
   * 掷骰子
   * @param sides 面数
   * @param count 个数
   * @returns 结果数组
   */
  private rollDice(sides: number, count: number): number[] {
    const results: number[] = []
    for (let i = 0; i < count; i++) {
      results.push(Math.floor(Math.random() * sides) + 1)
    }
    return results
  }
}