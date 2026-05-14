# 问卷-标签引用关系设计 · DeepSeek 专家模式

> 用途：投喂 DeepSeek 专家模式，请对方为小程序后端数据库结构优化方案提供专业设计建议。
> 编写时间：2026-05-14
> 编写人：项目开发者

---

## 一、项目背景

### 1.1 产品定位

一款**标签式娱乐答题微信小程序**。用户浏览标签 → 选一个标签开答 → 答完出结果（雷达图+结果类型描述）→ 分享。类似"测测你的XX指数"这种轻量玩法。

### 1.2 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Vue 2 + uni-app + 微信小程序 |
| 后端 | uniCloud 支付宝云（MongoDB + 云函数） |
| AI 生成 | Coze 工作流批量/实时生成问卷内容 |

### 1.3 页面与数据流

共 5 个页面，均已跑通：

| 页面 | 路径 | 数据依赖 |
|------|------|---------|
| 工具集首页 | `pages/index/index.vue` | 无（纯导航） |
| 问卷首页 | `pages-tools/quiz-home/quiz-home.vue` | `survey.getTagList()` → `survey-tags` |
| 搜索页 | `pages-tools/search/search-page.vue` | `survey.getTagList()` + `survey.getCategories()` → `survey-tags` + `survey-categories` |
| 答题页 | `pages-tools/answer-quiz/answer-quiz.vue` | `survey.getSurveyByTag({ tagName })` → `surveys` |
| 结果页 | `pages-tools/result/result.vue` | URL 参数传入（tag, scores, dims, emoji）+ `getVoteStats()` / `getUserVote()` / `getFavorites()` |

数据流向简图：

```
survey-categories  ←  1:N  →  survey-tags  ←  1:N  →  surveys
     分类                       标签                 问卷（可多份）

用户操作流程：
浏览标签池（从 survey-tags 取） → 选中标签 → 查 surveys（按 tagName 匹配）
→ 随机取一份问卷 → 答题 → 出结果页
```

---

## 二、数据库现状

### 2.1 涉及的数据集合

共 6 个：

1. `survey-categories` — 标签分类
2. **`survey-tags`** — 标签元数据（核心问题涉及）
3. **`surveys`** — 问卷内容（核心问题涉及）
4. `survey-answers` — 用户答题记录
5. `survey-favorites` — 用户收藏的标签
6. `survey-likes` — 用户对标签的赞/踩

### 2.2 `survey-tags` 集合（标签表）

| 字段 | 类型 | 说明 |
|------|------|------|
| `_id` | string | 自动生成 |
| `name` | string | **标签名，唯一**（如"确诊为烤肠"） |
| `category` | string | 分类 ID（关联 survey-categories._id） |
| `emoji` | string | 标签 emoji（如 "🌭"） |
| `description` | string | 简短描述 |
| `popularity` | int | 热度值 |
| `rarity` | string | 稀有度：common / rare / epic / darkgold |
| `status` | string | draft / published / disabled |
| `surveyCount` | int | 该标签下的问卷数量（冗余字段） |
| `create_date` | timestamp | 创建时间 |

**索引：** `name` 唯一索引，`category+status` 联合索引，`popularity` 降序索引。

**示例数据：**
```json
{
  "_id": "67f9a1b2c3d4e5f6a7b8c9d0",
  "name": "确诊为烤肠",
  "category": "cat_xinggegaoguai",
  "emoji": "🌭",
  "description": "你骨子里就是根5块钱的淀粉肠",
  "popularity": 42,
  "rarity": "epic",
  "status": "published",
  "surveyCount": 3,
  "create_date": { "$date": "2026-04-01T00:00:00Z" }
}
```

### 2.3 `surveys` 集合（问卷表）— **问题所在**

