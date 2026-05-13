---
name: 方案C落地——entity-data库与Coze管线改造
overview: 按方案 C 五步优先级，从 entity-data.json 原料库起步，到 Coze 提示词改造，再到校验脚本和数据库对接，逐项落地。
todos:
  - id: create-entity-data-library
    content: 创建 entity-data/ 目录并编写全部 12 个实体的档案 JSON 文件（烤肠、仙人掌、手机电量、电路板、奶茶、落叶、一次性筷子、快递纸箱、充电宝、空气炸锅、地瓜、香蕉），每个文件包含 entity/categories/features 四字段，features 覆盖 physical/appearance/lifecycle/scenarios 四类
    status: completed
  - id: write-feature-extraction-prompt
    content: 编写 docs/问卷与后端/Coze提示词/实体特征提取——Coze工作流提示词.md，纯描述任务，输入标签名输出结构化实体特征表 JSON，不涉及维度生成和映射
    status: completed
    dependencies:
      - create-entity-data-library
  - id: rewrite-survey-generation-prompt
    content: 新建 docs/问卷与后端/Coze提示词/问卷生成——Coze工作流提示词（轻量版）.md，输入改为 { tagName, featureTable, categories }，删除原重写版的"解剖实体"和"品类树自检"步骤，保留人设+写题风格+结构约束
    status: completed
    dependencies:
      - create-entity-data-library
  - id: write-validation-script
    content: 编写 scripts/validate-survey.js，遍历 entity-data/ 作为参考库，对问卷 JSON 执行四项校验（结构完整性、维度语义告警、品类白名单、多源域混合），输出校验报告 JSON
    status: completed
    dependencies:
      - create-entity-data-library
  - id: create-database-init-data
    content: 编写 uniCloud-alipay/database/init_data/ 下的初始数据 JSON（survey-categories 约 6 个分类 + survey-tags 首批 30-50 个标签），以及 scripts/seed-database.js 导入脚本，使用 uniCloud 的 importObject 方式写入云数据库
    status: completed
    dependencies:
      - write-validation-script
---

实施方案 C——混合管线落地。覆盖五个优先级阶段：

1. 创建 entity-data.json 实体档案库（原料基础）
2. 编写 Coze 实体特征提取工作流提示词（新增工作流）
3. 将当前问卷生成提示词改造为方案 C 轻量版
4. 编写本地入库校验 Node.js 脚本
5. 编写数据库初始化数据 + 种子脚本

所有工作直接在项目根目录下完成，不涉及前端 UI 改动，不涉及 Coze 平台操作（只产出提示词文档）。

## 技术栈

- Vue 2 + uni-app + uniCloud (支付宝云)
- Coze 工作流（外部 AI 平台，本项目只产出提示词文档）
- Node.js（本地校验脚本，独立运行）

## 实现方案

### 架构设计

方案 C 混合管线采用"Coze 做发散翻译，自家代码做结构校验"的分工原则：

```
[Coze 侧]
  标签批量生成工作流（已有，维持）
     |
  实体特征提取工作流（新增）
     | 输出 entity-data.json 原料
     v
  问卷生成工作流（改为轻量版）
     | 输入 { tagName, featureTable, categories }
     | 不需自己构建实体特征，照着数据画瓢
     v
[校验侧]
  本地校验脚本（新增）
     | 四项检查：结构/语义/品类/多源域
     | 输出校验报告 JSON
     v
  人工确认后 → 导入数据库
```

### 目录结构

```
项目根/
├── entity-data/                         [NEW] 实体档案库
│   ├── 烤肠.json
│   ├── 仙人掌.json
│   ├── 手机电量.json
│   ├── 电路板.json
│   ├── 奶茶.json
│   ├── 落叶.json
│   ├── 一次性筷子.json
│   ├── 快递纸箱.json
│   ├── 充电宝.json
│   ├── 空气炸锅.json
│   ├── 地瓜.json
│   └── 香蕉.json
├── docs/
│   └── 问卷与后端/
│       └── Coze提示词/
│           ├── 标签批量生成——Coze工作流提示词.md  [KEEP] 已有，不变
│           ├── 实体特征提取——Coze工作流提示词.md    [NEW] 新增
│           └── 问卷生成——Coze工作流提示词（轻量版）.md [NEW] 替代重写版
├── scripts/                             [NEW] 本地工具脚本目录
│   ├── validate-survey.js               [NEW] 入库校验脚本
│   └── seed-database.js                 [NEW] 数据库种子脚本
└── uniCloud-alipay/database/
    ├── survey-categories.schema.json     [EXISTS] 已有，不变
    ├── survey-tags.schema.json           [EXISTS] 已有，不变
    ├── surveys.schema.json               [EXISTS] 已有，不变
    └── survey-answers.schema.json        [EXISTS] 已有，不变
    └── init_data/                        [NEW] 初始数据
        ├── survey-categories.json        [NEW] 分类初始数据
        └── survey-tags.json              [NEW] 标签初始数据
```

## 关键数据结构和接口

### 实体档案 JSON 格式（entity-data/*.json）

```typescript
interface EntityData {
  entity: string         // 实体名，如"烤肠"
  categories: string[]   // 品类谱系，如 ["纯肉肠", "淀粉肠", ...]
  features: {
    physical: string[]   // 物理构成特征
    appearance: string[] // 外部特征
    lifecycle: string[]  // 生命周期
    scenarios: string[]  // 典型场景/生态位
  }
}
```

### 校验脚本检查规则

```typescript
interface ValidationReport {
  survey: object       // 待校验的问卷 JSON
  pass: boolean        // 是否全部通过
  checks: {
    structure: { pass: boolean, errors: string[] }   // 字段/维度数/题数
    dimSemantic: { pass: boolean, warnings: string[] } // 维度语义告警
    categoryWhitelist: { pass: boolean, errors: string[] } // 品类白名单
    multiSource: { pass: boolean, warnings: string[] } // 多源域混合
  }
}
```

### Coze 特征提取工作流输入输出

- 输入: `{ tagName: "确诊为烤肠" }`
- 输出: `{ entity: "烤肠", categories: [...], features: {...} }`

### Coze 问卷生成工作流（轻量版）输入输出

- 输入: `{ tagName: "确诊为烤肠", featureTable: {...}, categories: [...] }`
- 输出: `{ tag, title, dims, qs, resultTypes }`

## 实施顺序说明

五个阶段有明确的原料依赖关系：

- 阶段 1（entity-data 库）是阶段 2/3/4 的原料，必须最先做
- 阶段 2（特征提取提示词）和阶段 3（问卷提示词改造）可以独立进行
- 阶段 4（校验脚本）需参考 entity-data 的 JSON schema
- 阶段 5（数据库种子）依赖 Coze 产出的 mock 数据，放在最后

# Agent Extensions

（本实施计划不涉及任何 Agent Extensions——主要产出为 JSON 数据文件、Markdown 文档和独立运行的 Node.js 脚本，不需要 Figma、浏览器自动化或任何外部集成。）