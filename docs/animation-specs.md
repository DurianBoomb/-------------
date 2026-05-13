# 动画规格文档

> 记录首页及各页面在原型图中无法体现的动效规格，供后续开发阶段参考实现。

---

## 一、标签池 · 掉落动画

### 触发时机
- 页面首次加载
- 点击「换一批」按钮刷新标签时

### 动效描述
标签从画面上方不同位置垂直掉落进入标签池区域，到达预定位置后轻微弹跳两下停止。所有标签同时开始掉落但延迟不同，形成错落有致的"下雨"效果。

### 技术规格

| 参数 | 值 | 说明 |
|------|-----|------|
| 动画时长 | 0.6s | 单个标签从起始到静止的总时长 |
| 缓动曲线 | cubic-bezier(0.34, 1.56, 0.64, 1) | 终点处超出再回弹，产生果冻效果 |
| 初始位移 | translateY(-80px) + opacity: 0 | 标签从上方80px处开始掉落，且不可见 |
| 终点状态 | translateY(0) + opacity: 1 | 到达最终位置，完全可见 |
| 随机延迟范围 | 0 ~ 0.5s | 每个标签的 animation-delay 在此范围内随机 |
| 填充模式 | both | 动画开始前应用起始状态，结束后保持终点状态 |

### CSS 实现（Figma 验证通过的代码）

```css
@keyframes dropElastic {
  0% {
    opacity: 0;
    transform: translateY(-80px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-drop-elastic {
  animation: dropElastic 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
```

### 随机延迟算法
```js
// 使用伪随机确保相同标签每次渲染延迟一致
// refreshId 每次换一批时递增，整体偏移
const animDelay = (Math.abs(Math.sin(idx + refreshId * 10)) * 0.5).toFixed(2)
```

### 刷新逻辑（完整实现）

```js
// 状态定义
data() {
  return {
    refreshId: 0,          // 刷新计数器，每次换一批 +1
    isRefreshing: false,   // 是否正在刷新动画中
    activeTags: [],        // 当前显示的标签列表
    allTags: [...]         // 全部标签池
  }
}

methods: {
  // 换一批
  handleRefresh() {
    if (this.isRefreshing) return  // 防抖，动画期间禁用
    this.isRefreshing = true
    this.refreshId++
    this.shuffleTags()
    // 动画时长后解锁
    setTimeout(() => {
      this.isRefreshing = false
    }, 800)
  },
  
  // 打乱标签
  shuffleTags() {
    const shuffled = [...this.allTags].sort(() => Math.random() - 0.5)
    this.activeTags = shuffled.slice(0, 16)
  }
}
```

**关键：强制重绘**
通过改变循环元素的 `:key` 值让 Vue 销毁重建 DOM，从而重新触发动画：

```vue
<view
  v-for="(tag, idx) in activeTags"
  :key="`${tag}-${refreshId}`"
  :style="{ animationDelay: animDelay(idx) + 's' }"
  class="animate-drop-elastic"
>
  {{ tag }}
</view>
```

### ⚠️ 微信小程序注意事项

**1. `:key` 表达式在 WXML 中不生效**
微信小程序不支持 `:key="表达式"` 语法，编译后不会生成 `wx:key`，DOM 不重建。

**解决方法**：用 `v-if` 两步重建代替 `:key`：

```html
<view v-if="showGrid" class="tag-grid">
  <view v-for="(tag, idx) in tags" :key="idx">
```

```javascript
handleRefresh() {
  this.showGrid = false
  this.$nextTick(() => {
    this.refreshId++
    this.tags.sort(() => Math.random() - 0.5)
    this.showGrid = true  // ← 重建DOM，动画重播
  })
}
```

**2. DOM 分层避免 transform 冲突**
`@keyframes` 的 `animation-fill-mode: both` 会锁定 `transform` 属性，导致 hover-class 的 `scale()` 被覆盖。

**解决方法**：外层按压缩放，内层掉落动画：