| 字段 | 类型 | 说明 |
|------|------|------|
| `_id` | string | 自动生成 |
| `tagName` | string | **关联的标签名（纯字符串，非引用）** ← 问题字段 |
| `title` | string | 问卷标题 |
| `dims` | string[] | 维度列表（3-7 个） |
| `qs` | object[] | 题目数组，每项 `{ title, dim }` |
| `resultTypes` | object[] | 结果类型，每项 `{ name, emoji, emojiBg, desc, match }` |
| `status` | string | active / disabled |
| `create_date` | timestamp | 创建时间 |

**索引：** `tagName+status` 联合索引，`status+create_date` 联合索引。

**示例数据：**
```json
{
  "_id": "67f9b2c3d4e5f6a7b8c9d0e1",
  "tagName": "确诊为烤肠",
  "title": "你被确诊为什么东西？",
  "dims": ["淀粉含量", "加肉程度", "受欢迎度"],
  "qs": [
    { "title": "周末你更倾向于一个人待着？", "dim": "淀粉含量" },
    { "title": "你喜欢在背后默默吐槽？", "dim": "加肉程度" }
  ],
  "resultTypes": [
    { "name": "纯正淀粉肠", "emoji": "🌭", "emojiBg": "#FFE4B5", "desc": "...", "match": "淀粉含量" }
  ],
  "status": "active"
}
```

---

## 三、需要解决的问题

### 3.1 问题描述

`surveys` 集合通过 `tagName`（纯字符串）来关联 `survey-tags`，而不是通过 `_id` 引用。这意味着：

1. **无引用完整性**：如果 `survey-tags` 中某个标签的 `name` 改了（理论上 name 是唯一的业务标识），所有 `surveys` 中对应的 `tagName` 就变成了悬空字符串，这批问卷再也搜不到了。

2. **数据不一致隐患**：一个标签（"确诊为烤肠"）的元信息（emoji, rarity, description 等）存在 `survey-tags` 里。当答题页/结果页需要展示标签 emoji 时，目前的做法是从 URL 参数传过去，而不是查表。如果以后需要从 `surveys` 数据里直接拿到标签的 emoji/rarity，就做不到。

3. **查询冗余**：`getSurveyByTag({ tagName })` 当前直接用 `tagName` 查 `surveys` 表，但如果有 `tagId` 引用，查索引的效率理论上更高（ObjectId 索引 vs 字符串索引）。

### 3.2 业务约束

- **一个标签可以关联多份问卷**（同一个标签有多套题目，用户答题时随机抽取一套）。当前数据已有 357 份问卷、约 300 个标签，一对多关系明确。
- `survey-tags.name` 有唯一索引，业务上标签名不频繁变更，但理论上存在变更可能性。
- 新增问卷的途径有两种：① Coze 批量导入（`importSurveys` 云函数）；② 用户搜索不到时广告触发 Coze 实时生成（`generateSurveyByAd`，尚未实现）。
- 标签的展示信息（emoji, rarity）只存在 `survey-tags` 中，`surveys` 里没有这些字段。

### 3.3 当前代码中的关联方式

以下是当前代码中所有通过 `tagName` 进行关联的地方：

**云函数 `survey/index.obj.js`：**
- `getSurveyByTag(params)`: `surveysCol.where({ tagName: params.tagName, status: 'active' })` — 按 tagName 字符串查问卷
- `importSurveys(params)`: 从 Coze 传入的数据直接写 `tagName`，没有解析 tagId
- `toggleFavorite(params)`: `favoritesCol.where({ tagName: params.tagName })` — 收藏表也是按 tagName 字符串
- `voteTag(params)`: `likesCol.where({ tagName: params.tagName })` — 赞踩表同样

**前端：**
- `quiz-home.vue` / `search-page.vue`: 从 `survey-tags` 取标签列表，展示 name/emoji/rarity
- `goQuiz(tagName)`: 用 `tagName` 导航到答题页
- `answer-quiz.vue`: 用 `tagName` 调 `getSurveyByTag` 获取问卷内容
- `result.vue`: 从 URL 参数拿 tag 名称，后续对标签的赞踩/收藏操作都是传 tagName 字符串

