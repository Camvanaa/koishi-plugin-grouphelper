你现在是一位拥有10年经验的高级前端工程师和UI设计师，擅长打造类似于 GitHub Dark Mode 或 Vercel 风格的开发者工具界面。请帮我重构当前的代码。

Design Philosophy (去“AI味”的核心): 目前的界面看起来太像通用的模板，我要它变得“硬核”、“专业”且“高信噪比”。请遵循以下设计规范：

Color Palette (利用以下颜色模仿GitHub Dimmed 风格):

html.dark, .theme-root.dark {
    --bg0: #000000;
    --bg1: #1e1e20;
    --bg2: #252529;
    --bg3: #313136;
    --fg0: #ffffff;
    --fg1: rgba(255, 255, 245, .9);
    --fg2: rgba(255, 255, 245, .6);
    --fg3: rgba(255, 255, 245, .4);
    --k-card-bg: var(--bg2);
    --k-card-border: var(--k-color-divider);
    --k-card-shadow: 0 4px 8px -4px rgb(0 0 0 / 15%);
    --k-menu-bg: var(--bg0);
    --k-main-bg: var(--bg3);
    --k-side-bg: var(--bg2);
    --k-page-bg: var(--bg2);
    --k-hover-bg: var(--bg3);
    --k-activity-bg: var(--bg1);
    --k-color-border: rgba(82, 82, 89, .8);
    --k-color-divider: rgba(82, 82, 89, .5);
    --k-color-disabled: #909399;
    --k-text-dark: var(--fg1);
    --k-text-normal: var(--fg2);
    --k-text-light: var(--fg3);
    --k-text-active: var(--k-text-dark);
    --loading-mask-bg: #202225bf;
    --k-color-primary: #7459ff;
    --k-color-primary-shade: rgb(92.8, 71.2, 204);
    --k-color-primary-tint: rgb(129.9, 105.6, 255);
    --k-color-primary-fade: rgba(116, 89, 255, 0.1);
    --k-color-secondary: #4f545c;
    --k-color-secondary-shade: rgb(63.2, 67.2, 73.6);
    --k-color-secondary-tint: rgb(96.6, 101.1, 108.3);
    --k-color-secondary-fade: rgba(79, 84, 92, 0.1);
    --k-color-success: #3ba55e;
    --k-color-success-shade: rgb(47.2, 132, 75.2);
    --k-color-success-tint: rgb(78.6, 174, 110.1);
    --k-color-success-fade: rgba(59, 165, 94, 0.1);
    --k-color-warning: #f9af1b;
    --k-color-warning-shade: rgb(199.2, 140, 21.6);
    --k-color-warning-tint: rgb(249.6, 183, 49.8);
    --k-color-warning-fade: rgba(249, 175, 27, 0.1);
    --k-color-danger: #ff595a;
    --k-color-danger-shade: rgb(204, 71.2, 72);
    --k-color-danger-tint: rgb(255, 105.6, 106.5);
    --k-color-danger-fade: rgba(255, 89, 90, 0.1);
    --k-color-info: #4f545c;
    --k-color-info-shade: rgb(63.2, 67.2, 73.6);
    --k-color-info-tint: rgb(96.6, 101.1, 108.3);
    --k-color-info-fade: rgba(79, 84, 92, 0.1);
}

Borders: 所有的卡片必须有细微的边框。

Text: 主要文字，次要文字

Typography & Layout:

Font: 英文使用 Inter 或系统默认 sans-serif。关键数据（数字）必须使用 Monospace (等宽字体)，这能立刻增加“极客感”。

Density: 减小过大的Padding，让信息密度稍微高一点，但保持呼吸感。

Corner Radius: 统一使用 6px 或 8px（类似 rounded-md），不要用太大的圆角。

Specific Component Changes:

Status Indicators: 不要用那种发光的高斯模糊圆点。使用实心的小圆点，颜色要克制（Mutated colors），例如暗绿色代表正常，而不是荧光绿。

Charts: 线条要细（1px-2px），去掉复杂的背景网格，坐标轴颜色要淡。

Lists (Top 10): 每一行增加轻微的 hover 效果（颜色变亮），进度条/Bar 不要用圆头，用直角或微圆角。

image: 头像等用圆形裁剪

Tech Stack:  Vue 3 + Tailwind CSS

Action: 请根据以上规范，直接修改/重写我的webui dashboardview代码。重点优化配色和边框细节