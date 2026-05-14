---
name: importSurveys支持标签emoji与分类
overview: 修改 importSurveys，支持从问卷 JSON 中读取 tagEmoji 和 tagCategory，自动填充到新建标签中
todos:
  - id: read-importSurveys
    content: 读取云函数 importSurveys 当前代码确认精确行号
    status: completed
  - id: modify-auto-create
    content: 修改自动创建标签逻辑：反查问卷数据的 tagEmoji/tagCategory
    status: completed
    dependencies:
      - read-importSurveys
  - id: check-importTags
    content: 检查 importTags 函数是否需要同步调整
    status: completed
    dependencies:
      - read-importSurveys
---

## 需求

修改 `importSurveys` 云函数，使其在自动创建标签时，读取问卷数据中携带的 `tagEmoji` 和 `tagCategory` 字段，替代硬编码的默认值。

## 核心功能

1. `importSurveys` 导入问卷时，对每个**新创建**的标签，从同批次问卷数据中反查对应的 `tagEmoji` 和 `tagCategory`
2. 字段名兼容：支持 `tagEmoji` / `emoji` 和 `tagCategory` / `category` 两种写法
3. 已存在的标签不受影响（仅对新创建标签生效）

## 技术栈

- Vue 2 + uni-app + uniCloud（支付宝小程序）
- 修改文件：`uniCloud-alipay/cloudfunctions/survey/index.obj.js`
- 修改函数：`importSurveys`（第 410-465 行）

## 实现方案

### 修改点

仅修改第 431-444 行自动创建标签部分的逻辑：

**当前代码（硬编码默认值）：**

```js
const addRes = await tagsCol.add({
    name,
    status: 'published',
    category: '',
    emoji: '📋',
    ...
})
```

**改成：**

```js
// 从所有问卷中找到第一个匹配 tagName 的记录，取其标签信息
const firstMatch = surveys.find(s => s.tagName === name)
const tagEmoji = firstMatch?.tagEmoji || firstMatch?.emoji || '📋'
const tagCategory = firstMatch?.tagCategory || firstMatch?.category || ''
const addRes = await tagsCol.add({
    name,
    status: 'published',
    category: tagCategory,
    emoji: tagEmoji,
    ...
})
```

### 设计决策

- **不修改已存在标签**：only new tags
- **字段名兼容**：`tagEmoji` / `emoji`、`tagCategory` / `category` 都认，给 Coze prompt 留灵活性
- **第一个匹配优先**：同一 tagName 多份问卷时，取第一条提供的值