### 3.4 已经存在的"不纯粹"

`survey-favorites` 和 `survey-likes` 这两个表也通过 `tagName`（字符串）关联回 `survey-tags`，不是通过 `_id`。

---

## 四、需要 DeepSeek 专家回答的问题

### 4.1 核心设计问题

**整体方案评估：** 我提出的方案是在 `surveys` 集合中新增一个 `tagId` 字段（引用 `survey-tags._id`），同时保留 `tagName` 作为展示缓存，实现冗余引用。请问这个方案是否合理？在 MongoDB 文档数据库的范式下，有没有更好的做法？

### 4.2 具体技术问题

1. **引用完整性**：uniCloud 的 MongoDB 没有外键约束，`tagId` 本质上只是一个人为维护的字符串。这种情况下，如何保证 `tagId` 的引用不悬空？是否有必要在应用层做校验，还是接受"软引用"？

2. **副作用影响范围**：关联表（`survey-favorites`, `survey-likes`）里也有 `tagName` 字段，是否也应该一起改成 `tagId`？还是说这些表因为只存了 `tagName` 一个关联字段，保留字符串更简单？

3. **查询性能**：当前 `getSurveyByTag` 直接用 `tagName` 查 `surveys`（有联合索引 `tagName+status`）。如果改成先查 `survey-tags` 拿到 `_id`，再查 `surveys`，就是两次查询。值不值得多这一次查询来换取设计上的规范性？

4. **前端传递**：标签列表页到答题页之间目前只传 `tagName`（URL 参数），如果加了 `tagId`，导航时是只改云函数内部实现（前端继续传 `tagName`，云函数内部解析），还是前端也要传 `tagId`？哪种更合理？

5. **数据迁移**：现有 357 份 `surveys` 数据没有 `tagId`，需要写脚本做一次向后兼容的填充迁移。如何确保迁移的可靠性？是否需要在填充的同时验证 `survey-tags` 中确实存在对应的 `name`？

### 4.3 边界情况

1. **Coze 导入场景**：Coze 输出的数据只有 `tagName` 没有 `tagId`，导入时需要通过 `tagName` 查 `survey-tags` 拿到 `_id` 再写入。如果查不到（新标签还没入库），是否应该自动创建标签兜底？还是报错？

2. **广告实时生成场景**：用户搜索不到 → 看广告 → 调 Coze 实时生成，生成结果是新的 `survey` + 可能的新的 `survey-tag`。这个场景下 `tagId` 的写入顺序应该是先写标签再写问卷，对吗？

3. **`tagName` 变更场景**：虽然标签名不常改，但如果真的改了，除了更新 `survey-tags.name`，还需要扫所有引用了它的 `surveys` 来更新 `tagName` 缓存字段。这个操作成本高吗？是否有更好的同步策略？

### 4.4 开放性问题

1. 有没有更极致的方案——比如直接去掉 `surveys` 中的标签关联信息，改为"按 `tagId` 查 `surveys`，按 tagId 拼回 `tagName`"的纯引用模式？这样一步到位最干净，但每次查问卷都要两次请求，是否值得？

2. 假如未来数据量增长到上万份问卷，当前的设计（一份问卷内嵌全部题目/维度/结果类型）会否有文档体积过大的性能隐患？这和标签引用问题是否有协同优化空间？

3. 有没有我没想到的设计陷阱？

---

## 五、附：补充信息

### 5.1 问卷数据结构规范

问卷的完整 `surveys` 文档结构（Coze 友好版）：