```html
<view class="tag-wrapper" hover-class="tag-press" :hover-start-time="0" :hover-stay-time="150">
  <view class="tag-inner" :style="{ animationDelay: '...' }">
    {{ tag.name }}
  </view>
</view>
```

**3. 统一延迟公式**
```javascript
// 0.1s 基础偏移 + 0~0.4s 伪随机散落
const delay = (0.1 + Math.abs(Math.sin(idx + refreshId * 10)) * 0.4).toFixed(2)
```

### 标签样式模板（按稀有度分级）

标签的大小和颜色不再随机，而是**关联该标签的人气/热度/分享数据**。每个标签有一个 `popularity` 字段（0-100），决定了它的稀有度等级：

| 等级 | 人气值范围 | 样式表现 | 池中出现比例 |
|------|-----------|---------|------------|
| 🌟 传说 | 80-100 | 大尺寸(padding/字号+2) + 橙底 + 橙边 + 深色文字 | 5% |
| ⭐ 稀有 | 50-79 | 标准大小 + 实色浅底（紫/蓝/绿等随机） | 20% |
| ◻️ 普通 | 0-49 | 标准大小 + 白底 + 灰边（空心） | 50% |
| 🔹 默认 | 暂无数据 | 标准大小 + 白底 + 无边框 | 25% |

**数据来源**：
- 人气值由云端题库数据提供（答题次数 + 分享次数加权计算）
- 原型阶段先用 mock 数据模拟（每个标签预置 popularity 值）
- 后续对接真实数据后自动更新

**刷新规则**：
- 「换一批」时，按比例随机抽取不同稀有度的标签填充池子（保证每次都有1-2个"传说"级标签）
- 但不要每次刷新都看到同一个"传说"标签——用随机池保证多样性

**设计意义**：
- 用户下意识会觉得"大号橙色的标签很热门/很好玩"——激发点击欲望
- 看到灰边白底的标签也不会觉得丑——它只是"还没火起来"，反而给人发现的快感
- 这种微妙的层次感让标签池更像一个"内容广场"而不是"功能菜单"

---

## 二、交互反馈微动效

### 标签点击反馈
| 状态 | 效果 | 参数 |
|------|------|------|
| 点击 | 轻微缩小 | transform: scale(0.9)，0.15s 过渡 |
| 松开 | 恢复原状 | transform: scale(1)，0.15s 过渡 |

### 按钮点击反馈
| 元素 | 效果 | 参数 |
|------|------|------|
| 搜索框点击 | 普通点击 | 无特殊动画 |
| 随便测测卡片 | 整体缩小 | transform: scale(0.96)，0.2s 过渡 |
| 推荐卡片 | 整体缩小 | transform: scale(0.98)，0.2s 过渡 |
| 换一批按钮 | 图标旋转 + 禁用 800ms | 0.3s 过渡 |

### 页面过渡
| 场景 | 效果 | 参数 |
|------|------|------|
| 首页 → 答题页 | fade in | 0.3s 过渡 |

---

## 三、答题页 · 题目切换动画

Figma 已通过 React 状态机（entering → entered → exiting）验证可行。

### 动效描述
每次选择选项后，当前题目向上淡出，下一题从底部滑入。选项有果冻按压反馈，短暂停顿后自动切换。

### 技术规格

| 参数 | 值 | 说明 |
|------|-----|------|
| 选项点击反馈 | scale(0.95) + 背景加深 | 点击瞬间的果冻按压感，0.15s |
| 点击后停顿 | 0.2s | 让用户感知到"选中了"，再触发切换 |
| 旧题退场 | translateY(-30px) + opacity 0 → 1 | 向上淡出，0.3s ease-out |
| 新题入场 | translateY(60px) + opacity 0 → 1 | 从底部滑入，0.3s ease-out |
| 题目与选项入场延迟 | 微小延迟 | 题目先出现，选项稍后，制造层次感 |

### Vue 2 实现方案

