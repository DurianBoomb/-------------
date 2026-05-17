---
name: 更新问卷置顶系统设计文档和工作计划
overview: 根据讨论结论，系统性地修复和更新《问卷置顶系统——设计文档.md》和《工作计划.md》两篇文档中涉及的 9 个问题
design:
  styleKeywords:
    - none
  fontSystem:
    fontFamily: system-ui
    heading:
      size: "-"
      weight: .nan
    subheading:
      size: "-"
      weight: .nan
    body:
      size: "-"
      weight: .nan
  colorSystem:
    primary:
      - "-"
    background:
      - "-"
    text:
      - "-"
    functional:
      - "-"
todos:
  - id: update-design-doc-pinpool-model
    content: 更新设计文档 §4.2 pin-pool 数据模型（_id改自生成、新增surveyId、删除_id用问卷标识的冲突描述）
    status: completed
  - id: update-design-doc-weight-strategy
    content: 更新设计文档 §4.3 权重刷新策略（删全量重算，改入池时写入+抽取时只读）和 §4.4（光环不叠加归属加成）
    status: completed
    dependencies:
      - update-design-doc-pinpool-model
  - id: update-design-doc-enterpool-logic
    content: 更新设计文档 §4.5 入池逻辑（补充 queueToPool 方法）和 §4.6 抽取逻辑（直接读weight）
    status: completed
    dependencies:
      - update-design-doc-weight-strategy
  - id: update-design-doc-survey-queue
    content: 更新设计文档 §5.2 survey-queue 数据模型（_id改自增、userId变普通字段+索引、移单用户单记录约束），§5.3（闪屏占位mock），§5.4（接口增queueId参数）
    status: completed
    dependencies:
      - update-design-doc-enterpool-logic
  - id: update-design-doc-appendix
    content: 更新设计文档 §8.4 广告回调（handleAdReward增queueId参数）和 §9 附录待讨论事项
    status: completed
    dependencies:
      - update-design-doc-survey-queue
  - id: update-work-plan
    content: 更新工作计划 §0.1（survey-queue schema）、§2.1（queueToPool）、§3.3（日志占位）、§3.4（闪屏占位）、§6.3（回归测试清单）
    status: completed
    dependencies:
      - update-design-doc-appendix
---

## 任务要求

基于审阅讨论结论，更新《问卷置顶系统——设计文档》和《工作计划》两份文档。修正审阅中发现并已确认处理方案的 9 个问题。

## 修改覆盖范围

### 设计文档核心修改点

1. **§4.2**: pin-pool 的 `_id` 从"问卷唯一标识"改为"自动生成 `pin_时间戳_随机`"，新增 `surveyId` 独立字段
2. **§4.3**: 权重刷新策略矛盾修复——删除"每次抽取前全量重算"，改为"入池时计算并写入，抽取时只读不重算"
3. **§4.4**: 权重算法层级一补充——光环命中后直接返回极高值，不进入后续分层，不叠加归属加成
4. **§4.5**: 入池逻辑补充 `queueToPool` 候场转置顶独立入口
5. **§5.2**: survey-queue 数据模型重构——`_id` 从 userId 主键改为自增 ID，userId 变普通字段+索引，移除"单用户单记录"约束
6. **§5.3**: 绿色通道闪屏标注为占位 mock，组件路径 `components/green-channel-splash/`
7. **§5.4**: 候场区接口入参增加 `queueId` 以支持多条候场记录
8. **§8.4**: 广告回调 `handleAdReward` 的方法签名增加 `queueId` 参数，`queue_accel` 场景说明更新
9. **§9**: 附录待讨论事项更新（已解决项标记、新增允许多条排队的说明）

### 工作计划核心修改点

1. **§0.1**: survey-queue schema 行 `_id(userId)` → `_id(auto), userId(indexed)`
2. **§2.1**: 入池接口新增 `queueToPool` 方法说明
3. **§3.3**: 候场区交互补充日志滚动行为的占位 mock 说明
4. **§3.4**: 绿色通道闪屏补充占位 mock 说明
5. **§6.3**: 回归测试清单补充"候场区允许多条同时排队"的测试项

## 实现方式

本次任务为纯文档更新，使用 markdown 格式直接修改两份 .md 文件。

## 修改策略

1. **设计文档 (171 项修改点)**：逐项定位原文位置，用讨论确定的结论替换或补充内容
2. **工作计划 (5 项修改点)**：同步设计文档的改动到对应阶段章节

## 性能考量

无，文档不涉及运行性能。

本次任务不涉及 UI 设计变更，仅在技术文档中标注两个占位 mock 组件的路径和说明。