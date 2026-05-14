# 答题页 · 重设计完整移植指南 Prompt

> 本文档是为 Figma AI 编写的指令，要求其根据已完成的答题页重设计，生成一份**可供另一个 AI 直接读取并执行的移植指南**。
>
> 目标接收方：负责代码实现的 AI（熟悉 Vue 2 + uni-app + 微信小程序 + rpx 体系）。
>
> **要求**：移植指南必须精确到每一个像素（rpx），不允许出现"大概"、"稍微"、"根据实际情况调整"等模糊表述。

---

## 指令

你面前有一个 Figma 文件，其中包含了答题页（answer-quiz）的完整重设计。页面上所有元素已经按照最终设计稿摆放完毕。

你的任务是：**逐帧逐像素地分析这个页面，输出一份完整的移植指南**，让另一个 AI 仅凭你的输出就能将设计一比一移植到 Vue 2 + uni-app 微信小程序中。

---

## 输出格式要求

请严格按照以下章节结构输出，每个小节都必须包含你从 Figma 中读取到的**精确值**。

---

### 第 1 章 · 页面总览

| 项目 | 值 |
|------|-----|
| 页面背景色 | 精确 hex |
| 页面最小高度 | 100vh |
| 字体基准 | 按设计稿的唯一字体 |
| 整体安全区 | 顶部胶囊避让高度（预估最小值） |

---

### 第 2 章 · DOM 结构树

用精确的层级缩进展示页面的节点树，例如：

```
.page (根容器, flex column, min-height: 100vh)
├── .hd (顶部区域)
│   ├── .hd-row1
│   │   ├── .hd-back (返回按钮)
│   │   └── .hd-tag (标签名)
│   ├── .hd-row2
│   │   ├── .hd-step (题号)
│   │   └── .hd-motto (slogan)
│   └── .hd-bar (进度条背景)
│       └── .hd-fill (进度条填充)
├── .stage (卡片容器, position: relative, flex: 1)
│   ├── .card (slot A)
│   │   ├── .q-wrap (题目容器, flex居中)
│   │   │   └── .q-txt (题目文字)
│   │   └── .opts (选项容器)
│   │       ├── .o-wrap × N (选项外层, hover-class容器)
│   │       │   └── .o-inner (选项内层, 动画容器)
│   │       │       └── .o-txt (选项文字)
│   └── .card (slot B)
│       └── …同 A
└── .retry-layer (加载/重试层, 只在loading时显示)
```

**对于每个节点，列出**：该节点在 Figma 中的：
- 宽/高（px → 换算为 rpx，设计稿宽度为 375px 即 750rpx）
- padding（上右下左）
- margin（上右下左）
- 定位方式
- 层级（z-index）

---

### 第 3 章 · 色彩系统

列出页面上出现的**每一种颜色**及其**用途**，包括但不限于：

| 颜色名称 | Hex | 用于 |
|----------|-----|------|
| 页面背景 | #xxxxxx | .page background |
| 返回按钮背景 | #xxxxxx | .hd-back background |
| 返回按钮阴影 | #xxxxxx | .hd-back box-shadow |
| 标签文字 | #xxxxxx | .hd-tag color |
| 题号文字 | #xxxxxx | .hd-step color |
| slogan文字 | #xxxxxx | .hd-motto color |
| 进度条背景 | #xxxxxx | .hd-bar background |
| 进度条填充 | #xxxxxx | .hd-fill background |
| 题目文字 | #xxxxxx | .q-txt color |
| 选项默认背景 | #xxxxxx | .o-inner (默认态) background |
| 选项默认边框 | #xxxxxx | .o-inner (默认态) border-color |
| 选项默认文字 | #xxxxxx | .o-txt (默认态) color |
| 选项选中背景 | #xxxxxx | .o-on background |
| 选项选中边框 | #xxxxxx | .o-on border-color |
| 选项选中文字 | #xxxxxx | .o-on .o-txt color |
| 加载提示文字 | #xxxxxx | .retry-text color |
| 重试按钮文字 | #xxxxxx | .retry-btn-text color |

**如果设计稿中有渐变（gradient）或叠加（overlay），逐个列出渐变方向和色标。**