使用 Vue 的 `<transition>` 组件包裹题目和选项区域，通过动态 `:key` 触发进出场动画：

```vue
<template>
  <view class="quiz-page">
    <!-- 进度 -->
    <view class="progress-bar">第 {{ current + 1 }}/{{ questions.length }} 题 · 离确诊又近了一步 🤡</view>

    <!-- 题目 + 选项（用 transition 包裹，key 变化时触发动画） -->
    <transition name="slide-up">
      <view class="question-block" :key="current">
        <view class="question-text">{{ questions[current].title }}</view>
        <view class="options">
          <view
            v-for="(opt, idx) in questions[current].options"
            :key="idx"
            class="option-btn"
            :class="{ selected: selectedIdx === idx }"
            @click="selectOption(idx)"
          >
            {{ opt.text }}
          </view>
        </view>
      </view>
    </transition>
  </view>
</template>

<style>
/* 入场：从下方滑入并渐显 */
.slide-up-enter-active {
  animation: slideUpIn 0.3s ease-out;
}
/* 退场：向上滑出并渐隐 */
.slide-up-leave-active {
  animation: slideUpOut 0.25s ease-in;
}

@keyframes slideUpIn {
  0%   { opacity: 0; transform: translateY(60px); }
  100% { opacity: 1; transform: translateY(0); }
}

@keyframes slideUpOut {
  0%   { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(-30px); }
}

/* 选项点击反馈 */
.option-btn:active {
  transform: scale(0.95);
}
.option-btn.selected {
  /* 选中高亮样式，由 JS 控制 0.2s 后触发切换 */
}
</style>
```

### 答题完成自动跳转
答完最后一道题后，延迟 0.3s（等待退场动画结束）自动跳转到结果页。

---

## 四、结果页 · 入场动画

Figma 已通过纯 CSS @keyframes 验证可行。

### 动效描述
结果页加载时，各元素依次入场，制造"揭晓答案"的仪式感：emoji从上方弹性掉落，雷达图从中心放大，描述和按钮依次滑入。

### 动画定义

```css
@keyframes resDrop {
  0%   { opacity: 0; transform: translateY(-60px); }
  100% { opacity: 1; transform: translateY(0); }
}

@keyframes resScale {
  0%   { opacity: 0; transform: scale(0.5); }
  100% { opacity: 1; transform: scale(1); }
}

@keyframes resSlide {
  0%   { opacity: 0; transform: translateY(40px); }
  100% { opacity: 1; transform: translateY(0); }
}

/* 统一弹性缓动 */
.anim-res-1 { animation: resDrop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0s both; }
.anim-res-2 { animation: resScale 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s both; }
.anim-res-3 { animation: resSlide 0.4s ease-out 0.3s both; }
.anim-res-4 { animation: resSlide 0.3s ease-out 0.45s both; }
```

### 层级与延迟

| 层级 | 元素 | 动画 | 延迟 |
|------|------|------|------|
| .anim-res-1 | 大emoji + 结果名 | resDrop（从上掉落） | 0s |
| .anim-res-2 | 雷达图 | resScale（中心放大） | 0.15s |
| .anim-res-3 | 结果描述卡片 | resSlide（底部滑入） | 0.3s |
| .anim-res-4 | 底部操作按钮 | resSlide（底部滑入） | 0.45s |

### 雷达图实现方案（纯 SVG，无第三方库）

Figma 使用纯手工 SVG 绘制雷达图，不依赖 echarts 等重型库：

- 接收 `dimensions`（维度名数组）和 `scores`（0-100 得分数组）
- 用 `sin/cos` 三角函数计算每个得分在圆周上的 X/Y 坐标
- 连成 `polygon` 多边形，填充半透明橙色
- Vue 2 迁移：抽离为 `RadarChart.vue` 组件，用 `computed` 预计算坐标点，`v-for` 渲染 polygon/line/text

---

## 五、搜索页 · 手风琴标签掉落

### 触发时机
展开手风琴分类时，内部标签以掉落动画入场。

