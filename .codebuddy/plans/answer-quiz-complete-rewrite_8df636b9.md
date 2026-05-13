---
name: answer-quiz-complete-rewrite
overview: 基于答题页移植指南和技术疑问回复，完整重写 answer-quiz.vue 页面，包括新的 DOM 结构、色彩系统、动画系统、交互反馈和切题时序。
design:
  architecture:
    framework: vue
  styleKeywords:
    - 暖橙活力
    - 精致动效
    - 心理测试
    - 卡片式布局
    - 分层叠加
    - 柔和渐变背景
  fontSystem:
    fontFamily: system-ui, sans-serif
    heading:
      size: 52rpx
      weight: 900
    subheading:
      size: 34rpx
      weight: 700
    body:
      size: 24rpx
      weight: 700
  colorSystem:
    primary:
      - "#F97316（orange-500, 选中态主色）"
      - "#FB923C（orange-400, 进度条渐变起始）"
      - "#FF8904（匹配当前代码的橙色, 标签色）"
    background:
      - "#F3F4F6（全局背景）"
      - "#FFFFFF（选项默认背景）"
      - "#F7F8FA（6色循环1）"
      - "#FFF9F4（6色循环2）"
      - "#F4F7FB（6色循环3）"
      - "#F7FAF4（6色循环4）"
      - "#FCF6F4（6色循环5）"
      - "#F4F8F9（6色循环6）"
    text:
      - "#1F2937（gray-800, 题目文字）"
      - "#374151（gray-700, 选项默认文字）"
      - "#111827（gray-900, 选中态文字）"
      - "#FFFFFF（选中态白色文字）"
      - "#9CA3AF（gray-400, 标签/吐槽/未达步点）"
    functional:
      - rgba(249,115,22,0.55)（edge-glow 发光色）
      - rgba(249,115,22,0.2)（选中态外发光环）
      - rgba(249,115,22,0.35)（ripple 波纹色）
      - "#FFF7ED（orange-50, 字母标默认背景）"
      - rgba(255,255,255,0.25)（选中态字母标背景）
      - rgba(255,255,255,0.6)（灰态选项背景）
todos:
  - id: step-01-template-header
    content: 编写 Template 顶部区域：.frame > .ambient-layer(3光斑) + .hd(返回/标签/题号/dots/进度条+光点)
    status: completed
  - id: step-02-template-stage
    content: 编写 Template 答题区：双槽位 .card(A/B) > .q-wrap > .q-txt+.char-drop + .opts > .o-wrap(.o-inner > .o-letter+.o-txt+.ripple + .o-fx)
    status: completed
    dependencies:
      - step-01-template-header
  - id: step-03-template-overlays
    content: 编写 Template 浮层区：.flash-overlay + .edge-glow + .streak-badge + .tease-bubble + .confetti-layer + .retry-layer
    status: completed
    dependencies:
      - step-02-template-stage
  - id: step-04-script-data
    content: 编写 Script 数据层：完整 data（含 ripples/streak/confetti/idle/tease/pressFill/flash 等新字段）、computed、onLoad 初始化
    status: completed
    dependencies:
      - step-01-template-header
      - step-02-template-stage
      - step-03-template-overlays
  - id: step-05-script-pick
    content: 编写 Script 核心方法 pick()：t0锚点时序（选中态/ripple/flash/edge-glow/burst/vibrate/confirmPop/离场/入场/解锁）
    status: completed
    dependencies:
      - step-04-script-data
  - id: step-06-script-effects
    content: 编写 Script 特效方法：spawnRipple/spawnBurst/checkStreak/showTease/resetIdle/toggleConfetti + 长按充能 + 低端机检测
    status: completed
    dependencies:
      - step-04-script-data
  - id: step-07-script-lifecycle
    content: 编写 Script 剩余方法：goBack/goResult(含submitAnswer)/loadSurvey/manualRetry/pickOpts + 导入survey-utils评分算法
    status: completed
    dependencies:
      - step-04-script-data
  - id: step-08-css-top
    content: 编写 CSS 顶部区域：.page/.frame/背景6色动态/.ambient-layer+光斑/.hd/返回/dots/步点/进度条+光点/过半脉冲
    status: completed
    dependencies:
      - step-01-template-header
  - id: step-09-css-stage
    content: 编写 CSS 答题区：.stage/.card入出/双槽位/.q-wrap+qIn/qOut/.char-drop/.opts/.o-wrap/.o-inner+选中态阴影/.o-letter/.ripple-circle/.ring-pulse/.burst-dot/.o-fx/.idle-breathe/.confirm-pop
    status: completed
    dependencies:
      - step-02-template-stage
  - id: step-10-css-overlays
    content: 编写 CSS 浮层区及全部keyframes：.flash-overlay/.edge-glow/.streak-badge/.tease-bubble/.confetti-piece/.retry-layer + 所有@keyframes完整定义
    status: completed
    dependencies:
      - step-03-template-overlays
