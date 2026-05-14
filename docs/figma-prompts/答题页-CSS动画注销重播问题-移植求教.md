# 答题页 · CSS 动画"注销-重播"问题（双槽位 + 入场动画残留）移植求教

## 背景

我的答题页（Vue 2 + uni-app + 微信小程序）使用**双槽位（slot A / B）轮换**架构来实现题目切换的入场/离场过渡动画。

这一架构是在你之前"叠加窗口"建议下实现的——两套 DOM 同坑位并存，旧 DOM 离场 + 新 DOM 入场有 120ms 的叠加窗口。

**完整代码见附件 `answer-quiz.vue`**（附在当前消息中）。

---

## 问题描述

### 数据结构

```javascript
slots: {
  A: { visible: true,  phase: 'in',  q: { ...第一题内容 }, sel: -1, confirm: -1, dim: -1 },
  B: { visible: false, phase: '',    q: null,               sel: -1, confirm: -1, dim: -1 }
}
```

- **slot A 初始 `phase: 'in'`**，所以第一题一进来就有入场动画（`qIn` / `charDrop` / `oIn`）。
- 点击选项后（`pick()` 方法），时序如下：

| 时间点 | 操作 |
|--------|------|
| T+0ms | 选项选中态（`sel` / `confirm`）、波纹、flash、burst |
| T+420ms | `cur.phase = 'out'`（旧槽位开始离场动画），同时 `idx++` |
| T+520ms | 新槽位 `phase = 'in'`（新 DOM 进场） |
| T+720ms | 旧槽位 `visible = false`（销毁） |
| T+1170ms | 解锁 |

### CSS 动画绑定

```css
/* 入场 */
.card.in .q-txt      { animation: qIn 0.3s ease-out 0s both; }
.card.in .char-drop  { animation: charDrop 0.5s cubic-bezier(...) both; }
.card.in .o-inner    { animation: oIn 0.3s ease-out calc(var(--idx) * 0.06s) both; }

/* 离场 */
.card.out .q-txt     { animation: qOut 0.3s ease-out 0s both; }
.card.out .o-inner   { animation: oOut 0.3s ease-out calc(var(--idx) * 0.04s) both; }
```

### 核心矛盾

**第一题需要入场动画**，所以 slot A 初始时 `phase: 'in'`，`.card.in .q-txt` 等规则触发 `qIn` / `charDrop` / `oIn` 动画。

**当切换到第二题时**（T+420ms），执行：

```javascript
cur.phase = 'out'   // slot A 的 phase 从 'in' → 'out'
```

这一瞬间发生了以下事件序列：

1. `.card.in` 类被**移除** → `qIn` / `charDrop` / `oIn` 的 `animation-name` 被**注销**
2. `.card.out` 类被**添加** → `qOut` / `oOut` 的 `animation-name` 被**注册并启动**

**关键问题**：当 `qIn` 动画被注销时，CSS animation 管理系统会释放它占用的动画状态。在微信小程序的 WebView 渲染环境中，这个"注销"行为有时会触发一个**视觉上的重播现象**——即第一题的入场动画（`qIn` / `charDrop` / `oIn`）又被"闪"了一遍，然后才接上离场动画（`qOut` / `oOut`）。

### 为什么之前的尝试无效

**尝试方案**：先 `cur.phase = ''`，`$nextTick(() => cur.phase = 'out')`。

**为什么无效**：加一帧间隔并没有改变"注销-重播"的根本过程——在第一帧（phase = ''）中 `in` 类已经被移除，`qIn` 动画已经被释放了，第二帧再加 `out` 类只是启动了新的离场动画。

### 问题本质总结

```
CSS 动画的“注销-重播”行为：
  - 当 animation-name 从匹配 → 不匹配时，CSS 动画被移除
  - 如果移除时动画处于正在播放状态（未播完），部分渲染引擎会将其“视觉残留”重组为一次短闪/重播
  - 问题在微信小程序 WebView 中尤为明显

核心矛盾：
  需要第一题有入场动画（slot A 初始 phase: 'in'）
  ↔ 但第一题的入场动画在切题时（phase: 'in' → 'out'）会被"注销-重播"
  ↔ 这是 CSS animation 在 slot 复用 + 微信小程序 WebView 下的结构性矛盾
```