```typescript
interface Survey {
  tagName: string        // 标签名（用于搜索匹配）
  title: string          // 页面标题
  dims: string[]         // 维度列表（3-7 个），如 ["淀粉含量", "加肉程度"]
  qs: Question[]         // 题目列表（维度数 × 3）
  resultTypes: ResultType[]  // 结果类型（每个维度对应一个）
  status: 'active' | 'disabled'
}

interface Question {
  title: string           // 题目文本
  dim: string             // 关联的维度名，必须在 dims 中
}

interface ResultType {
  name: string            // 结果类型名称
  emoji: string           // 展示用 emoji
  emojiBg: string         // 卡片背景色
  desc: string            // 结果描述
  match: string           // 关联维度名
}
```

### 5.2 当前已有数据量

| 集合 | 数据量 |
|------|--------|
| `survey-categories` | ~15 条 |
| `survey-tags` | ~300 条 |
| `surveys` | 357 份问卷 |
| `survey-answers` | 少量测试数据 |
| `survey-favorites` | 少量测试数据 |

### 5.3 云函数 `survey/index.obj.js` 中的相关方法签名

```javascript
// 按标签名查问卷
async getSurveyByTag(params: { tagName: string })

// 批量导入（按 tagName 写入）
async importSurveys(params: { surveys: Survey[] })

// 收藏/取消收藏
async toggleFavorite(params: { tagName: string })

// 赞/踩
async voteTag(params: { tagName: string, type: 'like' | 'dislike' })

// 获取标签列表（返回标签元信息）
async getTagList(params: { pageSize: number, sortBy: string })
```

### 5.4 前端导航路径 trace

```
quiz-home.vue
  allTags: [{ name, emoji, rarity, ... }]  ← survey.getTagList()
  @click="goQuiz(tag.name)"
    → navigateTo: answer-quiz?tag=${tagName}


search-page.vue
  allTags: [{ name, emoji, ... }]  ← survey.getTagList()
  @click="goQuiz(item.tag)"
    → navigateTo: answer-quiz?tag=${tagName}


answer-quiz.vue
  onLoad: tag = decodeURIComponent(options.tag)
  survey.getSurveyByTag({ tagName: this.tag })
    → 获取问卷数据 → 答题 → 结果页
    → navigateTo: result?tag=${tagName}&scores=...&dims=...&emoji=...


result.vue
  onLoad: tag, scores, dims, emoji 全部从 URL 参数来
  survey.getVoteStats({ tagName: this.tag })
  survey.getUserVote({ tagName: this.tag })
  survey.toggleFavorite({ tagName: this.tag })
```

---

## 期望输出

请以 MongoDB 文档数据库的设计专家视角，对上述问题给出系统性建议。希望你的回答能直接指导代码层面的改动决策，包括：

1. 推荐方案的具体数据结构定义（JSON Schema 级别）
2. 主要受影响代码的改动要点（云函数 + 前端）
3. 数据迁移策略
4. 未来扩展的注意事项

不需要完整的实现代码，但需要足够具体到我可以照着实施。

# 回复
以 MongoDB 文档模型的设计视角，你的项目处于**从“快速原型”向“可运维系统”转型的典型节点**。下面给出系统性的评估与可直接实施的方案。

---

## 一、整体方案评估：冗余引用是正确方向

你提出的 **`surveys` 新增 `tagId` 引用 `survey-tags._id`，同时保留 `tagName` 作为展示缓存**，本质上是一种**读写分离的冗余设计**。在 MongoDB 生态中，这是处理“关联”的标准实践之一，尤其适合你的场景：

- 读多写少（标签展示频繁，改名极罕见）
- 标签数据很小（单文档百字节级），冗余成本低
- 需要避免跨表 `$lookup` 造成的接口变慢和代码复杂度

**结论：这个方案合理，且是目前性价比最高的选择。**  
不需要改成纯 `$lookup` 模式，也不需要把问卷和标签嵌入同一个文档（那会造成更严重的更新扩散）。

---

## 二、具体技术问题解答

### 2.1 引用完整性与软引用