---

### 第 4 章 · 尺寸 & 间距（rpx）

按设计稿 375px 宽度基准，将所有 px 值换算为 rpx。

#### 4.1 顶部区域 (.hd)

| 属性 | 值 (rpx) |
|------|-----------|
| paddingTop | |
| paddingRight | |
| paddingLeft | |
| hd-row1 内 gap | |
| hd-row2 内间距 | |
| hd-row2 marginBottom | |
| 进度条高度 | |
| 进度条圆角 | |

#### 4.2 返回按钮

| 属性 | 值 (rpx) |
|------|-----------|
| 宽/高 | |
| 圆角 | |
| 阴影参数 (完整 box-shadow) | |
| 内部文字/图标大小 | |

#### 4.3 题目区域 (.q-wrap)

| 属性 | 值 (rpx) |
|------|-----------|
| paddingLeft/Right | |
| 题目字号 | |
| 行高 | |
| 字间距 (letter-spacing) | |
| 字体粗细 (font-weight) | |

#### 4.4 选项区域 (.opts)

| 属性 | 值 (rpx) |
|------|-----------|
| paddingLeft/Right | |
| paddingBottom | |

#### 4.5 单个选项 (.o-inner)

| 属性 | 值 (rpx) |
|------|-----------|
| 高度 | |
| 圆角 | |
| 边框宽度 | |
| 边框颜色 (hex) | |
| 选项间 gap/marginBottom | |
| 文字字号 | |
| 文字粗细 | |

#### 4.6 加载/重试层

| 属性 | 值 (rpx) |
|------|-----------|
| icon 字号 | |
| 提示文字字号 | |
| 按钮 padding | |
| 按钮圆角 | |
| 按钮阴影 | |

---

### 第 5 章 · 动画系统

#### 5.1 进场动画 (题目切换时新卡入场)

逐项列出元素、参数时间线和持续时间：

##### 新题目文字 .q-txt

| 参数 | 值 |
|------|-----|
| keyframes 名称 | qIn |
| 0% transform | |
| 0% opacity | |
| 100% transform | |
| 100% opacity | |
| animation-duration | |
| animation-timing-function | 精确 cubic-bezier |
| animation-delay | |
| animation-fill-mode | |

##### 新选项 .o-inner （逐项）

| 参数 | 值 |
|------|-----|
| keyframes 名称 | oIn |
| 0% transform | |
| 0% opacity | |
| 100% transform | |
| 100% opacity | |
| animation-duration | |
| animation-timing-function | 精确 cubic-bezier |
| animation-delay | 第 1 项 / 第 2 项 / 第 3 项 / 第 4 项 |
| animation-fill-mode | |

#### 5.2 离场动画 (选中后旧卡退场)

##### 旧题目文字 .q-txt

| 参数 | 值 |
|------|-----|
| keyframes 名称 | qOut |
| 0% transform | |
| 0% opacity | |
| 100% transform | |
| 100% opacity | |
| animation-duration | |
| animation-timing-function | |

##### 旧选项 .o-inner

| 参数 | 值 |
|------|-----|
| keyframes 名称 | oOut |
| 0% transform | |
| 0% opacity | |
| 100% transform | |
| 100% opacity | |
| animation-duration | |
| animation-timing-function | |
| animation-delay 步进 | 每项增加多少秒 |

#### 5.3 交互反馈动画

##### 按压反馈 (hover-class)

| 参数 | 值 |
|------|-----|
| 按压缩放 | scale(?) |
| 按压塌陷耗时 | |
| 按压塌陷曲线 | |
| 松手回弹耗时 | |
| 松手回弹曲线 | |

##### 选中确认弹跳 (.o-confirm)

| 参数 | 值 |
|------|-----|
| keyframes 名称 | confirmPop |
| 0% scale | |
| 中间帧 scale | 在百分之多少处？值？ |
| 100% scale | |
| animation-duration | |
| animation-timing-function | |
| 生效时机 | 点击选中后持续多长时间后移除 |

##### 颜色/边框过渡

| 参数 | 值 |
|------|-----|
| transition-property | |
| transition-duration | |
| transition-timing-function | |