---

## 求教问题

### 问题 1：你认为这个"注销-重播"的根因是什么？

是以下哪种情况，还是另有原因？

- A. CSS animation 的 `animation-fill-mode: both` 导致中间态残留，渲染引擎在移除时尝试回退到初始态产生了闪烁
- B. 微信小程序 WXSS 的 animation 引擎在处理同类 `animation-name` 的移除/重载时存在 bug
- C. `will-change: transform, opacity` 让合成层在动画注销时重新布局导致
- D. 其他原因（请说明）

---

### 问题 2：你建议哪种解决方案？

以下是我想到的几个方向，请评估每个方案的可行性/优劣，并给出你的推荐：

#### 方案 A：第一题不走 CSS animation，用 JS 驱动首次入场

- 页面 `onReady` 后，第一题的 slot A 初始 `phase: ''`（无动画类）
- 用一个独立的 `firstEntry` 标记控制 JS 动画（通过 `uni.createAnimation` 或手动操作 `animation` 属性）来实现第一次入场
- 从第二题开始切题时才使用现有的 CSS 动画体系

**优点**：完全不触发 CSS animation 的注销问题
**缺点**：需要额外写一套 JS 动画逻辑；首次入场和后续入场的视觉效果可能不一致

你推荐这个方案吗？如果不推荐，为什么？

---

#### 方案 B：第一题用独立的单槽位，不参与双槽轮换

- 第一题使用独立的 DOM（不使用 slot A/B 体系），手动控制入场动画
- 从第二题开始才切换到双槽位切换
- 或者：初始时两个 slot 都设为 `visible: false`，第一题用一个独立的 `.first-card` DOM 渲染
- 切到第二题时，直接销毁 `.first-card`，激活 slot A 作为"旧卡"（离场态）+ slot B 作为"新卡"（入场态）

**优点**：彻底隔离第一题的动画生命周期，后续切换不受影响
**缺点**：DOM 结构复杂度增加；需要额外处理第一题到第二题之间的过渡

你推荐这个方案吗？你有更好的实现方式吗？

---

#### 方案 C：切题时直接 v-if 销毁旧 DOM，放弃叠加过渡

- 切题时不经过 `phase: 'in' → 'out'` 的过渡状态
- 直接把旧槽位 `visible = false`（销毁），同时设置新槽位 `visible = true`
- 移除所有离场动画（`qOut` / `oOut`），只保留入场动画

**优点**：彻底消灭"注销-重播"的触发条件
**缺点**：失去了离场动画，切题过渡变生硬；用户反馈可能不好

你推荐牺牲离场动画来根治这个问题吗？有没有不需要牺牲离场动画的妥协方案？

---

#### 方案 D：用 setTimeout 手动管理动画播放，完全弃用 CSS animation

- 不使用 CSS `animation` 属性，全部改用 `transition` + JS 时序操控样式
- 入场效果通过逐帧调整 `opacity` 和 `transform` 的值来实现
- 或使用 WeChat 小程序的 `wx.createAnimation` API

**优点**：完全绕过 CSS animation 引擎的注销问题
**缺点**：实现复杂；需要管理大量 JS 动画状态；性能不如原生 CSS animation

你推荐这个方案吗？是否有更轻量的 JS 动画替代方案？

---

#### 方案 E：修改 slot A 的初始 phase，让它不设 `in`

- slot A 初始 `phase: ''`，不带任何动画类
- 等页面 `onReady` 后，用一个 `created` 钩子延迟 `this.slots.A.phase = 'in'`
- 靠 `animation-fill-mode: both` + 该次 `in` 类的添加来触发入场动画
- 切题时，因为 `phase` 是从 `''` 跳到 `'out'`（不是从 `'in'` 跳到 `'out'`），`in` 相关动画不存在注销问题

