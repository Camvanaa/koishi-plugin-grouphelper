/**
 * StatusModule - 状态模块
 * 提供系统状态查询和可视化展示
 */

import { Context, segment, Logger } from 'koishi'
import { BaseModule, ModuleMeta } from './base.module'
import { DataManager } from '../data'
import { Config } from '../../types'
import { formatDuration } from '../../utils'
import os from 'os'

export class StatusModule extends BaseModule {
  private logger = new Logger('status')

  readonly meta: ModuleMeta = {
    name: 'status',
    description: '状态模块 - 查看 Bot 运行状态'
  }

  constructor(ctx: Context, data: DataManager, config: Config) {
    super(ctx, data, config)
  }

  protected async onInit(): Promise<void> {
    this.registerCommands()
  }

  private registerCommands(): void {
    this.registerCommand({
      name: 'gstatus',
      desc: '查看系统状态',
      permNode: 'status.view',
      permDesc: '查看系统状态图片',
      skipAuth: true // 允许直接调用
    })
      .action(async ({ session }) => {
        // 检查 puppeteer 服务
        if (!this.ctx.puppeteer) {
          return '错误：未安装 puppeteer 插件，无法生成状态图片。'
        }

        try {
          // 收集数据
          const data = await this.getSystemData()
          
          // 渲染 HTML
          const html = this.renderHtml(data)
          
          // 生成图片
          const page = await this.ctx.puppeteer.page()
          try {
            await page.setViewport({ width: 900, height: 800, deviceScaleFactor: 2 })
            await page.setContent(html, { waitUntil: 'load' }) // 改为 load，避免网络请求超时
            
            const element = await page.$('.container')
            if (element) {
                const image = await element.screenshot({ encoding: 'binary', omitBackground: true })
                return segment.image(image, 'image/png')
            }
            
            // Fallback: 截取全屏
            const fullPage = await page.screenshot({ encoding: 'binary', fullPage: true })
            return segment.image(fullPage, 'image/png')
          } finally {
            await page.close()
          }
        } catch (e) {
          return `生成状态图失败：${e.message}`
        }
      })
  }

