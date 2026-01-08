/**
 * HelpModule - 帮助模块
 * 提供帮助信息显示和时间解析测试功能
 */

import { Context, segment } from 'koishi'
import { BaseModule, ModuleMeta } from './base.module'
import { DataManager } from '../data'
import { Config } from '../../types'
import { parseTimeString, formatDuration } from '../../utils'
import { usage } from '../../config'

export class HelpModule extends BaseModule {
  readonly meta: ModuleMeta = {
    name: 'help',
    description: '帮助模块 - 提供帮助信息和工具命令'
  }

  constructor(ctx: Context, data: DataManager, config: Config) {
    super(ctx, data, config)
  }

  protected async onInit(): Promise<void> {
    this.registerCommands()
  }

  private registerCommands(): void {
    // 主帮助命令
    this.registerCommand({
      name: 'grouphelper',
      desc: '群管理帮助',
      permNode: 'grouphelper',
      permDesc: '查看帮助信息',
      skipAuth: true  // 帮助是公开的
    })
      .option('a', '-a 显示所有可用命令')
      .option('i', '-i 以图片形式显示帮助文档')
      .action(async ({ session, options }) => {
        if (options.i) {
          if (!this.ctx.puppeteer) {
            return '错误：未安装 puppeteer 插件，无法生成帮助图片。'
          }
          try {
            const html = this.renderHelpHtml(usage)
            const page = await this.ctx.puppeteer.page()
            try {
              await page.setContent(html, { waitUntil: 'load' })
              const element = await page.$('.container')
              const image = await element?.screenshot({ encoding: 'binary', omitBackground: true })
              if (image) return segment.image(image, 'image/png')
              return '生成图片失败'
            } finally {
              await page.close()
            }
          } catch (e) {
            return `生成帮助图片失败：${e.message}`
          }
        }
        if (options.a) {
          return this.getFullHelpText()
        }
        return '强大的群管理插件，提供一系列实用的群管理功能\n使用参数 -a 查看所有可用命令\n使用参数 -i 查看帮助文档图片'
      })

    // 时间解析测试命令
    this.registerCommand({
      name: 'parse-time',
      desc: '测试时间解析',
      args: '<expression:text>',
      permNode: 'parse-time',
      permDesc: '测试时间解析',
      skipAuth: true  // 工具命令，公开
    })
      .example('parse-time 10m')
      .example('parse-time 1h30m')
      .example('parse-time 2days')
      .example('parse-time (1+2)^2hours')
      .action(async ({ session }, expression) => {
        if (!expression) {
          return '请提供时间表达式进行测试'
        }

        try {
          const milliseconds = parseTimeString(expression)
          return `表达式 "${expression}" 解析结果：${formatDuration(milliseconds)} (${milliseconds}毫秒)`
        } catch (e) {
          return `解析错误：${e.message}`
        }
      })
  }

