# Mock 测试页方法论

> 以「标签唯一性约束」验收为例，提炼 Mock 测试页的设计模式、测试方法论和架构原则。

---

## 一、核心命题

**在 uni-app + uniCloud 框架下，如何用最低成本、最快速度、最干净的副作用，完成一个功能的端到端验收？**

答案是一套三层协同架构：**前端测试页（UI 层）→ 云对象测试方法（逻辑层）→ 数据库（验证层）**。

---

## 二、架构：三层协同

```
┌─────────────────────────────────────────┐
│  phase1-test.vue                        │
│  ┌──────────┐  ┌──────────────────────┐ │
│  │ 按钮面板  │  │  日志面板（终端风格）  │ │
│  │ .test-btn │  │  .log-panel         │ │
│  └────┬─────┘  └──────────────────────┘ │
│       │  uniCloud.importObject('survey') │
├───────┼──────────────────────────────────┤
│       ▼                                  │
│  survey/index.obj.js                    │
│  ┌────────────────────────────────────┐ │
│  │ testUniqueness()       TC-01,TC-05 │ │
│  │ testUniquenessMultiUser() TC-02~04 │ │
│  │ checkDuplicateTags()   运维查重     │ │
│  │ resolveDuplicateTags() 运维清理     │ │
│  └────────────────────────────────────┘ │
│       │                                  │
├───────┼──────────────────────────────────┤
│       ▼                                  │
│  surveys 表 + tagName_unique 索引        │
└─────────────────────────────────────────┘
```

**关键原则**：测试逻辑不是前端代码，是云对象的方法。前端只负责「按钮 → 调方法 → 渲染结果」。这区别于传统前端的「测试逻辑写在前端用 mock 数据」的模式。

---

## 三、前端设计模式

### 3.1 终端风格日志面板

```vue
<view class="log-panel">
  <view class="log-header">
    <text class="log-title">运行日志</text>
    <text class="log-clear" @click="logs = []">清空</text>
  </view>
  <scroll-view class="log-body" scroll-y :scroll-top="logScrollTop">
    <view v-for="(log, i) in logs" :key="i" :class="'log-line log-' + log.type">
      <text class="log-time">{{ log.time }}</text>
      <text class="log-msg">{{ log.msg }}</text>
    </view>
    <view v-if="logs.length === 0" class="log-empty">点击下方按钮开始测试</view>
  </scroll-view>
</view>
```

**设计要点**：

| 要素 | 设计决策 | 理由 |
|------|---------|------|
| 背景色 | 深色 `#1D2939` | 模拟终端，降低视觉疲劳，结果色更容易辨认 |
| 日志等级 | `ok`/`err`/`warn`/`info`/`title` 五级 | 够用且不冗余 |
| 时间戳 | `HH:MM:SS` 格式 | 足够定位时序，不需要完整日期 |
| 自动滚动 | `$nextTick` 设 `scrollTop = 99999` | 每次 addLog 自动滚到底部 |
| 空状态 | 「点击下方按钮开始测试」 | 引导用户操作，不是空白 |
| 一键清空 | 右上角「清空」按钮 | 大量日志后快速重置 |

**色彩语义**：

| 等级 | 颜色 | 用途 |
|------|------|------|
| `ok` | `#12B76A` 绿 | 测试通过 |
| `err` | `#F04438` 红 | 测试失败 / 异常 |
| `warn` | `#F79009` 橙 | 警告 / 用户取消 / 需要人工判断 |
| `info` | `#B0BBD5` 灰蓝 | 普通信息 / 中间步骤 |
| `title` | `#84CAFF` 蓝 + 加粗 | 测试分组标题 / 开始结束标记 |

### 3.2 按钮面板的信息层级

每个测试按钮包含三级信息：

```
┌─────────────────────────────┐
│  🔍  icon（视觉标识）        │
│  检查重复标签  text（操作名） │
│  列出所有重复 tagName 及详情  │ ← hint（一行说明预期行为）
└─────────────────────────────┘
```

- **icon**：emoji，视觉区隔，一眼分辨
- **text**：操作名称，强语义
- **hint**：一行描述（不超过一行），告诉用户点这个按钮会发生什么

### 3.3 按钮的语义化配色

| 类型 | 样式 | 语义 |
|------|------|------|
| 默认白底 | `background: #FFF` | 普通测试 |
| `test-btn-danger` | 红边框 `#F04438` | 有破坏性副作用（删除数据） |
| `test-btn-auto` | 绿边框 `#12B76A` + 浅绿底 `#F6FFED` | 全自动、无副作用 |
| `test-btn-multi` | 紫色边框 `#7B61FF` + 浅紫底 `#F5F3FF` | 模拟场景 |
| `test-btn-all` | 深色底 `#1D2939` | 一键全跑 / 批量操作 |

配色不是装饰——用户扫一眼按钮的颜色就知道操作的风险等级。

### 3.4 `addLog` 方法：最小接口