uniCloud MongoDB 没有外键约束，因此 `tagId` 只能是**应用层维护的软引用**。你需要接受这个现实，并通过以下机制把风险降到可忽略：

| 策略 | 做法 |
|------|------|
| **写入时校验** | `importSurveys`、`generateSurveyByAd` 在写 `surveys` 前，**必须**通过 `tagName` 查出或创建 `survey-tags` 文档，拿到 `_id`，再写入 `tagId`。不允许写入 `tagId` 悬空的问卷。 |
| **更新时同步** | 如果后台修改标签名，应用层同时更新 `survey-tags.name` 和所有 `surveys.tagName`（见 3.3）。 |
| **删除保护** | 删除标签前，检查是否有关联问卷（`surveys.count({ tagId })`），如有则阻止删除或提示级联处理。 |
| **定期巡检脚本** | 写一个轻量脚本，跑 `surveys.find({ tagId: { $exists: false } })`，以及 `tagId` 对应 `survey-tags` 不存在的孤儿文档，报警并修复。 |

**不需要追求“绝对外键”，做到“写入即正确 + 异常可发现”即可。**

### 2.2 `survey-favorites` 和 `survey-likes` 的改造建议

这两个表**同样应该加上 `tagId`**，原因有三：

1. 它们与 `survey-tags` 也是关联关系，用 `tagId` 才能统一关联逻辑。
2. 未来如果需要“用户收藏的标签列表”并展示 emoji/稀有度，可以直接拿 `tagId` 查标签表，而不需要依赖可能过时的冗余字段。
3. 改造成本极低——现在数据量小，直接迁移即可。

**但是否保留 `tagName` 冗余？**  
**建议保留**。因为收藏列表、点赞统计等场景往往需要直接展示标签名，冗余 `tagName` 可以避免每次都 `$lookup` 或二次查询。维护成本依然很低（同步策略同上）。

调整后这两个表的结构：

```json
// survey-favorites
{
  "_id": "...",
  "userId": "...",
  "tagId": "survey-tags._id",   // 新增，唯一引用
  "tagName": "确诊为烤肠",       // 保留，展示缓存
  "create_date": "..."
}
// survey-likes 同理，增加 tagId
```

### 2.3 查询性能：多一次查询值不值？

你现在的 `getSurveyByTag` 用 `tagName` 直接查 `surveys`，走 `{tagName:1, status:1}` 联合索引，非常快。如果改为“先查标签得 `_id`，再查问卷”，多一次 `survey-tags` 的主键查询（`_id` 索引），耗时在 **1~3 ms** 级别，完全可以接受。

**但更优的演进路径是：**  
前期云函数内部兼容 `tagName` 和 `tagId`，前端逐步改为传 `tagId`，最终云函数直接用 `tagId` 查问卷（索引更小、查询更快）。这样连多一次查询都省了，且彻底解耦。

### 2.4 前端传递：应传 `tagId`，而不是 `tagName`

当前前端从 `survey-tags` 列表中已经拿到了每个标签的 `_id`。所以最合理的改动是：

- **导航传递**：`goQuiz(tag._id)`，URL 参数改为 `quizId=xxx` 或 `tagId=xxx`。
- **云函数入参**：`getSurveyByTag({ tagId })`，直接用 `tagId` 查问卷。
- **结果页**：`result.vue` 接收 `tagId`，调一次 `getTagInfo(tagId)` 拿 emoji/name 等展示（或者直接从标签列表缓存中取，但为了保证刷新后仍可用，最好有接口）。

**好处**：URL 干净，不再依赖字符串匹配，彻底消灭了“改名即失联”的风险。

如果不想大改前端，也可以**云函数内部做兼容**：
```js
// 云函数 getSurveyByTag(params)
let tagId = params.tagId;
if (!tagId && params.tagName) {
  const tag = await tagsCol.findOne({ name: params.tagName });
  tagId = tag ? tag._id : null;
}
// 然后用 tagId 查 surveys
```
这是最低风险的渐进式改造。

