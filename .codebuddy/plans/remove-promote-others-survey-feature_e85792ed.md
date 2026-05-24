---
name: remove-promote-others-survey-feature
overview: 砍掉推广功能：置顶操作仅允许问卷创建者本人使用，非创建者无法置顶别人的问卷。涉及 result.vue 前端按钮显隐逻辑和 pin-system 云函数权限校验。
todos:
  - id: fix-result-button
    content: 修改 result.vue：置顶按钮显隐条件改为 isCreator，按钮文字简化为固定"看广告置顶"
    status: completed
  - id: add-creator-check
    content: 在 pin-system checkPinEligibility 方法开头添加问卷创建者身份校验，非创建者直接拒绝
    status: completed
  - id: simplify-enterpool
    content: 简化 enterPoolImpl 中 pinType 和 surveyAuthor 逻辑，移除 promote 分支
    status: completed
    dependencies:
      - add-creator-check
  - id: simplify-queuetopool
    content: 简化 queueToPool 中 pinType 和 surveyAuthor 逻辑，移除 promote 分支
    status: completed
    dependencies:
      - add-creator-check
---

## 需求概述

砍掉整个推广功能（"助力推广"——非创建者替他人问卷置顶），将置顶能力限定为仅创建者可置顶自己的问卷。

## 核心改动

1. **前端结果页**：置顶按钮仅对问卷创建者本人显示，按钮文字统一为"看广告置顶"
2. **云函数入口校验**：在 `checkPinEligibility` 中增加创建者身份校验，非创建者调用直接拒绝
3. **云函数内部逻辑简化**：`enterPoolImpl` 和 `queueToPool` 中移除 `pinType` 动态判定和 promotion 专用分支，全量固化 `pinType='self'`

## 技术栈

- 前端：Vue2 + uni-app（微信小程序）
- 后端：uniCloud 云对象（pin-system）
- 数据库：uniCloud 数据库（pin-pool、survey-queue、career-records 等，schema 不动）

## 实现方案

### 前端改动（result.vue）

- 第56行：`v-if="creatorId"` 改为 `v-if="isCreator"`，按钮仅问卷创建者可见
- 第57行：文本 `{{ isCreator ? '看广告置顶' : '助力推广' }}` 改为固定 `看广告置顶`

### 云函数改动（pin-system/index.obj.js）

**checkPinEligibility（第1224-1283行）**
在去重检查之前，新增第0步：查询问卷的 `creatorId` 字段。若 `creatorId` 存在且不等于当前 `this.uid`，返回 `NOT_CREATOR` 错误（`errMsg: '仅问卷创建者可置顶'`）。官方问卷（`creatorId` 为 null）同样拒绝，复用现有的 `OFFICIAL_SURVEY` 逻辑。

**enterPoolImpl（第375-391行）**
将：

```js
const pinType = creatorId === uid ? 'self' : 'promote'
// ...promote 分支的 surveyAuthor 查询
```

简化为：

```js
const pinType = 'self'
const surveyAuthor = user.nickname || ''
```

因为上层 `checkPinEligibility` 已拦截非创建者，此处不再可能走到 promote 路径。

**queueToPool（第530-541行）**
同上，将 `pinType` 固化为 `'self'`，`surveyAuthor` 固化为当前用户昵称，删除 promote 分支的额外查询。

### 不需要修改的部分

- `getSurveyDetail` 的 `isCreator` 返回值：保留，用于 UI 按钮显隐判定
- 数据库 schema（`career-records.schema.json` 中 `pinType` 枚举 `["self","promote"]`）：保留，历史 promote 记录兼容
- `getPoolSnapshot`、`getSlotSnapshots`、career-records 归档逻辑：保留 `pinType` 字段的读写，新记录永远为 `'self'`
- `common/ad-utils.js`：无需修改，`playAd` 函数本身不区分 self/promote

## 架构影响

- 置顶池中不再出现 `pinType='promote'` 的记录（仅存量数据保留）
- 前端不再需要根据 `isCreator` 区分按钮文案和样式
- 后端入口校验确保了安全边界，即使前端被绕过，云函数也会拒绝非创建者的置顶请求