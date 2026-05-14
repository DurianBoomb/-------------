---
name: tagId-reference-migration
overview: 给 surveys、survey-favorites、survey-likes 三个集合新增 tagId 字段，完成从 tagName 字符串引用到 tagId ObjectId 引用的迁移，涉及数据库 schema、云函数、前端页面三层的改造。
todos:
  - id: update-schemas
    content: 更新 surveys/favorites/likes 三个 schema.json，新增 tagId 字段和索引
    status: completed
  - id: rewrite-cloud-function
    content: 重写 survey/index.obj.js：所有方法支持 tagId，新增 getTagInfo() 和 migrateFillTagId()
    status: completed
    dependencies:
      - update-schemas
  - id: update-quiz-home-search
    content: 修改 quiz-home.vue 和 search-page.vue 传 tagId 替代 tagName
    status: completed
    dependencies:
      - rewrite-cloud-function
  - id: update-answer-quiz
    content: 修改 answer-quiz.vue：URL 取 tagId，查问卷用 tagId，传结果页也用 tagId
    status: completed
    dependencies:
      - rewrite-cloud-function
  - id: update-result-favorites
    content: 修改 result.vue 和 favorites.vue：使用 tagId 操作，新增 getTagInfo 调用
    status: completed
    dependencies:
      - rewrite-cloud-function
  - id: run-migration
    content: 执行数据迁移，通过 tagName 反查 tagId 填充已有数据的 tagId 字段
    status: completed
    dependencies:
      - update-schemas
---

## 需求概述

将当前基于 `tagName` 字符串引用的数据库设计，迁移为基于 `tagId`（ObjectId 引用）+ `tagName`（展示缓存）的冗余引用模式。涉及 surveys、survey-favorites、survey-likes 三个集合，云函数 10+ 个方法，前端 5 个页面的全链路改造。

## 核心功能

1. **数据结构升级**：surveys、survey-favorites、survey-likes 三个集合新增 `tagId` 字段，保留 `tagName` 为展示缓存
2. **数据迁移**：编写一次性脚本，通过 tagName 反查 survey-tags._id，填充已有的 ~357 条问卷和收藏/赞踩数据
3. **云函数改造**：所有基于 tagName 查询/写入的方法改为支持/优先使用 tagId，新增 `getTagInfo()` 方法
4. **前端传递改造**：URL 参数从传 `tagName` 改为传 `tagId`，结果页通过 `getTagInfo` 获取标签展示信息
5. **导入流程改造**：`importSurveys` 写入时通过 tagName 反查/创建标签，强制写入 tagId
6. **索引更新**：surveys 集合新增 `{tagId: 1, status: 1}` 复合索引

## Tech Stack

- **前端**：Vue 2 + uni-app + 微信小程序
- **后端**：uniCloud 支付宝云（MongoDB + 云函数）
- **说明**：纯后端+前端改造，无新增依赖

## Implementation Approach

### 策略

采用 DeepSeek 推荐的三阶段渐进式改造策略，但为了减少实施中的上下文切换，将**阶段 1（后端无感升级）和阶段 2（前端改造）在一次任务中完成**，阶段 3（收紧写入，移除 tagName 兼容路径）随后续业务迭代自然落地。

### 关键技术决策

1. **冗余引用模式**：tagId 做主引用 + tagName 做展示缓存。不搞纯引用（避免每次都要 JOIN），也不把标签嵌入问卷（避免更新扩散）。
2. **云函数兼容策略**：所有方法先兼容新旧两种入参（tagName 和 tagId），前端逐步切到 tagId 后旧路径自然废弃。
3. **前端统一传 tagId**：URL 参数改为 `?tagId=xxx`，结果页新增 `getTagInfo(tagId)` 调用获取标签 emoji/name/rarity 等展示信息。
4. **收藏/赞踩统一传 tagId**：收藏/赞踩接口改为接收 `tagId`，内部同步获取 tagName 写入缓存。
5. **导入自动创标签**：`importSurveys` 查不到 tagName 时自动创建标签兜底并设为 `draft` 状态，绝不写入无 tagId 的问卷。
6. **软删除策略**：标签不真删，只设 `status=disabled`，引用的所有 collections 数据保留。

### 性能与可靠性

- 查询性能不降反升：tagId（ObjectId）索引比 tagName（字符串）索引更紧凑，查询更快
- 结果页多一次 getTagInfo 查询（约 100-300ms），为获取标签展示信息可接受
- 迁移脚本应幂等（检查 tagId 已存在则跳过），验证关联有效性
- 云函数兼容新旧入参期间，旧路径走 tagName 字符串索引，性能不变

### 避免技术债

- 一次完成所有三个集合的改造，避免后续零散改动
- 前端 URL 参数统一改为 tagId，以后不用再改
- 保留 tagName 做缓存，避免未来为展示标签名而做不必要的反查

## Implementation Notes

### 云函数具体改动点