### 2.5 数据迁移可靠性

357 条数据迁移完全可以手工或脚本完成，要点：

1. **幂等性**：脚本检查 `tagId` 是否已存在，存在则跳过。
2. **验证关联**：对每条 `surveys`，用 `tagName` 查 `survey-tags`，存在则填入 `_id`，不存在则记录到异常清单（人工确认是否补建标签或清理脏数据）。
3. **分批执行**：`surveys` 分批 update，加上 `_id` 范围条件，避免长时间锁库（虽然单文档更新无锁，但大批量还是建议控制速率）。
4. **迁移后校验**：跑一遍 `surveys.find({ tagId: { $exists: false } })`，确保数量为 0。

---

## 三、边界情况处理

### 3.1 Coze 导入：查不到标签应自动创建（有控制的兜底）

`importSurveys` 流程建议：
```
1. 收集所有 surveys 的 tagName，去重
2. 批量查 survey-tags，得到 name -> _id 映射
3. 对不存在的 tagName：
   a. 自动创建新标签（状态设为 draft 或 published，按规则定）
   b. 补全 emoji/rarity/category 等字段？如果 Coze 产出只给 name，
      你可以在自动创建时填默认值，并标记“待人工完善”
4. 生成 tagId，写入 surveys
```
**绝不要**允许“查不到就跳过 tagId 写入”——那又回到悬空字符串了。

### 3.2 广告实时生成场景

顺序严格为：**先标签，后问卷**。
```js
// 伪代码
let tag = await tagsCol.findOne({ name: newTagName });
if (!tag) {
  const newTag = { name: newTagName, ...defaults };
  const res = await tagsCol.add(newTag);
  tag = { _id: res.id, ...newTag };
}
survey.tagId = tag._id;
survey.tagName = tag.name;
await surveysCol.add(survey);
```
如果标签创建失败，问卷不入库，回滚。

### 3.3 `tagName` 变更场景

即便业务上极少发生，也要设计好防御性同步：

**推荐做法：** 修改标签名的管理接口（如果有），在更新 `survey-tags.name` 后，立即执行一条多文档更新：
```js
await surveysCol.where({ tagId: tagId }).update({ tagName: newName });
await favoritesCol.where({ tagId: tagId }).update({ tagName: newName });
await likesCol.where({ tagId: tagId }).update({ tagName: newName });
```
这三条更新均走 `tagId` 索引，性能没问题。如果暂时没有管理后台，可以留一个云函数 `renameTag(tagId, newName)`，人工触发。

**如果没来得及同步，缓存不一致怎么办？**  
因为核心查询已经切到 `tagId`，所以最坏情况只是展示的 `tagName` 旧了一点，不会出现功能断裂。这正是冗余缓存带来的容错优势。

---

## 四、开放性问题

### 4.1 是否应该走向“纯引用”，去掉所有 `tagName` 冗余？

**不建议一步到位。**  
纯引用模式（`surveys` 只存 `tagId`）虽然最干净，但会立刻要求：

- 任何需要展示标签名的场景（后台列表、用户历史记录）都必须 JOIN。
- 你的 `survey-favorites` 列表若用纯引用，每次渲染都要查标签表，对用户体验和代码简洁性都是倒退。

**最佳平衡点**就是你现在选择的：`tagId` 作主引用 + `tagName` 作高频读缓存。它是“90% 的规范性 + 100% 的性能”。

### 4.2 上万份问卷后的扩展隐患

你的一份问卷文档大约 **2~5 KB**（几十道题 + 结果类型），完全在 MongoDB 单文档最佳大小（< 1 MB）的安全区内。即使到 10 万份，单文档大小也不会成为瓶颈。

**真正的扩展关注点不是文档大小，而是：**