  private renderHelpHtml(markdown: string): string {
    // 简单的 Markdown 解析
    let htmlContent = markdown
      // 标题
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      // 分隔线
      .replace(/^---$/gm, '<hr>')
      // 表格处理 (简单处理)
      .replace(/\|(.+)\|/g, (match) => {
        const cells = match.split('|').filter(c => c.trim())
        if (cells.some(c => c.includes('---'))) return '' // 忽略分隔行
        return `<tr>${cells.map(c => `<td>${c.trim()}</td>`).join('')}</tr>`
      })
      // 将连续的 tr 包裹在 table 中 (需要后续处理，这里先生成 tr)
      // 引用
      .replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>')
      // 代码块
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // 列表
      .replace(/^- (.*$)/gm, '<li>$1</li>')
      // 粗体
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // 折叠块 (details/summary) - 保持原样，浏览器支持
      .replace(/\n/g, '<br>')

    // 修复表格结构 (将连续的 tr 包装进 table)
    htmlContent = htmlContent.replace(/(<tr>.*?<\/tr>(<br>)?)+/g, (match) => {
      const rows = match.replace(/<br>/g, '')
      // 识别表头：第一行通常是表头
      const firstRowEnd = rows.indexOf('</tr>') + 5
      const header = rows.substring(0, firstRowEnd).replace(/td>/g, 'th>')
      const body = rows.substring(firstRowEnd)
      return `<table><thead>${header}</thead><tbody>${body}</tbody></table>`
    })

    // 修复列表结构
    htmlContent = htmlContent.replace(/(<li>.*?<\/li>(<br>)?)+/g, (match) => {
      return `<ul>${match.replace(/<br>/g, '')}</ul>`
    })

    const style = `
      @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');
      @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400&display=swap');

      :root {
        --bg-color: #ffffff;
        --text-primary: #24292f;
        --text-secondary: #57606a;
        --border-color: #d0d7de;
        --accent-color: #0969da;
        --code-bg: #f6f8fa;
        --header-bg: #f6f8fa;
      }

      body {
        margin: 0;
        padding: 40px;
        font-family: 'Roboto', sans-serif;
        color: var(--text-primary);
        line-height: 1.6;
        width: 800px;
      }

      .container {
        background: var(--bg-color);
        padding: 40px;
        border-radius: 8px;
        box-shadow: 0 4px 24px rgba(0,0,0,0.05);
        border: 1px solid var(--border-color);
      }

      h1, h2, h3 {
        margin-top: 24px;
        margin-bottom: 16px;
        font-weight: 600;
        line-height: 1.25;
      }

      h1 { font-size: 2em; border-bottom: 1px solid var(--border-color); padding-bottom: 0.3em; }
      h2 { font-size: 1.5em; border-bottom: 1px solid var(--border-color); padding-bottom: 0.3em; margin-top: 36px; }
      h3 { font-size: 1.25em; margin-top: 24px; }

      p, blockquote, ul, ol, dl, table, pre {
        margin-top: 0;
        margin-bottom: 16px;
      }

      hr {
        height: 0.25em;
        padding: 0;
        margin: 24px 0;
        background-color: var(--border-color);
        border: 0;
      }

      table {
        border-spacing: 0;
        border-collapse: collapse;
        display: block;
        width: max-content;
        max-width: 100%;
        overflow: auto;
      }

      tr {
        border-top: 1px solid var(--border-color);
      }

      tr:nth-child(2n) {
        background-color: var(--code-bg);
      }

      th, td {
        padding: 6px 13px;
        border: 1px solid var(--border-color);
      }

      th {
        font-weight: 600;
        background-color: var(--header-bg);
      }

      code {
        padding: 0.2em 0.4em;
        margin: 0;
        font-size: 85%;
        background-color: var(--code-bg);
        border-radius: 6px;
        font-family: 'JetBrains Mono', monospace;
      }

      blockquote {
        padding: 0 1em;
        color: var(--text-secondary);
        border-left: 0.25em solid var(--border-color);
      }

      ul {
        padding-left: 2em;
      }

      details {
        border: 1px solid var(--border-color);
        border-radius: 6px;
        padding: 8px;
        margin-bottom: 16px;
      }
      
      summary {
        cursor: pointer;
        font-weight: 600;
      }
    `

    return `
      <!DOCTYPE html>
      <html>
      <head><style>${style}</style></head>
      <body>
        <div class="container">
          ${htmlContent}
        </div>
      </body>
      </html>
    `
  }

