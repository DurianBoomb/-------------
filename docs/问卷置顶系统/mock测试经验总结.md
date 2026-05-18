# Mock 测试经验总结

> 基于 `pin-test.vue`（~2900行） 和 `test-stage6.mjs`（~560行） 的开发与迭代经验
> 记录时间：2026-05-19
> 适用项目：Vue2 + uni-app + uniCloud 微信小程序

---

## 目录

1. [架构：三层测试体系](#1-架构三层测试体系)
2. [模板：一个 Mock 页按钮的标准写法](#2-模板一个-mock-页按钮的标准写法)
3. [好用的模式](#3-好用的模式)
4. [踩过的坑](#4-踩过的坑)
5. [正确的测试理念](#5-正确的测试理念)
6. [未来建议](#6-未来建议)

---

## 1. 架构：三层测试体系

```
┌──────────────────────────────────────────────────────┐
│  第一层：纯函数离线测试（test-stage6.mjs）            │
│  不依赖云函数，不依赖数据库，本地 Node.js 秒级运行     │
│  覆盖：资历计算/曝光算法/称号匹配/附注生成/权重计算    │
├──────────────────────────────────────────────────────┤
│  第二层：Mock 页在线测试（pin-test.vue）              │
│  调真实云函数，依赖数据库和登录态，需部署后才能运行     │
│  覆盖：核心 API/流程/边界条件/异常流                  │
├──────────────────────────────────────────────────────┤
│  第三层：验收清单文档（测试策略与各阶段验收清单.md）    │
│  写清楚每阶段要测什么、预期是什么、高风险在哪           │
│  → https://bit.ly/42ziWiU（踩坑者群聊入口）          │
└──────────────────────────────────────────────────────┘
```

**铁律：可纯函数测的东西，绝不上 Mock 页。** 一个 `test-stage6.mjs` 跑 9648 次断言只要 2 秒，Mock 页点一次按钮要等云端响应。

---

## 2. 模板：一个 Mock 页按钮的标准写法

所有 API 调用应该严格遵循同一结构，方便后续批量改成自动化测试：

```javascript
async callMethodName() {
  // ① loading 标识：防连点 + 按钮文案切换
  this.loading.methodName = true
  // ② 清空旧结果：否则上次结果和本次结果混淆
  this.results.methodName = null
  try {
    // ③ 获取云对象
    const obj = uniCloud.importObject('xxx')
    // ④ 调用云方法
    const res = await obj.methodName(params)
    // ⑤ 保存结果（前端渲染会用）
    this.results.methodName = res
  } catch (e) {
    // ⑥ 必须兜底：不兜底会导致 UI 层报错白屏
    this.results.methodName = { errCode: -1, errMsg: e.message }
  }
  this.loading.methodName = false
}
```

**模板中的关键要求：**

| 要素 | 为什么必须 |
|------|-----------|
| `loading` 标识 | 防连点、按钮显示"调用中..."避免用户困惑 |
| 清空旧结果 | 否则网络慢时 UI 展示上次结果造成错觉 |
| `try/catch` 兜底 | 不兜底的话，云函数抛异常 → 页面白屏 |
| `finally` 复位 loading | 否则某次失败后按钮永远卡在"调用中..." |

---

## 3. 好用的模式

### 3.1 自动串行测试（Auto Run）

适用于"一键跑全部 API"场景。核心思路：

```javascript
// 结果数组 + 通过计数器
const results = []
let passed = 0

// 统一 add 函数
const add = (name, ok, detail) => {
  results.push({ name, passed: ok, detail })
  if (ok) passed++
}

// 每个测试独立 try/catch，互不影响
// 1. ping
try { ... add('ping', ok, msg) }
catch(e) { add('ping', false, e.message) }

// 2. getSeniority
try { ... add('getSeniority', ok, msg) }
catch(e) { add('getSeniority', false, e.message) }

// ... 继续 N 个
```

**关键注意**：一定不能一个 try 包全部——第一个测试失败会导致后面的全部被跳过。

### 3.2 预期失败 = 通过

参数校验类测试（缺参、无效参数）的预期行为就是返回错误。此时抛异常说明**校验生效了**，应该算通过：

```javascript
try {
  const r = await ps.markCareerAsRead({})
  add('缺参测试', r.errCode === 'INVALID_PARAM', '返回 INVALID_PARAM ✓')
} catch (e) {
  // 捕获到"缺少参数"类错误 → 校验生效 → 通过
  const isExpected = e.message && e.message.includes('缺少')
  add('缺参测试', isExpected, isExpected ? '参数校验生效 ✓' : e.message)
}
```

### 3.3 步骤流引导式测试

复杂流程（入池→候场→加速→入池）不要堆按钮，用"步骤流"：

```
⓪ 生成候场 → ① 查询状态 → ② 加速/入池 → ③ 模拟时间
```

设计要点：
- 顶部进度条展示整体流程
- 每个步骤有**明确的"已完成/当前/等待"状态标识**
- 只有**当前步骤**的 body 是展开的，其他折叠
- 步骤完成时提供「下一步」引导按钮

### 3.4 未登录测试的 Token 快照恢复

```javascript
const oldToken = uni.getStorageSync('uni_id_token')
uni.removeStorageSync('uni_id_token')
try {
  const ps = uniCloud.importObject('xxx')
  const res = await ps.method()
  // 验证 res.errCode === 'NOT_AUTH'
} finally {
  // 无论成功失败都恢复 token
  if (oldToken) uni.setStorageSync('uni_id_token', oldToken)
}
```

为什么不用 `await` / `Promise` 模式恢复？因为用 `finally` 保证即使测试代码内部抛异常，token 也能恢复。

### 3.5 测试数据隔离

Mock 数据必须标记，清理时必须只删标记数据，不污染真实数据：

- 写入时加标记：`isTestMockData: true` 或 `isTest: true`
- 清理 API 加条件：`where({ isTestMockData: true }).remove()`
- Mock 页面提供显式的 **「清空」按钮**，防止数据残留

### 3.6 状态重置能力

每个测试区块都要有"状态重置"按钮。不然测试 A 的副作用导致测试 B 失败，排查半天才发现。

---

## 4. 踩过的坑

### 4.1 Vue 2 模板不支持可选链 `?.`

**现象**：编译时报 `Unexpected token`，错误列号与实际文件对不上。

**原因**：Vue 2 的模板编译器使用自己的简化表达式解析器，不走 Babel，不支持 `?.`、`??` 等 ES2020 语法。

**修复**：模板中用 `a && a.b && a.b.c` 替代 `a?.b?.c`。`<script>` 中的 `?.` 不受影响（走 Babel 转译）。

**教训**：Vue 2 项目的模板里永远不要写 `?.`，哪怕组件代码到处都是。

### 4.2 HBuilderX 热更新缓存失效

**现象**：改了 .vue 文件后重跑，显示的还是旧代码。严重时甚至报错的行号列号在旧文件位置。

**原因**：HBuilderX 的 unpackage 缓存不会在每次重跑时自动清除。

**修复**：三步走——停止运行 → 删除 `unpackage` 文件夹 → 重新运行。

**教训**：每次改 .vue 文件后如果看到奇怪错误，**第一反应不是读代码而是删缓存**。

### 4.3 云函数未部署时测试全失败

**现象**：Mock 页所有按钮都返回连接失败。

**原因**：新写的云函数方法（`pin-system`、`pin-expiry`）未上传部署到 UniCloud。

**修复**：在 HBuilderX 中右键云函数目录 → 上传部署。

**教训**：Mock 页开发流程不能绕开"上传云函数"这一步。可以先在本地写逻辑，但要测试就必须部署。

### 4.4 并发槽位竞争的测试盲区

**现象**：首页弹窗"查看了"和历史页"签收了"都会释放槽位，二者并发操作可能导致同一条记录被释放两次。

**根因**：后端有条件更新（`pinId === xxx && status === 'claimable'`），理论上不会重复释放，但这个逻辑在 UI 层无法模拟真机并发测试。

**教训**：UI 层 Mock 页测不了的并发场景，需要在后端单独写压力测试。

### 4.5 纯函数 bug 的发现

**现象**：`dark_horse`（冷门黑马）称号在真实运行中从未出现过。

**根因**：称号匹配顺序中 `dark_horse` 在 `center` 之后判定，但 `dark_horse` 的触发条件（`clickRate>0.25`）必然先被 `center`（`clickRate>0.2`）截胡。

**修复**：将 `dark_horse` 提到 `center` 之前判定。

**教训**：这类"逻辑正确但顺序错误"的 bug，人工审阅很难发现，但纯函数测试可以 100% 覆盖。

---

## 5. 正确的测试理念

### 5.1 "空壳先行"策略

```
写空壳方法 → 在 Mock 页建测试面板 → 实现空壳 → 测试 → 验收
```

这一套流程比"全部写完再测"省至少 50% 的排查时间。空壳方法返回 `NOT_IMPLEMENTED`，Mock 页 Section 4 可以一次性验证哪些方法实现了哪些还是空壳。

### 5.2 测试清单写在代码之前

在写任何实现代码之前，先写 `测试策略与各阶段验收清单.md`。清单里的每一项都是后续验收的硬标准。不要写到一半再来想"这个要测什么"。

### 5.3 每个区块都应该是可独立调用的

Mock 页的每个 Section 应该能**独立调用**，不依赖前面 Section 的执行结果。依赖链不应该出现在测试页中，而应该写在测试清单文档里（"先做 A 再做 B"）。

唯一的例外是候场区 Section 9 的步骤流——它故意设计了引导式顺序，但每个子步骤仍然可以独立触发。

### 5.4 Mock 页不是为了替代手动测试

Mock 页能覆盖 **API 调用 + 数据验证**，但以下场景它测不了：
- **视觉渲染**（样式、动画、布局）— 必须切到真实页面看
- **Canvas 导出**（分享图保存相册）— 必须在真机测
- **页面生命周期交互**（onShow 触发、路由参数）— 必须模拟页面跳转
- **真机权限**（相册写入、网络状态）— 只能在真机环境验证

Mock 页的价值在于：**把需要切页面、反复填参数、逐项核对返回结果的体力活自动化掉**，让你只需要关注那些必须人肉验证的东西。

---

## 6. 未来建议

### 6.1 将 Auto Run 模式推广到其他云函数

如果以后有新的云对象（比如 `survey-system`），直接复制 Auto Run 的框架：

```javascript
async runAllTests() {
  const results = []
  let passed = 0
  const add = (name, ok, detail) => { ... }
  // 逐条加测试用例
  // 每条独立 try/catch
  this.showResults(results, passed)
}
```

只需要改方法名、参数、断言条件即可。

### 6.2 添加"预期失败"的视觉区分

当前 Auto Run 的缺参测试虽然逻辑上算通过，但 UI 显示绿色可能让人困惑。后续可以加一个「⚠️ 预期失败」标签：

```html
<text v-if="r.expected" class="s6-auto-expected">⚠ 预期异常</text>
```

### 6.3 将纯函数测试与 Mock 页对接

`test-stage6.mjs` 目前独立运行，输出在控制台。可以把它包装为 pin-test.vue 的一个按钮：

```
点击 → 在本地计算所有断言 → 在页面渲染通过/失败清单
```

这样就不用来回切终端了。

### 6.4 为 Auto Run 增加"导出报告"功能

一键跑完后把结果导出为 JSON/文本，方便粘贴到文档或群里。

### 6.5 注意模板语法限制

本项目用的是 **Vue 2**。如果将来迁移到 Vue 3，这些坑会自动消失（Vue 3 的模板编译器基于 `@vue/compiler-dom`，支持 `?.`、`??`、`??=` 等现代语法）。迁移前记得在模板中禁用所有 ES2020+ 特性。
