import { Context } from 'koishi'
import { DataService } from '../services'
import { readData, saveData } from '../utils'

export function registerDiceCommands(ctx: Context, dataService: DataService) {
    // dice 功能开关
    ctx.command('dice-config', '掷骰子功能开关', { authority: 3 })
    .option('e', '-e <enabled:string> 启用或禁用掷骰子功能')
    .option('l', '-l <length:number> 设置掷骰子结果长度限制')
        .action(async ({ session, options }) => {
        if (!session.guildId) return '此命令只能在群聊中使用。';

        const groupConfigs = readData(dataService.groupConfigPath)
        groupConfigs[session.guildId] = groupConfigs[session.guildId] || {}
        const diceConfig = groupConfigs[session.guildId].dice || { ...(ctx.config.dice || {}) }
        groupConfigs[session.guildId].dice = diceConfig

        if (options.e !== undefined)
        {
            const enabled = options.e.toString().toLowerCase()
            if (['true', '1', 'yes', 'y', 'on'].includes(enabled)) {
                diceConfig.enabled = true
                saveData(dataService.groupConfigPath, groupConfigs)
                dataService.logCommand(session, 'dice-enabled', session.guildId, '成功：已启用掷骰子功能')
                return '掷骰子功能已启用喵~'
            } else if (['false', '0', 'no', 'n', 'off'].includes(enabled)) {
                diceConfig.enabled = false
                saveData(dataService.groupConfigPath, groupConfigs)
                dataService.logCommand(session, 'dice-enabled', session.guildId, '成功：已禁用掷骰子功能')
                return '掷骰子功能已禁用喵~'
            } else {
                dataService.logCommand(session, 'dice-enabled', session.guildId, '失败：设置无效')
                return '掷骰子选项无效，请输入 true/false'
            }
        }
        else if (options.l !== undefined)
        {
            const length = Number(options.l)
            if (isNaN(length) || length < 1) return '长度限制必须是大于0的数字。'
            
            diceConfig.lengthLimit = length
            saveData(dataService.groupConfigPath, groupConfigs)
            dataService.logCommand(session, 'dice-length', session.guildId, `成功：已设置掷骰子结果长度限制为 ${length}`)
            return `已设置掷骰子结果长度限制为 ${length} 喵~`
        }

        return '请输入要配置的选项，如 -e true 或 -l 1000。'
    })

    // 随机数生成器，格式 dice <面数> [个数]
    ctx.command('dice <sides:number> [count:number]', '掷骰子', { authority: 1 })
        .example('dice 6')
        .example('dice 20 3')
        .action(async ({ session }, sides, count = 1) => {
        if (!session.guildId) return;

        const groupConfigs = readData(dataService.groupConfigPath)
        const groupConfig = groupConfigs[session.guildId] || {}
        const diceConfig = groupConfig.dice || { ...(ctx.config.dice || {}) }

        if (!diceConfig.enabled) {
            return ''
        }

        if (!sides) {
            return '喵呜...请指定骰子面数喵~'
        }

        if (sides < 2 || count < 1) {
            return '喵呜...骰子面数至少为2，个数至少为1喵~'
        }

        const lengthLimit = diceConfig.lengthLimit || 1000;
        if ((String(sides).length + 2) * count > lengthLimit) {
            return '喵呜...掷骰子结果过长，请选择较少的面数或个数喵~'
        }

        const results = []
        for (let i = 0; i < count; i++) {
            results.push(Math.floor(Math.random() * sides) + 1)
        }
        if(count === 1) {
            return `掷骰子结果：${results[0]}`
        }
        else {
            const sum = results.reduce((a, b) => a + b, 0)
            return `掷骰子结果：${results.join(', ')}\n总和：${sum}`
        }
    })

    //中间件
    ctx.middleware(async (session, next) => {
        if (!session.guildId || !session.content) return next();

        const groupConfigs = readData(dataService.groupConfigPath);
        const groupConfig = groupConfigs[session.guildId] || {};
        const diceConfig = groupConfig.dice || { ...(ctx.config.dice || {}) };

        if (!diceConfig.enabled) {
            return next();
        }

        const diceRegex = /^(\d*)d(\d+)$/i;
        const match = diceRegex.exec(session.content.trim());

        if (!match) return next();

        const count = parseInt(match[1]) || 1;
        const sides = parseInt(match[2]);

        if (sides < 2 || count < 1) {
            return next();
        }

        const lengthLimit = diceConfig.lengthLimit || 1000;
        if ((String(sides).length + 2) * count > lengthLimit) {
            await session.send('喵呜...掷骰子结果过长，请选择较少的面数或个数喵~');
            return;
        }

        const results = [];
        for (let i = 0; i < count; i++) {
            results.push(Math.floor(Math.random() * sides) + 1);
        }
        
        if (count === 1) {
            await session.send(`掷骰子结果 (${match[0]}): ${results[0]}`);
            return;
        } else {
            const sum = results.reduce((a, b) => a + b, 0);
            await session.send(`掷骰子结果 (${match[0]}): ${results.join(', ')}\n总和：${sum}`);
            return;
        }
    });
}