```javascript
addLog(msg, type) {
  const now = new Date()
  const time = now.getHours().toString().padStart(2, '0') + ':' +
    now.getMinutes().toString().padStart(2, '0') + ':' +
    now.getSeconds().toString().padStart(2, '0')
  this.logs.push({ time, msg, type: type || 'info' })
  this.$nextTick(() => { this.logScrollTop = 99999 })
}
```

两个参数：消息 + 类型。测试方法里只关心「说什么」和「什么颜色」，不关心时间戳和滚动——那些由 `addLog` 封装。

---

## 四、后端测试模式

### 4.1 测试方法嵌入云对象

不新建单独的测试云函数。测试方法是生产云对象的原生方法——和 `generateFromCoze`、`getSurveyByTag` 平级。

**优势**：
- 共享同一套 `db` 连接和 collection 引用
- 同一个服务空间，不跨环境
- 不需要额外的路由配置

**注意**：测试方法不需要 `_before` 的登录校验，也不需要传参。它们是完全自包含的。

### 4.2 自清洁模式（Self-Cleaning Test Data）

```javascript
const testTag = '__auto_test_' + Date.now()

// ... 执行测试 ...

// 无论如何都要清理
try {
  const toClean = await surveysCol.where({ tagName: testTag }).get()
  for (const doc of (toClean.data || [])) {
    await surveysCol.doc(doc._id).remove()
  }
  results.push({ tc: 'CLEANUP', pass: true, msg: '测试数据已清理' })
} catch (e) {
  results.push({ tc: 'CLEANUP', pass: false, msg: '清理失败' })
}
```

**三个保障**：

1. **前缀隔离**：测试数据用 `__auto_test_` / `__multi_test_` 前缀，一眼可辨
2. **时间戳唯一**：`Date.now()` 保证不同次测试不会冲突
3. **必执行清理**：cleanup 放在 finally 语义的位置（外层 try-catch 包裹），即使测试中间抛异常也会尝试清理

**为什么不依赖 finally？** uniCloud 阿里云版的 JavaScript 运行时可能不支持完整的 finally 语义。用 try-catch 包裹 + 外层独立清理更可靠。

### 4.3 结构化结果协议

```javascript
// 每条测试结果
{ tc: 'TC-01-a', pass: true, msg: '唯一索引生效，重复写入被拦截' }

// 整体返回
{ errCode: 0, data: { results: [...], allPassed: true } }
```

**为什么用结构化数组而不是字符串拼接**：
- 前端不需要解析——`results.forEach(r => render(r))` 即可
- `allPassed` 让前端只需判断一个布尔值
- 单个 `tc` 可独立追踪，方便对比测试文档

### 4.4 模拟外部依赖而不调用

> 多用户测试中不调 Coze API，而是直接构造 `creatorId` 不同的记录，用唯一索引本身验证拦截逻辑。

**原则**：测试的是**你的逻辑**，不是第三方 API。唯一索引是数据库层面的保证，`generateFromCoze` 中的应用层检查是锦上添花——两者可以分开验证。

具体做法：
- 模拟「用户 A 已有一条记录」→ 直接 `surveysCol.add({ creatorId: uidA, ... })`
- 模拟「用户 B 同 tagName 生成」→ 直接 `surveysCol.add({ creatorId: uidB, ... })`，预期唯一索引拒绝
- 模拟「用户 A 重新生成」→ 先删后建，验证记录数仍为 1

**这样做省了什么**：Coze API 的调用延迟（数秒到数十秒）、Coze 额度消耗、Coze 返回不可控带来的测试不确定性。

### 4.5 Fail-Fast：前序失败则终止

```javascript
try {
  await surveysCol.add({ ...baseDoc, creatorId: uidA, ... })
  results.push({ tc: 'TC-04', pass: true, ... })
} catch (e) {
  results.push({ tc: 'TC-04', pass: false, ... })
  // 后续测试依赖此步骤，失败则终止
  const allPassed = results.every(r => r.pass)
  return { errCode: 0, data: { results, allPassed } }
}
```

TC-02 和 TC-03 的前提是 TC-04 创建了一条用户 A 的记录。如果 TC-04 失败了，跑后续测试没有意义——直接返回当前结果，不浪费调用。

**注意**：只有**硬依赖**才用 fail-fast。TC-01 的 a/b 两步是硬依赖（b 依赖 a 创建记录），TC-05 依赖 TC-01 的记录存在，多用户测试中 TC-02/03 依赖 TC-04。但 TC-01 失败不影响 TC-05 的独立尝试（反正肯定也查不到）。

---

## 五、测试方法论

### 5.1 测试分层与对应手段

| 层 | 测什么 | 怎么测 | 例子 |
|----|-------|--------|------|
| 数据库层 | 唯一索引是否生效 | 写入重复，catch 异常 | TC-01 |
| 应用逻辑层 | 同名检查的判断分支 | 构造不同 `creatorId` 验证各分支 | TC-02, TC-03 |
| 查询层 | 确定性返回 | 同条件多次查询，比 `_id` | TC-05 |
| 前端 UI 层 | Modal 文案、按钮行为 | 人工触发看弹窗 | TC-07, TC-08 |
| 运维工具层 | 查重/清理功能 | 构造重复数据后调用 | checkDuplicateTags |