---

## 答题页完整重写

基于《答题页-回复重设计移植指南》和《技术疑问回复》两份文档，将 answer-quiz.vue 从基本功能页面重写为高质量动画交互的答题测评页面。

### 核心功能

- **双槽位切题机制**：A/B 槽位叠加切换，入场/离场动画交叉，420ms 选中态保持 + 100ms 叠加窗口
- **完整色彩系统**：6 色背景循环、橙色主色选中态、完整阴影系统、渐变进度条
- **动画系统（10 类动画）**：入场/离场、confirmPop 弹跳、ripple 水波纹、ring-pulse 描边环、burst-dot 粒子迸溅、digit-roll 数字翻滚、char-drop 逐字浮现、idle-breathe 闲置呼吸、confetti 纸屑、flash/edge-glow 闪光特效
- **t0 锚点时序**：不嵌套 setTimeout，辐射式调用，精确到 ms 的切题时间线（总耗时 1170ms）
- **交互反馈**：hover-class 按压缩放、uni.vibrateShort 震动反馈（最后一题三连震 0/260/520ms）、长按 600ms 彩蛋气泡、连击徽章
- **步点进度**：hd-dots 圆点步进、进度条弹性动画、过半脉冲光晕
- **背景装饰**：3 颗大模糊光斑漂浮（三份硬编码 keyframes）、低端机关闭
- **数据加载**：加载骨架屏 / 错误重试 / uniCloud 云对象 getSurveyByTag / submitAnswer
- **结果跳转**：完整维度评分计算 + 结果页 redirectTo

### 技术要求

- Vue 2 + uni-app + 微信小程序
- 全部数值使用 rpx，不用 px（transformPx: false）
- 禁止使用 `inset: 0`，一律用 `top:0;right:0;bottom:0;left:0`
- 不使用 :key 强制重建，双 animation-name 交替方案
- hover-class + hover-start-time + hover-stay-time 代替 active:scale

## 技术栈

- **前端框架**：Vue 2 + uni-app（微信小程序模式）
- **后端**：uniCloud 云对象（survey 云对象，getSurveyByTag / submitAnswer）
- **工具函数**：common/survey-utils.js（normalizeDimensionScores / nearestNeighborMatch）
- **数据格式**：问卷数据结构含 questions（title + options[{ text, scores }]）、dimensions、resultTypes

## 实现方案

### 架构设计

采用**双槽位叠加 + 事件驱动时序**架构：

```
.page (全屏容器, bg #F3F4F6)
  └── .frame (背景容器, 6色循环, overflow:hidden, min-height:100vh)
       ├── .ambient-layer (z-0, 3光斑, 低端机关闭)
       ├── .hd (z-10, 顶部栏 + 步点 + 进度条)
       ├── .stage (z-0, flex-1, 双槽位 absolute 叠加)
       │    ├── .card.A (visible/phase 驱动)
       │    │    ├── .q-wrap > .q-txt > .char-drop × N
       │    │    └── .opts > .o-wrap × N > .o-inner(.o-letter + .o-txt) + .o-fx
       │    └── .card.B (同上, 双槽位交替)
       ├── .flash-overlay (z-60, 全屏一闪)
       ├── .edge-glow (z-55, 边缘光晕)
       ├── .streak-badge (z-50, fixed top)
       ├── .tease-bubble (z-50, fixed bottom)
       ├── .confetti-layer (z-40, absolute)
       └── .retry-layer (z-100, fixed, loading/error态)
```

**时序管理**——t0 锚点辐射式：

```js
pick(slot, i, e) {
  const t0 = Date.now()
  const at = (delay, fn) => setTimeout(fn, Math.max(0, delay))
  // T+0ms: 选中态/ripple/flash/edge-glow/burst/vibrate
  // T+220ms: flash结束
  // T+420ms: confirm移除, 旧卡phase=out
  // T+520ms: 新卡phase=in, activeSlot切换
  // T+720ms: 旧卡visible=false
  // T+1170ms: locked=false
}
```

所有视觉时序（粒子/波纹/纸屑/闪光）通过 CSS animation delay 自行管理，JS 只负责触发一次。

### 关键技术决策