#### 5.4 进度条动画

| 参数 | 值 |
|------|-----|
| transition-property | |
| transition-duration | |
| transition-timing-function | |

#### 5.5 整体切题时序（精确到 ms）

按时间线列出所有事件的触发时刻：

| 时间点 | 事件 |
|--------|------|
| T+0ms | 用户点击选项 |
| T+?ms | 选中态颜色/边框变化完成 |
| T+?ms | confirmPop 弹跳动画完成 |
| T+?ms | 选中态保持结束，旧卡进入离场态（phase='out'） |
| T+?ms | 新卡插入 DOM，进入入场态（phase='in'），叠加窗口开始 |
| T+?ms | 旧卡离场动画结束，旧卡 DOM 销毁（visible=false） |
| T+?ms | 新卡入场动画全部完成（包括选项阶梯延迟最晚一项） |
| T+?ms | 解锁（locked=false），允许下一次点击 |
| **总耗时** | **从点击到完全就绪** |

---

### 第 6 章 · 特殊细节

如果设计稿中存在以下元素，请单独列出：

1. **分割线或装饰元素** —— 位置、粗细、颜色、长度、是否圆角
2. **角标或提示图标** —— 位置、大小、颜色、内容
3. **阴影系统** —— 页面上所有使用了 box-shadow 的元素，逐项列出完整值
4. **背景纹理或图案** —— 是否有 background-image、渐变叠加、杂点纹理
5. **选项左侧的序号/图标** —— 是否存在类似"A/B/C"的标识，样式如何
6. **emoji 大小** —— 如果选项文字中包含 emoji，其字号是否与文字一致
7. **题目中的高亮/强调文字** —— 是否有加粗/变色/下划线等特殊处理
8. **loading 状态** —— 是否有骨架屏或自定义 loading 动画替代当前简单文字
9. **错误状态** —— 网络错误时的 UI 是否与当前保持一致，有否调整
10. **返回确认** —— 点击返回按钮是否有弹窗确认或 toast 提示

---

### 第 7 章 · 双槽位切题机制说明

因为使用 Vue 2 + uni-app 微信小程序，页面采用**双槽位（A/B slot）**模型来实现叠加切换动画：

- 两个 `.card` 容器：`slot A` 和 `slot B`
- 同一时间只有**一个正在交互**（允许点击）
- 旧卡进入离场态 → 100ms 后新卡插入并进入入场态 → 两卡叠加约 120ms → 旧卡销毁
- 每个 slot 的数据结构如下，请确认设计稿中是否有需要额外增加的字段：

```js
slots: {
  A: { visible: false, phase: 'in', q: null, sel: -1, confirm: -1 },
  B: { visible: false, phase: 'in', q: null, sel: -1, confirm: -1 }
}
```

---

### 第 8 章 · 现有代码与设计稿的差异清单

最后，逐条列出当前代码版本与 Figma 新设计之间**所有可见差异**，哪怕是一个像素的偏移。格式：

| 序号 | 元素 | 当前代码值 | 设计稿值 | 修改优先级 |
|------|------|-----------|----------|-----------|
| 1 | 页面背景色 | #F7F8FA | #xxxxxx | 高 |
| … | … | … | … | … |

修改优先级说明：
- **高**：用户一眼能看到的差异（颜色、大小、布局）
- **中**：需要仔细对比才能发现的差异（间距、阴影、动画曲线）
- **低**：极细微的调整（0.5px 级别、动画 delay 微调）

**差异清单请力求完整**，因为这是另一个 AI 执行移植时的直接操作清单。

---

## 输出质量要求

1. **不允许省略**：如果某个元素在 Figma 中你的工具无法读取到精确值，请输出 "Figma 数据中无此值" 而不是忽略。
2. **不允许模糊**：所有数值精确到小数点后一位 rpx、颜色精确到六位 hex。
3. **动画务必精确到 ms**：duration、delay 统一用秒（s）和毫秒（ms）混写也可以，但不允许四舍五入。
4. **如果某一章在你的设计中没有对应内容**，请输出 "此章无对应内容" 而不是删除章节标题。

---

准备完毕就可以输出移植指南了。