**问题**：第二次（切题时）把 `phase: ''` 设为 `'out'` 不会触发注销，但**第三次操作时旧卡又回到了 `phase: 'in' → 'out'` 的切换路径**，问题复现。

你同意这个分析吗？这个方案是否只骗过了第一次，没有根除问题？

---

### 问题 3：是否有其他我没想到的方案？

如果你有更好的根治思路，请直接描述。**不需要考虑实现难度，我们只关心可不可行。**

---

### 问题 4：如果必须绕开这个问题，你认为小程序中最可靠的动画切换范式是什么？

在微信小程序环境下，考虑以下限制：

- DOM 复用容易触发 CSS animation 注销问题
- `:key` 在小程序 Vue 2 下不触发 DOM 重建
- `@animationend` 事件在小程序上不可靠（部分基础库版本缺失）
- WXSS 不支持 `animation-play-state`

在这个受限环境下，要实现平滑的"入场 + 离场"过渡，你认为最可靠的底层范式是什么？

---

## 附：当前 answer-quiz.vue 完整代码

请查看我附在消息中的 `answer-quiz.vue` 完整文件。

关键部分：

1. **模板**（第 54–111 行）：双槽位 A/B，`<block v-for="slot in ['A', 'B']" :key="slot">`
2. **pick() 方法**（第 219–303 行）：完整的时间线控制
3. **CSS 入场动画**（第 721–730 行）：`.card.in .q-txt`、`.card.in .char-drop`、`.card.in .o-inner`
4. **CSS 离场动画**（第 733–738 行）：`.card.out .q-txt`、`.card.out .o-inner`
5. **slot 初始化**（第 174–177 行）：`A: { visible: true, phase: 'in', ... }`

---

## 回复格式要求

请逐条回答以上 4 个问题。每个方案请给出：

1. **可行性评估**（可行 / 有条件可行 / 不可行）
2. **推荐度**（推荐 / 备选 / 不推荐）
3. **风险提示**（如果这样做了可能带来的副作用）
4. **如果推荐，请给出关键代码片段**（不需要完整文件，关键 10–20 行即可）

如果以上所有方案你都不满意，请直接告诉我**你觉得应该怎么做**——不需要受限于我列出的选项。

---

*本文档由张渊（CodeBuddy AI）撰写，基于 Vue 2 + uni-app + 微信小程序实际排查。*


# 回复
问题 1：根因到底是什么
不是 A/B/C 任何一个，准确答案是 D — 选择器冲突 + fill-mode 释放：

.card.in  .q-txt { animation: qIn  ... both; }
.card.out .q-txt { animation: qOut ... both; }
当 .in → .out 同帧切换时，对 .q-txt 这个元素来说：

animation-name 从 qIn（已经播完，fill-mode:both 把 100% 帧定格在元素上）→ qOut
mp-weixin 的 webview 在 style 重算时把这次变化处理为"先释放 qIn 的 fill 定格 → 再启动 qOut"
释放 qIn 定格的那一瞬间，元素回到无动画的裸基线（即元素的初始 layout 值，等价于 qIn 的 0% 帧）
然后 qOut 从 qOut 的 0% 帧（≈ 元素终态）开始播
所以你看到的不是"qIn 重播"，是 qIn fill 状态被释放瞬间露出了 qIn 的 0% 帧（translateY+opacity:0），紧接着 qOut 才接上。视觉上像闪了一下入场动画。

will-change 不是元凶，去掉也没用。这是 fill-mode:both + 同元素 animation-name 切换的结构性问题。

问题 2 / 3：推荐方案（你 5 个之外的第 6 个）
✅ 方案 F · 引入 entered 中间态（强烈推荐）
核心思想：永远不让 .in 和 .out 直接相邻切换。入场动画播完后，先回到一个"裸态"entered，CSS 里此态没有任何 animation 规则，元素靠自然布局值（opacity:1, transform:none）静止。点击离场时是 entered → out，没有 fill-mode 释放、没有 0% 帧露馅。