**`getSurveyByTag(params)`**

- 入参兼容：`params.tagId` 优先，其次 `params.tagName`（反查 tagId）
- 查询：`surveysCol.where({ tagId, status: 'active' })`
- 返回：保持不变

**`toggleFavorite(params)` / `voteTag(params)` / `getVoteStats(params)` / `getUserVote(params)` / `checkFavorites(params)`**

- 入参兼容：优先 `params.tagId`，其次 `params.tagName`
- 查询/写入：用 tagId 操作，同步写入 tagName 缓存
- 返回：保持不变（外部不感知变化）

**`getFavorites()`**

- 查询不变，返回数据中增加 `tagId` 字段
- favorites.vue 前端消费处改为使用 `item.tagId` 导航

**`importSurveys(params)`**

- 新增逻辑：批量收集 tagNames → 批量查 survey-tags 建 name→id 映射
- 查不到的 tagName：自动创建标签（status=draft，默认值填充）
- 写入 surveys 前强制补 tagId

**新增 `getTagInfo(params)`**

- 入参：`{ tagId }`
- 查询：`tagsCol.doc(tagId).get()`
- 返回：`{ _id, name, emoji, description, rarity, category }`

### 前端具体改动点

**`quiz-home.vue`**

- `goQuiz(tag)` → `goQuiz(tag._id)`，URL 传 `tagId`
- `goRandom()` → 从 allTags 取 `_id` 传 `tagId`
- `toggleFav(tagName)` → `toggleFav(tagId)` 加反查 `tagName`
- `loadFavorites()` → fav 数据结构增加 `tagId` 字段

**`search-page.vue`**

- `goQuiz(tag)` → `goQuiz(tag._id)` 或传入完整标签对象，URL 传 `tagId`
- `toggleFav(tagName)` → 从 allTags 反查 tagId 再调用
- 搜索结果列表也需持有 `_id`

**`answer-quiz.vue`**

- `onLoad`：`this.tag = decodeURIComponent(o.tag)` → `this.tagId = o.tagId`，同时保存 `this.tagName` 用于展示
- `loadSurvey()`：调 `getSurveyByTag({ tagId: this.tagId })`
- `goResult()`：URL 传 `tagId` 替代 `tag`

**`result.vue`**

- `onLoad`：从 `o.tagId` 取 tagId，调 `getTagInfo(tagId)` 获取 tagName/emoji
- 所有交互（收藏/投票/分享/重试）使用 tagId
- 分享路径中的 `?tag=xxx` 改为 `?tagId=xxx`

**`favorites.vue`**

- `getFavorites()` 返回数据结构改动后使用 `tagId` 导航
- `goQuiz(tag)` → `goQuiz(item.tagId)`

### 数据迁移脚本

在云函数中新增 `migrateFillTagId()` 方法：

1. 查询所有 `tagId: { $exists: false }` 的 surveys
2. 收集去重的 tagNames
3. 批量查 survey-tags 建 name→id 映射
4. 逐条更新 surveys：补 tagId，不存在的 tagName 记录到异常清单
5. 同样处理 favorites 和 likes
6. 返回统计（total, updated, skipped, errors）

### 边界情况处理

- `tagName` 唯一约束不能破坏，这是整个设计的前提
- 结果页分享路径从其他小程序打开时没有缓存，所以必须依赖 `getTagInfo` 云函数，不能依赖前端缓存
- 标签删除用软删除（status=disabled），不做物理删除
- Coze 导入数据只带 tagName 不带 tagId，所以导入逻辑必须是先查/创标签再写入问卷

## Directory Structure

### 修改的文件

```
uniCloud-alipay/
  database/
    surveys.schema.json             [MODIFY] 新增 tagId 字段，新增 {tagId:1,status:1} 索引
    survey-favorites.schema.json    [MODIFY] 新增 tagId 字段（非 required，向下兼容已有数据）
    survey-likes.schema.json        [MODIFY] 新增 tagId 字段（同上），更新唯一索引 userId+tagName 为 userId+tagId
  cloudfunctions/
    survey/
      index.obj.js                  [MODIFY] 重写：所有方法支持/优先使用 tagId，新增 getTagInfo()、migrateFillTagId()

pages-tools/
  quiz-home/
    quiz-home.vue                   [MODIFY] goQuiz 传 tagId，toggleFav 用 tagId，loadFavorites 兼容 tagId
  search/
    search-page.vue                 [MODIFY] 搜索/手风琴列表持有 _id，goQuiz 传 tagId，toggleFav 用 tagId
  answer-quiz/
    answer-quiz.vue                 [MODIFY] onLoad 取 tagId，loadSurvey 用 tagId，goResult 传 tagId
  result/
    result.vue                      [MODIFY] onLoad 取 tagId，调 getTagInfo，所有交互用 tagId
  favorites/
    favorites.vue                   [MODIFY] 使用 tagId 导航到答题页
```