### 5.2 验证策略：否定式验证

> 不是验证「正确操作返回正确结果」，而是验证「错误操作被正确拦截」。

- TC-01-b：不是验证「第二次 add 失败」，而是「如果第二次 add 成功了，就是 bug」——catch 到异常 = pass
- TC-02：不是验证「用户 B 收到 TAG_ALREADY_EXISTS」（那需要调 Coze），而是验证「唯一索引拒绝用户 B 的写入」
- TC-03：不是验证「用户 A 放行」，而是验证「删旧建新后记录数仍为 1，且 _id 变了」

**核心洞察**：正向验证依赖完整链路（前端 → 云函数 → Coze → 入库），而否定式验证只依赖数据库——更快、更可靠、不消耗外部资源。

### 5.3 测试数据的命名空间隔离

```
__auto_test_1716912000000    ← testUniqueness 用
__multi_test_1716912000001   ← testUniquenessMultiUser 用
```

前缀 `__` 表明这是临时系统数据，`auto`/`multi` 标识来源，时间戳保证唯一。即使清理失败，数据库里也能一眼认出哪些是测试残留。

---

## 六、反模式：不要做的事

### 6.1 不要把测试逻辑写在前端

```javascript
// ❌ 坏：前端拼接测试数据，调云函数
const testDoc = { tagName: 'test_xxx', dims: [...] }
await survey.add(testDoc)
await survey.add(testDoc)  // 期望报错
```

问题：前端没有数据库的直接访问权，必须经过云函数。云函数的 `add` 方法通常有业务校验，测不到裸数据库行为。

### 6.2 不要为了测试修改生产代码

```javascript
// ❌ 坏：在 generateFromCoze 里加 if (isTest) { ... }
```

测试代码和生产代码分离。唯一的交集是：生产云对象提供测试方法，测试方法用自己的逻辑验证生产行为。

### 6.3 不要依赖手动清理

```javascript
// ❌ 坏：console.log('测试完成，请手动删除 tagName=test_xxx 的记录')
```

只要有一次忘记手动清理，下次测试可能因数据冲突而误报。自动清理是硬要求。

### 6.4 不要用 `console.log` 替代结构化日志

```javascript
// ❌ 坏：console.log('TC-01 通过')
// ✅ 好：results.push({ tc: 'TC-01', pass: true, msg: '...' })
```

`console.log` 在云函数里你根本看不到——它们去了阿里云日志系统，不是测试页的日志面板。所有结果必须通过返回值传回前端。

---

## 七、复用清单

当你要为下一个功能搭建 Mock 测试页时，复制以下骨架：

### 7.1 前端骨架

```
pages-tools/xxx-test/xxx-test.vue
  ├── log-panel（日志面板，复制样式）
  ├── btn-group（测试按钮，按场景分组）
  └── methods（每个按钮 → 调云对象方法 → forEach results 渲染日志）
```

### 7.2 后端骨架

```javascript
async testXxx() {
  const results = []
  const testTag = '__xxx_test_' + Date.now()

  // 1. 准备
  // 2. 执行 + 验证
  // 3. 清理

  const allPassed = results.filter(r => r.tc !== 'CLEANUP').every(r => r.pass)
  return { errCode: 0, data: { results, allPassed } }
}
```

### 7.3 约定

- 测试方法名以 `test` 开头
- 返回值格式：`{ errCode: 0, data: { results: [{ tc, pass, msg }], allPassed } }`
- 测试数据 `tagName` 前缀：`__xxx_test_`
- 不调外部 API（除非就是测 API 本身）
- 必须包含 CLEANUP 步骤

---

## 八、本次实践的完整测试覆盖矩阵

| 用例 | 层级 | 方式 | 状态 |
|------|------|------|------|
| TC-01 | DB | 自动化脚本 | ✅ |
| TC-02 | 应用逻辑 | 模拟多用户 | ✅ |
| TC-03 | 应用逻辑 | 模拟多用户 | ✅ |
| TC-04 | 应用逻辑 | 模拟首次生成 | ✅ |
| TC-05 | 查询 | 自动化脚本 | ✅ |
| TC-06 | DB | 与 TC-01 同原理，跳过 | — |
| TC-07 | 前端 UI | 人工验证 | ⬜ |
| TC-08 | 前端 UI | 人工验证 | ⬜ |
| TC-09 | 边界 | 已知设计决策，跳过 | — |
| TC-10 | 并发 | 需双用户同时触发 | ⬜ |

自动化 5 项，人工 2 项，跳过 2 项（同原理/已知决策），未覆盖 1 项（并发）。

---

## 九、一句话总结

**Mock 测试页的本质不是"模拟"，而是"让你的代码自己证明自己是对的"——在云对象里写测试方法、用数据库当裁判、用日志面板当眼睛。测试即文档，按钮即用例，清理即责任。**