| 推荐度 | 推荐 ⭐ | | 可行性 | 完全可行 | | 风险 | 极低 — 仅需新增一个 phase 值和 1 个 setTimeout | | 改动量 | < 20 行 |

关键代码
data：

slots: {
  A: { visible: true, phase: 'in', ... },  // 初始仍是 in，第一题需要入场
  B: { visible: false, phase: '', ... }
}
入场完成后回到 entered（最长入场时长 = qIn 300ms + 最末字 charDrop 延迟 + 500ms，约 800ms 起步，保险给 850ms）：

// 在 onReady 里，针对 slot A 的第一题
setTimeout(() => {
  if (this.slots.A.phase === 'in') this.slots.A.phase = 'entered';
}, 850);
切题时序改造（pick 方法内）：

// 当前激活槽位
const cur = this.slots[this.activeSlot];
const nxt = this.slots[this.activeSlot === 'A' ? 'B' : 'A'];

// T+420ms：旧卡离场
setTimeout(() => {
  cur.phase = 'out';        // entered → out（不是 in → out！）
}, 420);

// T+520ms：新卡入场
setTimeout(() => {
  nxt.q = nextQuestion;
  nxt.visible = true;
  nxt.phase = 'in';
}, 520);

// T+520 + 850ms = T+1370ms：新卡也回到 entered
setTimeout(() => {
  nxt.phase = 'entered';
}, 1370);

// T+720ms：旧卡销毁
setTimeout(() => {
  cur.visible = false;
  cur.phase = '';
}, 720);
CSS 增量（只需加一条，告诉 .card.entered 什么都不做）：

/* 入场态 */
.card.in  .q-txt    { animation: qIn  .3s ease-out 0s both; }
.card.in  .char-drop{ animation: charDrop .5s cubic-bezier(.34,1.4,.64,1) both; }
.card.in  .o-inner  { animation: oIn  .3s ease-out calc(var(--idx)*.06s) both; }

/* 静止态：不写 animation，元素自然处于终态（opacity:1, transform:none） */
.card.entered .q-txt,
.card.entered .char-drop,
.card.entered .o-inner { /* 故意空 */ }

/* 离场态 */
.card.out .q-txt   { animation: qOut .3s ease-out 0s both; }
.card.out .o-inner { animation: oOut .3s ease-out calc(var(--idx)*.04s) both; }
关键约束：

入场动画的终态必须与裸基线 CSS 一致（即 100% 帧是 opacity:1, transform:none, filter:none）。这一点你的 qIn / charDrop / oIn 都已经满足，无需改。
entered 态下没有 fill-mode 在维持任何 transform —— 元素就是它本来的样子，不会闪。
对其他方案的快速评估
方案	可行性	推荐度	一句话
A 首题 JS 驱动	可行	不推荐	视觉一致性差，引入双逻辑
B 首题独立单槽	可行	不推荐	DOM 复杂度暴涨，治标
C 放弃离场	可行	不推荐	损失交互手感，太亏
D 全 JS 动画	可行	不推荐	性能 + 复杂度都不划算
E 首题 phase:''	部分可行	不推荐	你自己的分析正确——只骗了第一次
F entered 中间态	完全可行	强烈推荐	5 行 CSS + 1 个 setTimeout 根治
问题 4：小程序最可靠的切换范式
经过这一轮，我把它精炼成三条铁律：

每个动画元素的生命周期是三段式 in → entered → out，永远不要让带 animation 的两个类直接相邻。
entered 态不写任何 animation 规则，让元素自然停在裸基线 CSS 值上（这要求入场动画的 100% 帧必须与裸值一致）。
双槽位 + t0 锚点 setTimeout 编排：A、B 两块 DOM 各自走自己的三段式，互不干扰；时序用一个 t0 = Date.now() 辐射式 setTimeout，避免嵌套累加误差。
满足这三条，CSS animation 在 mp-weixin 上就稳了。@animationend、animation-play-state、:key-driven 重建 这些不可靠 API 都不需要。