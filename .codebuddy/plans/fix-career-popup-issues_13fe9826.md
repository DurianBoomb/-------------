---
name: fix-career-popup-issues
overview: 修复战绩单的4个问题：1) 战绩无法签收 2) 弹窗弹错页面 3) 多到期只弹一个 4) 弹窗样式不一致
todos:
  - id: fix-career-detail-sign
    content: 在 career-detail.vue 的 loadRecord() 成功加载后追加 markCareerAsRead 调用，实现进入详情页即签收
    status: completed
  - id: remove-index-career-popup
    content: 从 index.vue 删除战绩弹窗所有代码（模板、data、onShow 调用、methods、CSS）
    status: completed
---

## 用户需求

修复战绩签收流程并统一弹窗位置，解决四个关联问题：

1. **战绩无法签收**：进入 career-detail 详情页后，槽位仍显示"待签收"而非释放为"闲置"
2. **弹窗位置错误**：战绩通知弹窗出现在 index.vue（工具集首页），实际应只在 quiz-home.vue（问卷首页）弹出
3. **多档案只弹一个**：index.vue 每次 onShow 只展示第一条未读档案，收起后不自动展示下一条
4. **弹窗样式不一致**：index.vue 使用橙色调简化版弹窗，与 quiz-home.vue/pin-migration-test.vue 的红色头"15分钟名气管理局"设计不一致

## 核心功能

- career-detail.vue 加载档案后自动调用 markCareerAsRead 完成签收，释放对应槽位
- 从 index.vue 彻底移除战绩弹窗的所有代码，弹窗统一由 quiz-home.vue 管理（已有完整的多档案依次弹出逻辑）

## 技术方案

### 改动1：career-detail.vue - 加载后自动签收

在 `loadRecord()` 方法中，成功获取档案数据后追加调用 `pin-system.markCareerAsRead()` 云对象方法。无论用户从弹窗点"签收"还是从历史页点"待签收"槽位进入详情页，都会触发签收，后端会：

- 从 `unreadCareerIds` 数组中移除该 careerId
- 若数组为空则置 `hasUnread = false`
- 找到对应槽位（status=claimable + 匹配 pinId）并重置为 idle

改动位置：`loadRecord()` 第 141 行 `this.record = res.data[0]` 之后，追加 markCareerAsRead 调用（静默执行，不阻塞页面渲染，不抛错阻塞用户）。

### 改动2：index.vue - 移除战绩弹窗

删除以下所有与战绩弹窗相关的代码：

| 区域 | 行号 | 删除内容 |
| --- | --- | --- |
| 模板 | 93-121 | 整块 `career-overlay` 弹窗 |
| data | 133-134 | `showCareerPopup`、`careerPopupData` |
| onShow | 155 | `this.checkUnreadCareers()` 调用 |
| methods | 164-199 | `checkUnreadCareers()`、`viewCareerDetail()`、`dismissCareer()`、`formatK()` |
| CSS | 338-378 | `.career-overlay` ~ `@keyframes popIn` 整块弹窗样式 |


`quiz-home.vue` 已具备完整的 `pendingCareers` + `careerIndex` + `showNextCareer()` 多档案依次弹出逻辑，无需额外修改。

### 实现注意事项

- `markCareerAsRead` 在 career-detail 中静默调用，失败不阻塞页面，避免因网络波动导致用户看不到档案内容
- index.vue 删除弹窗后，`@keyframes fadeIn` 和 `@keyframes popIn` 也一并删除（仅弹窗使用）
- `@keyframes foxBreathe`、`@keyframes slideUpElastic` 等非弹窗动画保留不动