  private async getSystemData() {
    const memoryUsage = process.memoryUsage()
    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    const usedMem = totalMem - freeMem
    
    // 获取 CPU 使用率（简单估算）
    const cpus = os.cpus()
    const cpuModel = cpus[0]?.model || 'Unknown CPU'
    
    // Bot 统计
    const plugins = this.ctx.registry.size
    
    // GroupHelper 统计
    const groupCount = Object.keys(await this.data.groupConfig.getAll()).length
    const logCount = (await this.data.commandLogs.getAll()).length
    
    return {
      os: {
        platform: os.platform(),
        release: os.release(),
        arch: os.arch(),
        hostname: os.hostname(),
        uptime: os.uptime()
      },
      process: {
        uptime: process.uptime(),
        version: process.version,
        memory: {
          rss: memoryUsage.rss,
          heapTotal: memoryUsage.heapTotal,
          heapUsed: memoryUsage.heapUsed
        }
      },
      system: {
        cpuModel,
        cpuCount: cpus.length,
        totalMem,
        usedMem,
        loadavg: os.loadavg()
      },
      bot: {
        version: '4.18.7', // 应该从 package.json 获取，这里硬编码或从 ctx.app.version 获取
        plugins
      },
      grouphelper: {
        version: '0.3.3', // 应该从 package.json 获取
        groupCount,
        logCount
      }
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  private renderHtml(data: any): string {
    // CSS 样式 (扁平化、无 AI 风、类似 status-pro 的简洁风格)
    const style = `
      @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');
      
      :root {
        --bg-color: #ffffff;
        --card-bg: #f8f9fa;
        --text-primary: #212529;
        --text-secondary: #868e96;
        --accent-color: #228be6;
        --border-color: #e9ecef;
      }

      body {
        margin: 0;
        padding: 20px;
        background: transparent;
        font-family: 'Roboto', 'Segoe UI', sans-serif;
        color: var(--text-primary);
        width: 800px;
      }

      .container {
        background: var(--bg-color);
        border-radius: 12px;
        padding: 32px;
        /* 轻微阴影，更扁平 */
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        border: 1px solid var(--border-color);
        display: flex;
        flex-direction: column;
        gap: 24px;
      }

      .header {
        display: flex;
        align-items: center;
        padding-bottom: 20px;
        border-bottom: 1px solid var(--border-color);
      }

      .logo {
        width: 48px;
        height: 48px;
        background: var(--accent-color);
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        font-weight: bold;
        color: white;
        margin-right: 16px;
      }

      .title h1 {
        margin: 0;
        font-size: 24px;
        font-weight: 700;
        color: var(--text-primary);
      }

      .title p {
        margin: 2px 0 0;
        color: var(--text-secondary);
        font-size: 14px;
      }

      /* 核心指标区域 */
      .main-stats {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 24px;
      }

      .chart-card {
        background: var(--card-bg);
        border-radius: 8px;
        padding: 24px;
        display: flex;
        align-items: center;
        gap: 24px;
        border: 1px solid var(--border-color);
      }

      .chart-info {
        flex: 1;
      }

      .chart-title {
        color: var(--text-secondary);
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 8px;
      }

      .chart-value {
        font-size: 32px;
        font-weight: 500;
        color: var(--text-primary);
        margin-bottom: 4px;
      }

      .chart-sub {
        font-size: 13px;
        color: var(--text-secondary);
      }

      /* Circular Progress (扁平化) */
      .circle-chart {
        width: 80px;
        height: 80px;
      }

      .circle-bg {
        fill: none;
        stroke: #dee2e6; /* 灰色背景 */
        stroke-width: 4;
      }

      .circle {
        fill: none;
        stroke: var(--accent-color);
        stroke-width: 4;
        stroke-linecap: round;
        /* 移除 drop-shadow 减少 AI 感 */
      }

      /* 详细数据网格 */
      .grid-stats {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 24px;
      }

      .stat-column {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .stat-header {
        font-size: 14px;
        font-weight: 700;
        color: var(--text-primary);
        padding-bottom: 8px;
        border-bottom: 2px solid var(--accent-color);
        display: inline-block;
        margin-bottom: 8px;
      }

      .stat-item {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        font-size: 14px;
      }

      .stat-key {
        color: var(--text-secondary);
      }

      .stat-val {
        font-weight: 500;
        color: var(--text-primary);
      }

      .footer {
        text-align: right;
        font-size: 12px;
        color: var(--text-secondary);
        margin-top: 8px;
        padding-top: 16px;
        border-top: 1px solid var(--border-color);
      }
    `

    // 计算数据
    const memUsagePercent = (data.process.memory.rss / data.system.totalMem) * 100
    const sysMemUsagePercent = (data.system.usedMem / data.system.totalMem) * 100
    
    // 生成 SVG 环形进度条 (扁平风格)
    const renderCircle = (percent: number) => {
        const radius = 18
        const circumference = radius * 2 * Math.PI
        const offset = circumference - (percent / 100) * circumference
        return `
            <svg class="circle-chart" viewBox="0 0 40 40">
                <path class="circle-bg" d="M20 2.0845 a 17.9155 17.9155 0 0 1 0 35.831 a 17.9155 17.9155 0 0 1 0 -35.831" />
                <path class="circle" stroke-dasharray="${circumference}, ${circumference}" stroke-dashoffset="${offset}" d="M20 2.0845 a 17.9155 17.9155 0 0 1 0 35.831 a 17.9155 17.9155 0 0 1 0 -35.831" />
            </svg>
        `
    }
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>${style}</style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">GH</div>
            <div class="title">
              <h1>System Status</h1>
              <p>GroupHelper Monitor</p>
            </div>
          </div>

          <!-- Main Visual Stats -->
          <div class="main-stats">
            <div class="chart-card">
              <div class="chart-info">
                <div class="chart-title">System Memory</div>
                <div class="chart-value">${sysMemUsagePercent.toFixed(1)}%</div>
                <div class="chart-sub">${this.formatBytes(data.system.usedMem)} / ${this.formatBytes(data.system.totalMem)}</div>
              </div>
              ${renderCircle(sysMemUsagePercent)}
            </div>
            <div class="chart-card">
               <div class="chart-info">
                <div class="chart-title">Process Memory</div>
                <div class="chart-value">${memUsagePercent.toFixed(1)}%</div>
                <div class="chart-sub">${this.formatBytes(data.process.memory.rss)} Used</div>
              </div>
              ${renderCircle(memUsagePercent)}
            </div>
          </div>

          <!-- Detailed Grid -->
          <div class="grid-stats">
            <div class="stat-column">
              <div class="stat-header">APPLICATION</div>
              <div class="stat-item">
                 <span class="stat-key">Koishi</span>
                 <span class="stat-val">v${data.bot.version}</span>
              </div>
               <div class="stat-item">
                 <span class="stat-key">GroupHelper</span>
                 <span class="stat-val">v${data.grouphelper.version}</span>
              </div>
               <div class="stat-item">
                 <span class="stat-key">Uptime</span>
                 <span class="stat-val">${formatDuration(data.process.uptime * 1000)}</span>
              </div>
            </div>

            <div class="stat-column">
              <div class="stat-header">SYSTEM</div>
              <div class="stat-item">
                 <span class="stat-key">OS</span>
                 <span class="stat-val">${data.os.platform}</span>
              </div>
               <div class="stat-item">
                 <span class="stat-key">Arch</span>
                 <span class="stat-val">${data.os.arch}</span>
              </div>
               <div class="stat-item">
                 <span class="stat-key">Load Avg</span>
                 <span class="stat-val">${data.system.loadavg[0].toFixed(2)}</span>
              </div>
            </div>

            <div class="stat-column">
              <div class="stat-header">STATISTICS</div>
              <div class="stat-item">
                 <span class="stat-key">Plugins</span>
                 <span class="stat-val">${data.bot.plugins}</span>
              </div>
               <div class="stat-item">
                 <span class="stat-key">Groups</span>
                 <span class="stat-val">${data.grouphelper.groupCount}</span>
              </div>
               <div class="stat-item">
                 <span class="stat-key">Logs</span>
                 <span class="stat-val">${data.grouphelper.logCount}</span>
              </div>
            </div>
          </div>

          <div class="footer">
            Generated at ${new Date().toLocaleString('zh-CN')}
          </div>
        </div>
      </body>
      </html>
    `
  }
}