  private getFullHelpText(): string {
    return `=== 基础命令 ===
    kick <@用户> [-b] [群号]  踢出用户，-b 表示加入黑名单
ban <@用户> {时长} [群号]  禁言用户，支持表达式
unban <@用户> [群号]  解除用户禁言
stop <@用户> 短期禁言用户
ban-all  开启全体禁言
unban-all  解除全体禁言
unban-allppl  解除所有人禁言
nickname <@用户> [昵称] 设置用户昵称，昵称留空则为清除

=== 管理员设置 ===
admin <@用户>  设置管理员
unadmin <@用户>  取消管理员

=== 角色权限管理 ===
gauth.list  列出所有可用角色
gauth.info <@用户>  查看用户的角色
gauth.add <@用户> <角色>  给用户添加角色（支持ID或名称）
gauth.remove <@用户> <角色>  从用户移除角色
getauth <@用户>  查询用户状态和权限（简写：ga）

=== 警告系统 ===
warn <@用户> [次数]  警告用户，默认1次

=== 消息管理 ===
essence *引用消息*  精华消息管理
  -s  设置精华消息
  -r  取消精华消息
delmsg *引用消息*  撤回指定消息
send <群号> [-s] *引用消息* 向指定群发送消息，-s 表示不显示发送者信息

=== 头衔管理 ===
title  群头衔管理：
  -s <文本>  设置头衔
  -r  移除头衔
  -u <@用户>  为指定用户设置（可选）

=== 日志管理 ===
listlog [数量]  显示最近的操作记录，默认100条
clearlog  清理日志文件：
  -d <天数>  保留最近几天的日志，默认7天
  -a  清理所有日志

=== 命令日志统计 ===
cmdlogs  查看命令执行日志：
  -l <数量>  显示条数，默认10条
  -u <用户ID>  筛选特定用户
  -c <命令>  筛选特定命令
  -f  只显示失败的命令
  -p  只显示私聊命令
  -g <群号>  筛选特定群组
  --platform <平台>  筛选特定平台
  -a <等级>  筛选特定权限级别
  -s <日期>  显示指定时间之后的日志
  --until <日期>  显示指定时间之前的日志

cmdstats  查看命令使用统计：
  -l <数量>  显示前N个命令，默认10个
  -r  按最近使用时间排序
  -c <命令>  筛选特定命令
  -u <用户ID>  筛选特定用户
  -g <群号>  筛选特定群组
  --platform <平台>  筛选特定平台
  -a <等级>  筛选特定权限级别
  -s <日期>  统计指定时间之后的数据
  --until <日期>  统计指定时间之前的数据
  --sort <类型>  排序方式：count(次数), time(时间), guild(群号), user(用户)
  --group <类型>  分组方式：command(命令), guild(群组), user(用户), platform(平台)
  --desc  降序排列

cmdclear  清除命令日志
cmdexport  导出命令日志：
  -d <天数>  导出最近N天的日志，默认7天
  -f <格式>  导出格式 (json|csv)，默认json

=== 防撤回功能 ===
antirecall <@用户> [数量] [群号]  查询用户撤回记录

antirecall-config  防撤回功能配置
  -e {true|false}  是否启用本群防撤回功能

antirecall.status  查看防撤回功能状态和统计
antirecall.clear  清理所有撤回记录

=== 关键词管理 ===
verify  入群验证关键词管理：
  -l  列出本群验证关键词
  -a <关键词>  添加验证关键词，多个关键词用英文逗号分隔
  -r <关键词>  移除验证关键词，多个关键词用英文逗号分隔
  --clear 清空所有验证关键词
  -n {true|false}  设置是否自动拒绝未匹配关键词的入群申请
  -w <拒绝词>  设置拒绝时的提示消息

forbidden  禁言关键词管理：
  -l  列出本群禁言关键词
  -a <关键词>  添加禁言关键词，多个关键词用英文逗号分隔
  -r <关键词>  移除禁言关键词，多个关键词用英文逗号分隔
  --clear 清空所有禁言关键词
  -d {true|false}  设置是否自动撤回包含关键词的消息
  -b {true|false}  设置是否自动禁言包含关键词的消息的发送者
  -t <时长>  设置自动禁言时长，支持表达式

=== 欢迎设置 ===
welcome  入群欢迎语管理：
  -s <消息>  设置欢迎语
  -r  移除欢迎语
  -t  测试当前欢迎语
支持变量：
  {at}  @新成员
  {user}  新成员QQ号
  {group}  群号

=== 防复读功能 ===
antirepeat <复读阈值> 设置防复读系统，值为0则关闭

=== 订阅系统 ===
sub  订阅管理：
  log  订阅操作日志（踢人、禁言等操作记录）
  member  订阅成员变动通知（进群、退群）
  mute  订阅禁言到期通知
  blacklist  订阅黑名单变更通知
  warning  订阅警告通知
  all  订阅所有通知
  none  取消所有订阅
  status  查看订阅状态

=== 配置管理 ===
config  配置管理：
  -t  显示所有配置和记录
  -b  黑名单管理
    -a <QQ号>  添加黑名单
    -r <QQ号>  移除黑名单
  -w  警告管理
    -a <QQ号> [次数]  增加警告
    -r <QQ号> [次数]  减少警告

=== 举报功能 ===
report *引用消息*  举报违规消息（权限等级1）
  -v  显示详细判断结果
report-config  配置举报功能（权限等级3）：
  -e {true|false}  是否启用举报功能
  -a {true|false}  是否自动处理违规
  -c {true|false}  是否包含群聊上下文
  -cs {数量}  上下文消息数量（1-20）
  -g {群号}  配置指定群聊
  -auth {等级}  设置权限等级

=== AI功能 ===
ai <内容>  与AI进行对话
  -r  重置对话上下文
translate <文本>  翻译文本（简写：tsl）
  -p <提示词>  自定义翻译提示词
ai-config  配置AI功能：
  -e {true|false}  是否在本群启用AI功能
  -c {true|false}  是否在本群启用对话功能
  -t {true|false}  是否在本群启用翻译功能
  -p [提示词]  设置本群对话系统提示词
  -tp [提示词]  设置本群翻译提示词
  -r  重置为全局配置
同时支持直接@机器人进行对话

=== 娱乐功能 ===
dice <面数> [个数] 掷骰子，生成随机数
config.dice 配置掷骰子功能
  -e {true|false}  是否启用掷骰子功能
  -l <长度>  设置掷骰子结果最大长度，默认1000字符
banme  随机禁言自己
  · 普通抽卡：1秒~30分钟（每次使用递增上限）
  · 金卡概率：0.6%（73抽后概率提升，89抽保底）
  · UP奖励：24小时禁言
  · 歪奖励：12小时禁言（下次必中UP）
config.banme  设置banme配置（权限等级3）：
  -e {true|false}  启用/禁用功能
  --baseMin <秒>  最小禁言时间
  --baseMax <分>  最大禁言时间
  --rate <数值>  增长率
  --prob <概率>  金卡基础概率
  --spity <次数>  软保底抽数
  --hpity <次数>  硬保底抽数
  --uptime <时长>  UP奖励时长
  --losetime <时长>  歪奖励时长
  --autoBan {true|false}  是否自动禁言使用特殊字符的用户
  --reset  重置为全局配置
banme-similar  输出形似字符映射表
banme-record-as <标准串> *引用消息* 逐字符添加形似字符映射
banme-record-allas <标准串> *引用消息* 添加字符串映射
banme-normalize *引用消息* 输出规范化文本

=== 其他功能 ===
quit-group <群号> 让bot退出指定群聊
ban-list 查看禁言名单
unban-random [数量] 随机解除指定数量用户的禁言

=== 时间表达式 ===
支持以下格式：
· 基本单位：s（秒）、min（分钟）、h（小时）
· 基本格式：数字+单位，如：1h、10min、30s
· 支持的运算：
  · +, -, *, /, ^, sqrt(), 1e2
· 表达式示例：
  · (sqrt(100)+1e1)^2s = 400秒 = 6分40秒
· 时间范围：1秒 ~ 29天23小时59分59秒

注：大部分命令默认需要权限等级 3 或以上`
  }
}