# 已知问题记录

> 本文件用于记录项目中尚未解决或无法解决的已知问题，方便后续排查和处理。

---

## 1. Fork谱系图 - Canvas 渲染层滚动穿透

**涉及页面：** `pages-tools/survey-stats/survey-stats.vue`

### 问题描述

页面滚动后，Canvas `type="2d"` 绘制的内容会"穿透"容器边界，显示在容器外部（如覆盖到"答题者地区分布"区域）。点击画布后恢复正常。

### 原因分析

微信小程序中 `type="2d"` Canvas 使用独立的渲染层（GPU 合成层）。当外层 `<scroll-view>` 滚动时，Canvas 的 DOM 位置跟随滚动，但其 GPU 渲染层不会同步更新位置，导致绘制内容出现在错误的位置。

### 尝试过的修复方案

| 方案 | 结果 |
|------|------|
| `overflow: hidden` + `transform: translateZ(0)` | 无效 |
| `clip-path: inset(0)` | 无效 |
| `will-change: transform` | 无效 |
| 滚动时 `hidden` + 停止后重绘 | 无效 |
| Canvas `position: absolute` | 无效 |

### 建议修复方向

**方向一：改用 `wx.createCanvasContext`（旧版 API）**

不使用 `type="2d"`，改用微信旧版 Canvas API（`wx.createCanvasContext`）。旧版 API 不会创建独立渲染层，可以跟随 DOM 正常滚动。

```
// 替换
<canvas canvas-id="forkTreeCanvas" style="width:...; height:..."></canvas>
// 使用 wx.createCanvasContext('forkTreeCanvas')
```

缺点：旧版 API 功能受限（不支持 `getContext('2d')`），但绘制圆角矩形和文字足够。

**方向二：使用 `<movable-view>` 替代手势**

使用微信小程序的 `<movable-view>` 标签来做平移和缩放，把 Canvas 放在 movable-view 内部。

缺点：需要完全重构交互逻辑。

**方向三：关闭滚动穿透修复**

接受问题，改为在页面初始化时固定画布位置，让用户通过画布内置的 scroll 而不是页面 scroll 来查看下方内容。

---

## 2. 问卷历史版本漂移问题（surveySnapshot 快照机制）

**涉及页面：**
- `pages-tools/workbench/workbench.vue`（问卷编辑）
- `pages-tools/survey-edit/survey-edit.vue`（问卷详情编辑）
- `pages-tools/history-survey/history-survey.vue`（历史答卷查看 &「魔改」）

**涉及云函数：** `uniCloud-alipay/cloudfunctions/tools/index.obj.js`

### 问题描述

出题者创建问卷并发布后，答题者作答并提交。此后如果出题者**修改了原始问卷**（增删题目、修改维度、修改题目标题/选项等），答题者在查看自己的历史作答记录时，看到的问卷内容将是**修改后的最新版本**，而非自己当时作答的版本。

这导致：
1. 答题历史记录无法还原当时的答题上下文
2. 「魔改」功能（基于历史答卷重新生成新问卷）拿到的问卷结构是「当前版」而非「历史版」，生成结果可能不正确

### 解决方案：surveySnapshot 快照机制

在答题者提交答案时，将当时的完整问卷结构（title、desc、dimensions、resultTypes、questions、visibleDimensions、tags 等）**深拷贝并嵌入 `survey-answers` 表**，与答题数据一起保存。

**核心代码位置：** `index.obj.js` 的 `submitSurveyAnswer` 函数中，在 `db.collection('survey-answers').add(...)` 之前通过 `surveySnapshot` 字段保存快照。

### 相关需求

- 【×】历史答题记录的显示应始终基于快照数据，而非实时联表查询 `surveys` 表
- 【×】「魔改」功能必须基于快照内容生成新问卷
- 【×】所有涉及历史问卷展示的地方，优先使用 `surveySnapshot`，只有快照不存在时降级到实时查询

### 测试方法

#### 方法一：双账号测试（完整流程）

**前置条件：** 云函数已重新部署

**Step 1 - 出题者A 创建问卷并让 B 作答**
1. A 登录 → 工作台 → 新建问卷（标题如「性格测试V1」，添加 3 道题）
2. A 保存并发布 → **记下 `surveyId`**
3. A 分享给 B（或将 surveyId 发给 B）
4. B 登录 → 打开该问卷并作答 → 提交

**Step 2 - 出题者A 修改原始问卷**
1. A 回到工作台 → 找到刚才的问卷 → 编辑
2. 做肉眼可辨的改动：修改标题为「性格测试V2」、增删题目、修改维度等
3. 保存

**Step 3 - 答题者B 验证快照生效**
1. B 登录 → 「答题记录」→ 找到那条记录 → 点击「问卷魔改」
2. 观察魔改后的内容
3. **预期结果：** 魔改内容 = B 答题时的版本（V1），而非 A 修改后的版本（V2）

#### 方法二：直接篡改数据库（单账号快速验证）

1. 用自己账号创建问卷 → 自己答一遍
2. 在 HBuilderX → uniCloud → web 控制台 → 数据管理，打开 `surveys` 表
3. 手动修改 `title` 和 `questions` 数组（增删改）
4. 回到小程序 → 答题记录 → 魔改该问卷
5. **预期结果：** 魔改内容仍是修改前的版本（快照），而非手动篡改后的内容

#### 方法三：数据库直查快照内容（最快）

在 `survey-answers` 表中找到记录，展开 `surveySnapshot` 字段，确认包含：
```json
{
  "title": "性格测试V1",
  "desc": "...",
  "dimensions": [...],
  "resultTypes": [...],
  "questions": [...]
}
```

同时检查 `surveys` 表对应记录标题是否已变为「性格测试V2」。如两者不同则说明快照机制生效。

### 验证失败排查

| 现象 | 原因 | 对策 |
|------|------|------|
| 魔改出来还是新版内容 | `surveySnapshot` 为空 | 检查提交时 snapshot 是否写入成功（数据库里看） |
| 魔改后问卷内容奇怪 | 快照里缺了字段（如 `resultTypes`） | 检查 snapshot 保存了哪些字段，补全缺失字段 |
| 历史记录看不到「魔改」按钮 | 列表数据中 `surveySnapshot` 字段未回传 | 确认云函数已重新部署 |
| HBuilderX 修改 .vue 文件后模拟器不刷新 | 微信开发者工具热更新缓存 bug | 停止运行 → 删除 `unpackage` 文件夹 → 重新运行 |