### @keyframes
```css
@keyframes dropElastic {
  0% { opacity: 0; transform: translateY(-40px); }
  100% { opacity: 1; transform: translateY(0); }
}

> **移植注意**：在 uni-app 中，375px 设计稿的 40px = 80rpx。px→rpx 转换公式：`rpx = px × (750 / 设计稿宽度)`，375px 设计稿下 ×2。
```

### 动画参数
| 参数 | 值 | 说明 |
|------|-----|------|
| duration | 0.6s | 单次掉落时长 |
| timing-function | cubic-bezier(0.34, 1.56, 0.64, 1) | 超调回弹，标签掉落后弹一下的物理果冻感 |
| delay | `Math.abs(Math.sin(idx + refreshId * 10)) * 0.4` | 0~0.4s 伪随机延迟 |
| fill-mode | both | 动画前保持在起始位置，结束后停在终点 |

### 交互反馈
| 元素 | 反馈 | 实现方式 | 具体值 |
|------|------|---------|--------|
| 搜索结果卡片 | 轻微缩放 | hover-class | scale(1) → scale(0.98) |
| 手风琴头部 | 背景色闪烁 | hover-class | 背景变 rgba(0,0,0,0.03) |
| 手风琴箭头 | 旋转 | transition | 0deg ↔ 180deg, 300ms |
| 手风琴主体 | 高度丝滑拉伸 | max-height 过渡 | 0 ↔ 700rpx, 300ms ease-in-out |
| 标签卡片 | 按下缩小 | hover-class | scale(1) → scale(0.9) |
| 取消/换一批按钮 | 按下缩小 | hover-class | scale(1) → scale(0.95) |

### 刷新按钮旋转动画
- 触发：点击「换一批」时
- 周期：1s linear infinite
- 持续 500ms 后移除（由 `isRefreshing` 状态控制）

### Figma 给出的 Vue 2 移植建议

**1. 手风琴展开动画**
- 不用 CSS Grid 的 `grid-template-rows: 0fr → 1fr`（有兼容性风险）
- 推荐用 `max-height` + `opacity` 过渡，或 DOM scrollHeight + transition height

**2. 点击反馈**
- 小程序 `:active` 伪类不稳定
- 统一使用 `hover-class` + 纯 class 样式（不写 `:active`）

**3. 重新触发掉落动画**
- 给包裹标签的父 `<view>` 绑定 `:key="refreshId"`
- refreshId++ 时 Vue 销毁重建 DOM → 动画从头播放

**4. transition vs animation**
- 手指触发的即时反馈（缩放、旋转、变色）→ `transition`
- 不受手指控制物理反馈（标签弹性掉落）→ `@keyframes` + `animation`

---

## 六、Vue 2 + uni-app 迁移要点

1. **CSS**：@keyframes 在 uni-app 的 `<style>` 中直接写，微信小程序支持标准 CSS animation
2. **key 绑定**：用 Vue 的 `:key="tag + '-' + refreshId"` 强制重建 DOM，从头触发动画
3. **animationDelay**：在 computed 中预计算延迟值，内联绑定 `:style`
4. **点击反馈**：用 `hover-class` 代替 `:active` 伪类。在 `<view hover-class="press-class">` 上绑定，样式写为纯 class（不加 `:active`）
5. **transition vs animation**：手指触发的即时反馈用 `transition`；不受手指控制的物理回弹用 `@keyframes` + `animation`

---

## 七、注意事项

1. **小程序限制**：微信小程序支持 cubic-bezier，已在开发者工具中验证可用。
2. **刷新防抖**：`handleRefresh` 中用 `isRefreshing` 变量防止高频点击，动画期间（800ms）禁用按钮。
3. **性能**：16 个标签同时做 CSS 动画，纯 transform + opacity 动画由 GPU 合成，小程序性能无压力。
4. **标签池打乱**：每次 refreshId 递增后重新打乱切片，确保标签不会连续重复出现。