- `surveys` 集合的单字段索引是否合理（`tagId` 索引 + `status` 条件查询）
- `survey-answers` 可能成为最大表，需要按用户/时间分片或归档
- 问卷内容本身不需要拆分，因为查询总是整份取出

标签引用问题的设计，对扩展没有负面影响。

### 4.3 可能的设计陷阱

1. **`tagName` 唯一性假设被破坏**：你的 `survey-tags.name` 有唯一索引，这很好。但若未来业务允许同名标签（比如不同分类下），整个设计就崩了。必须守住“name 全局唯一”这个约束，否则 `tagId` 是唯一出路。

2. **前端缓存标签列表过期**：如果 `result.vue` 依赖本地缓存的标签列表来展示 `tagId` 对应的名字，但在分享卡片打开时没有缓存，就会显示空白。**必须为结果页提供基于 `tagId` 的 `getTagInfo` 云函数。**

3. **索引遗漏**：新增 `tagId` 后，务必创建索引 `{ tagId: 1, status: 1 }`，并逐渐弃用旧的 `{ tagName: 1, status: 1 }`（或保留作双重保证）。

4. **收藏/点赞在标签删除后的孤儿处理**：如果标签被删除，通过 `tagId` 查询 `favorites/likes` 会失败，此时是允许遗留数据还是级联删除，需要明确策略（建议软删除标签，保留数据，标记 status=disabled）。

---

## 五、推荐实施路线图

### 阶段 1：数据结构升级（后端无感）

- `surveys`、`survey-favorites`、`survey-likes` 均新增 `tagId` 字段。
- 编写并执行迁移脚本，填充现有数据。
- 添加索引 `{ tagId: 1, status: 1 }`。
- 云函数不变，同时支持 `tagName` 和 `tagId`（优先使用 `tagId`）。

### 阶段 2：切断前端对 `tagName` 的依赖

- 修改前端，使 `quiz-home`、`search-page` 传递 `tagId` 至答题页和结果页。
- 结果页通过 `tagId` 调用 `getTagInfo` 获取展示信息。
- 收藏/点赞接口改为接收 `tagId`（内部同步更新 `tagName` 冗余）。

### 阶段 3：收紧写入，关闭后门

- `importSurveys` 强制写入 `tagId`，禁止无 `tagId` 的问卷写入。
- 下掉 `getSurveyByTag` 对 `tagName` 的兼容（仅保留 `tagId` 路径）。
- 删除 `surveys` 中 `tagName` 字段…… **别这么做**，保留它作为只读缓存，性价比极高。

---

## 六、最终数据结构建议（JSON Schema 级别）

```json
// survey-tags（无变化，保证 _id 是唯一标识）
{
  "_id": "ObjectId",
  "name": "string (unique)",
  "category": "string",
  "emoji": "string",
  "description": "string",
  "popularity": "int",
  "rarity": "string",
  "status": "string",
  "surveyCount": "int",
  "create_date": "date"
}

// surveys（核心改动）
{
  "_id": "ObjectId",
  "tagId": "ObjectId (ref: survey-tags._id)",   // 新增，核心引用
  "tagName": "string",                           // 保留，展示缓存
  "title": "string",
  "dims": ["string"],
  "qs": [{ "title": "string", "dim": "string" }],
  "resultTypes": [{ "name": "string", "emoji": "string", "emojiBg": "string", "desc": "string", "match": "string" }],
  "status": "string",
  "create_date": "date"
}
// 索引：{ tagId: 1, status: 1 }

// survey-favorites
{
  "_id": "ObjectId",
  "userId": "string",
  "tagId": "ObjectId",                           // 新增
  "tagName": "string",                           // 保留
  "create_date": "date"
}
// survey-likes 同理
```

---

**总结：你现在站的位置是“修屋顶”的最佳时机——数据量小、业务耦合浅。按上述方案，只需一次迁移和几个云函数的微调，就能获得一个在数据一致性、查询性能和未来扩展上都足够健壮的基础。**