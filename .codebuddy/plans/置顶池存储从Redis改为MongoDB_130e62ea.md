---
name: 置顶池存储从Redis改为MongoDB
overview: 将文档中所有 Redis Sorted Set / Hash 相关的存储设计修改为 MongoDB 方案，涉及 2.3/4.2/4.3/4.4/4.6/4.7/8.3/9 共 8 个章节。
todos:
  - id: rewrite-section-2-3
    content: 重写 2.3 节技术栈建议：改为 uniCloud 云函数 + MongoDB + uni-config-center + 客户端 Canvas
    status: completed
  - id: rewrite-section-4-2
    content: 重写 4.2 节数据模型：Sorted Set + Hash 改为单 MongoDB 集合，定义文档结构和索引
    status: completed
    dependencies:
      - rewrite-section-2-3
  - id: rewrite-section-4-3
    content: 改写 4.3 节生命周期管理：Redis 操作替换为 MongoDB CRUD + TTL 索引，增补光环退场更新
    status: completed
    dependencies:
      - rewrite-section-4-2
  - id: rewrite-sections-4-4-4-6-4-7
    content: 改写 4.4/4.6/4.7 权重算法+抽取逻辑+过期清理：ZRANGEBYSCORE 改为全量查+内存采样，TTL 兜底清理
    status: completed
    dependencies:
      - rewrite-section-4-2
  - id: update-sections-8-3-and-9
    content: 补充 8.3 节 uni-config-center 方案，更新 9 节附录待办项
    status: completed
  - id: cleanup-duplicate-tables
    content: 清理文档中 6 处重复表格，仅保留 markdown 版本
    status: completed
---

## 需求

修改文档 `docs/问卷置顶系统/问卷置顶系统（草稿）.md`，将"置顶池主存储"的设计从 Redis Sorted Set 全面改为 MongoDB 方案。

## 范围界定

- **只改实现路径，不改设计意图**。文档的叙事设计、权重分层逻辑、用户流程、前端展示设计均保持不变。
- **涉及章节**：2.3 技术栈建议、4.2 数据模型、4.3 生命周期管理、4.4 权重算法、4.6 抽取逻辑、4.7 过期清理、8.3 参数管理方式、9 附录待办
- **不涉及的章节**：模块一（曝光资历系统，无 Redis 依赖）、模块三（候场区，5.2 已写 MongoDB 方案）、模块四（置顶栏，纯前端）、模块五（战绩单，无 Redis 依赖）
- **附带的清理**：文档中存在 6 处重复表格（原始 markdown 表格 + 纯文本复制），一并清理。

## 技术方案

### 修改策略

基于现有项目技术栈（uniCloud 支付宝云 + MongoDB 5.0 + 无状态云函数 + uni-config-center），对文档中各章节的 Redis 依赖进行替换。

### 各章节具体修改方案

#### 2.3 技术栈建议 — 完全重写

**原文**：推荐 Egg.js/Nest.js + Redis + MySQL/PostgreSQL
**改为**：

- 后端：uniCloud 支付宝云云函数（Node.js / 云对象）
- 数据库：MongoDB 5.0 兼容（uniCloud 云数据库），用于置顶池存储、候场区状态、曝光资历、战绩单
- 配置管理：uni-config-center（已有实践的复用：Coze API 配置即用此方式）
- 长图生成：客户端 Canvas（已有实践：结果页雷达图 Canvas 绘制）
- 广告回调：前端 wx.onRewarded() 触发后调云函数
- 缓存策略：MVP 阶段不需要单独缓存，MongoDB 全量查询 + 内存加权采样即可（数据量几百万级别内无性能瓶颈）

#### 4.2 数据模型 — 重写

**原文**：Redis Sorted Set（主存储）+ Redis Hash（附属字段）
**改为**：单 MongoDB 集合 `pin-pool`，每条问卷一个完整文档

```javascript
{
  _id: '问卷唯一标识',
  userId: '所属用户标识',
  weight: 100,              // 当前综合权重，由权重算法计算并更新
  haloActive: true,         // 登场光环标记
  haloRoundsUsed: 0,        // 光环已服务刷新次数
  senioritySnapshot: 3,     // 入池时资历快照
  isGreenChannel: false,    // 是否绿色通道入池
  createdAt: Date.now(),    // 入池时间戳
  expireAt: Date.now() + 15 * 60 * 1000  // TTL 自动过期时间
}
```

**索引**：

- `expireAt` — TTL 索引，自动清理过期文档
- `userId` — 普通索引，用于抽取时归属分层判断

#### 4.3 生命周期管理 — 改写

**原文**中出现 3 处 Redis 操作：

- "写入 Sorted Set" → `db.collection('pin-pool').add(doc)`
- "记录附属信息至 Hash" → 所有字段在一个文档内，无需单独写入
- "从 Sorted Set 和 Hash 中删除" → `db.collection('pin-pool').doc(id).remove()`（或 TTL 索引自动处理）

光环退场时：`db.collection('pin-pool').doc(id).update({ haloActive: false })`

#### 4.4 权重算法 — 改写

**原文**："返回最终权重值，写入 Sorted Set 的 Score"
**改为**：计算完毕后 `db.collection('pin-pool').doc(id).update({ weight: computedWeight })`

权重算法公式建议从四层合并为一层复合公式（设计建议，非强制）：

```
weight = base(50)
  × (own ? OWN_MULTIPLIER : 1.0)       // 归属分层 effect
  × reverseCompensation[seniorityLevel] // 反向补偿
  × (1 + randomJitter)                  // 随机扰动
```

#### 4.6 抽取逻辑 — 重写

**原文**：基于 Sorted Set Score 的 ZRANGEBYSCORE 加权随机采样
**改为**：MongoDB 全量查询 + 内存加权随机采样

```
1. 查询：db.collection('pin-pool')
     .where({ expireAt: > now })
     .get()
2. 内存中构建累计权重区间：
     const pool = result.data
     const totalWeight = pool.reduce((s, i) => s + i.weight, 0)
     let pick = Math.random() * totalWeight
     for (item of pool) {
       pick -= item.weight
       if (pick <= 0) return item
     }
3. 去重：抽取 5 份时，选中后从数组移除再继续下一轮
```

#### 4.7 过期清理 — 改写

**原文**：惰性删除（抽取前遍历 Sorted Set）+ 定时任务每 30 秒扫描清理
**改为**：

- 惰性删除：抽取前 `where({ expireAt: > now })` 自然过滤过期文档
- TTL 索引兜底：MongoDB 自动删除 expireAt 超时的文档，无需手动清理
- 定时任务（可选）：若需要战绩单生成流程配合，可添加 `uniCloud.timer` 定时触发器（支付宝云支持），每 30 秒扫描并移除过期待 + 触发战绩单生成

#### 8.3 参数管理方式 — 补充

**原文**：配置中心、云端开关或本地常量文件
**补充**：推荐 uni-config-center（项目已有实践）。在 `uni-config-center/pin-system/config.json` 中统一管理所有参数，云函数内通过 `require('uni-config-center')({ pluginId: 'pin-system' }).config()` 读取。

#### 9 附录待办 — 更新

- 待办 1（候场区存储方案 Redis 还是数据库）：已解决，结论为 MongoDB
- 增加一条待办：**创建 pin-pool 集合的 Schema 文件，定义 TTL 索引**
- 删除"技术栈待定"相关的模糊描述

### 重复表格清理

文档中 lines 18-43、158-172、216-229、347-372、454-471、662-683 是原始 markdown 表格的纯文本复制，删除重复版本，保留 markdown 表格。