| 决策点 | 方案 | 理由 |
| --- | --- | --- |
| animation 重播 | 双 animation-name 交替 | 小程序 :key 无效，此方案已验证 |
| 背景光斑漂移 | 三份硬编码 keyframes | var() 在 @keyframes 中 Android 不可靠，装饰动画30行代码性价比最高 |
| ripple 坐标 | event.touches[0].x/y，绑在 .o-inner（view）上 | 小程序默认行为，无需 query 异步开销 |
| overflow 裁切 | .o-inner overflow:hidden；.o-fx（burst/ring）独立浮层 | 波纹在裁切层内，粒子要"漏"出按钮外 |
| 震动三连 | 间隔 0/260/520ms | iOS Taptic Engine 限制，此间隔双端一致 |
| 选项数量 | 数据驱动（v-for），保留 3 选项，字母标做成开关 | 后端决定选项数，不做硬编码 |
| 纸屑降级 | benchmarkLevel < 10 时从 40 片减为 20 片 | 低端机性能保护 |


## 实现要点

### 性能优化

- 背景光斑：低端机关闭整层（display:none），高端机 CSS GPU 渲染，不用 rAF
- 纸屑：基础库 < 2.10 或 benchmarkLevel < 10 时减半
- char-drop：超过 15 字的题步进从 25ms 改为 20ms
- transition 使用 transform/opacity 等 GPU 属性，避免 layout 触发

### 时序保障

- `pick()` 内所有 `at()` 调用在同步 tick 内执行，不嵌套
- 视觉类动画（particle/ripple/confetti）通过 CSS delay/duration 自行管理
- 离场动画 300ms，进场动画最晚项 180ms delay + 300ms duration = 480ms
- 叠加窗口 100ms（旧卡离场阶段 +420ms 后，新卡 +520ms 入场）

### 数据流

```
loadSurvey() → uniCloud.getSurveyByTag → survey.data
  → slots.A.q = questions[0], pickOpts() 生成选项文本
pick() → ans[] 记录 { dim, score, questionIndex, optionIndex }
goResult() → normalizeDimensionScores() → nearestNeighborMatch()
  → uniCloud.submitAnswer() → uni.redirectTo(result)
```

### 兼容性

- 最低支持基础库 2.20.0（覆盖 99%+）
- 小程序 `inset` 不写，全部用 top/right/bottom/left
- 事件绑在 `<view>` 而非 `<button>` 上
- 光斑/纸屑有低端机降级开关
- 所有动画在 WXSS 中完整定义，无 Web 特有 API 依赖

## 目录结构

本次改动仅涉及一个文件：

```
pages-tools/
└── answer-quiz/
    └── answer-quiz.vue   # [MODIFY] 完整重写，从342行增至约1400-1600行
```

不新增文件，不改动其他页面。

## 设计风格

采用**暖橙活力 + 精致动效**的设计语言，对标心理测试类小程序的顶级交互品质。

整个页面在一个 `.frame` 容器内展示，背景在 6 种柔和色彩间循环切换（#F7F8FA / #FFF9F4 / #F4F7FB / #F7FAF4 / #FCF6F4 / #F4F8F9），过渡 0.7s ease-out。3 颗大模糊光斑（440/520/360rpx）在背景中缓慢漂移，增添呼吸感。

顶部栏包含圆形返回按钮（64×64rpx，白色阴影背景）、标签名（28rpx 灰色）、题号数字翻滚（橙色高亮数字 + 双 animation-name 交替动画）、吐槽文案（6 条循环）。步点圆点（12×12rpx）随进度变化颜色和发光强度。进度条使用橙渐变填充 + 弹性回弹缓动 + 光点跟随 + 过半脉冲发光。

题目区居中展示 52rpx 粗体文字，字符逐字掉落浮现（步进 25ms）。选项为圆角 48rpx 卡片，默认白色背景 + 浅阴影，左侧有圆形字母标（A/B/C/D，56×56rpx）。选中瞬间触发 ripple 水波纹 + ring-pulse 描边环 + 6 颗粒子迸溅 + confirmPop 弹跳 + 全屏 edge-glow 边缘光晕——整个按钮变橙色背景、白色文字、浮起 8rpx、外发光环。所有反馈集中堆叠在 320ms 内完成。

切题时有 100ms 叠加窗口（新旧卡片同时可见），旧卡选项从上到下消失，新卡选项从下到上弹出。最后一题触发纸屑（40 片）和三连震（heavy/medium/light）。长按 600ms 触发充能环动画 + 彩蛋气泡。连续答题触发连击徽章弹入。

全部数值基于 375px 基准换算为 rpx。小程序特有 hover-class 代替 Web hover。

# Agent Extensions

本任务不需要使用任何扩展能力。所有设计规范已包含在移植指南和技术回复文档中，代码实现直接参考现有 uni-app 项目模式即可。