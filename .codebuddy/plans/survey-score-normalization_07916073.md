---
name: survey-score-normalization
overview: 实现问卷系统的分值归一化处理和覆盖空隙检测机制，涉及创建公共工具模块、修改3个核心文件
todos:
  - id: create-survey-utils
    content: 新建 common/survey-utils.js，包含 normalizeDimensionScores 和 detectCoverageGaps 两个核心工具函数
    status: completed
  - id: fix-answer-quiz
    content: 修改 answer-quiz.vue：新增 normalizedScores 计算属性，matchedType 改用归一化分数匹配，维度得分显示归一化分
    status: completed
    dependencies:
      - create-survey-utils
  - id: fix-editor-overview
    content: 修改 editor-overview.vue：修复 range 按 dimensionIndex 过滤，空隙检测统一到 0-100 百分制空间
    status: completed
    dependencies:
      - create-survey-utils
  - id: fix-tools-cloud
    content: 修改 tools/index.obj.js：submitAnswer 中增加归一化步骤，用归一化分数匹配结果类型
    status: completed
---

对问卷系统进行两处核心改进：

1. **分值归一化处理**：将各维度的原始得分归一化为百分制（0-100分），以此作为结果类型判定的标准化依据。由于各维度题目数量和分值范围不一致，原始分不可直接比较，需要统一到同一量纲。

2. **覆盖空隙检测**：检测各维度在 0-100 的百分制空间中，是否存在未被任何结果类型的 range 定义覆盖的"空隙"区间。如果存在，则提示用户这些区间内的得分将匹配不到任何结果，需要补充定义。

## Tech Stack

- Vue2 + uni-app + uniCloud（现有项目，不引入新依赖）
- 前端共享模块：`common/survey-utils.js`
- 云函数内联工具函数：`tools/index.obj.js`

## Implementation Approach

### 1. 归一化算法设计

**公式**：`normalizedScore = Math.round(((rawScore - dimMinScore) / (dimMaxScore - dimMinScore)) * 100)`

- `dimMinScore`：该维度所有题目可选最低分之和
- `dimMaxScore`：该维度所有题目可选最高分之和
- 当 `dimMaxScore === dimMinScore`（题目无分差）时，归一化结果为 0
- 当维度无题目时，归一化结果为 0

### 2. 空隙检测算法设计

基于百分制空间（0-100）进行区间合并与空隙查找：

1. 从所有 resultTypes 中收集 `dimensionIndex === dIndex` 的 range（兼容平行数组格式，降级到下标访问）
2. 按 min 排序后合并重叠/相邻区间
3. 在 [0, 100] 空间上查找未被覆盖的区间
4. 计算覆盖率 = 1 - (gapSize / 101) * 100%

### 3. 四处修改

| 文件 | 操作 | 内容 |
| --- | --- | --- |
| `common/survey-utils.js` | 新建 | 归一化函数 + 空隙检测函数 |
| `answer-quiz.vue` | 修改 | matchedType 改用归一化分；显示归一化分 |
| `editor-overview.vue` | 修改 | 修复 range 访问方式；空隙检测统一到百分制 |
| `tools/index.obj.js` | 修改 | submitAnswer 增加归一化逻辑 |


## Implementation Notes

- **归一化复用已有逻辑**：`answer-quiz.vue` 中 `getScorePercent` + `getDimStat` 已实现归一化计算，但 `matchedType` 未使用。新建 `normalizedScores` 计算属性，在 `matchedType` 和显示中统一引用
- **editor-overview 的 range 访问**：当前使用 `type.ranges[dIndex]`（平行数组下标），editor-setting 也是平行数组。但数据库中存的是带 `dimensionIndex` 字段的格式，所以同时支持两种格式：优先用 `dimensionIndex` 过滤，没有则回退到数组下标
- **editor-overview 的 gaps 搜索空间**：从 `minScore~maxScore` 改为 `0~100`（百分制空间），因为 ranges 定义在 0-100
- **云函数端**：`submitAnswer` 中 `matchedType` 比较前先归一化，但保存到数据库的 `dimensionScores` 仍保留原始分（兼容已有数据）
- **不涉及数据库 schema 修改**，保持向后兼容

## Architecture Design

```
用户答题（原始分）
    │
    ▼
计算各维度原始分（rawScores）
    │
    ▼
归一化 --> normalizedScores（0-100）
    │
    +---> 前端 matchedType 匹配（answer-quiz.vue）
    +---> 云函数 matchedType 匹配（tools/index.obj.js）
    +---> 维度得分显示
         │
         ▼
editor-overview 空隙检测（基于 0-100 空间）
    │
    +---> 收集所有 dimensionIndex 匹配的 range
    +---> 合并区间
    +---> 在 [0,100] 上找空隙 --> 显示警告
```

## Directory Structure

```
common/
+-- survey-utils.js                          # [NEW] 问卷工具函数模块
    - normalizeDimensionScores(questions, dimensions, rawScores)
      根据题目和维度的分值配置，将原始分归一化为百分制
      返回 { dIndex: normalizedScore }
    - detectCoverageGaps(dIndex, resultTypes)
      检测指定维度在百分制空间中的覆盖空隙
      返回 { gaps: [{min,max}], coverageRate: number }

pages-tools/
+-- answer-quiz/
|   +-- answer-quiz.vue                      # [MODIFY]
|       - 新增 normalizedScores 计算属性（归一化分数）
|       - matchedType 改用 normalizedScores 进行比较
|       - 维度得分显示改用归一化分数
|       - 模板中的 dimensionScores 引用改为 normalizedScores
|
+-- editor-overview/
    +-- editor-overview.vue                  # [MODIFY]
        - dimensionStats 中的 range 收集改为支持 dimensionIndex 过滤
        - gaps 搜索空间从 minScore~maxScore 改为 0~100
        - coverageRate 重新基于百分制空间计算
        - getDimScoreRange 显示改为百分制区间 "0 - 100"
        - 结果卡片中增加关联维度的名称显示

uniCloud-alipay/cloudfunctions/tools/
+-- index.obj.js                             # [MODIFY]
    - submitAnswer 中新增归一化步骤
    - matchedType 比较使用归一化分数
    - 保存到数据库的 dimensionScores 保持原始分（兼容性）
```