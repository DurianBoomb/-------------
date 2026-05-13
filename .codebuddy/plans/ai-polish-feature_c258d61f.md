---
name: ai-polish-feature
overview: 开发 AI 润色功能：新建云函数 ai/index.obj.js，修改 editor-setting.vue 和 editor-quz.vue 增加 AI 描述区、润色按钮、自动生成题目、上一步数据保全等功能
todos:
  - id: phase1-cloud-function
    content: 新建 ai 云函数：index.obj.js + package.json，实现 Coze API 调用与字段映射
    status: completed
  - id: phase2-editor-quz
    content: 改造 editor-quz.vue：自动生成题目的加载遮罩、润色按钮、上一步、全部润色、两行底部布局
    status: completed
    dependencies:
      - phase1-cloud-function
  - id: phase3-editor-setting
    content: 改造 editor-setting.vue：折叠AI描述区、维度/结果类型润色按钮（单+全部）、callAI封装
    status: completed
    dependencies:
      - phase2-editor-quz
  - id: phase4-integration
    content: 完整流程联调测试：全链路走测、边界条件、回退数据保全、storage一致性
    status: completed
    dependencies:
      - phase3-editor-setting
---

## 产品概述

在现有问卷编辑器中，为问卷设定（维度/结果类型）和题目设计两个环节引入 AI 润色能力。用户可随时调用 AI 优化内容，保持完全控制权。

## 核心功能

1. 问卷设定页新增折叠式 AI 描述区，用户填写额外指导信息
2. 维度列表每个条目新增 [润色] 按钮，底部新增 [全部润色] 按钮
3. 结果类型列表每个条目新增 [润色] 按钮，底部新增 [全部润色] 按钮
4. 题目编辑页首次进入时自动调用 AI 生成 15 道题（加载遮罩）
5. 题目卡片上方新增 [润色] 按钮和 [全部润色] 按钮
6. 每个选项新增 [润色] 按钮
7. 底部新增 [上一步] 按钮（带数据保全返回）
8. 云函数封装 Coze API 调用，统一路由 8 个 action 到 2 个工作流

## 技术方案

### 1. 云函数：AI 路由层 (uniCloud-alipay/cloudfunctions/ai/index.obj.js)

- 沿用现有云对象的 `module.exports` 模式（同 tools/index.obj.js）
- 统一入口 `polishSurvey({ action, params })`，通过 `ACTION_TO_WORKFLOW` 路由到对应 Coze 工作流
- `callCoze` 内部做字段映射转换（前端字段名 → Coze 字段名），避免前端感知 Coze 命名
- JSON.parse 加 try-catch + 正则兜底
- Coze 返回结构预处理，统一输出 `{ errCode: 0, data: {...} }`

### 2. 前端：editor-setting.vue (Vue2)

- data 新增 `aiDescription`、`showAIDesc`、`aiGenerating`、`polishCooldown`
- 折叠式 AI 描述区（展开/收起动画）
- 维度条目操作区新增 [润色] 按钮（绿色主题，同现有删除按钮风格）
- 结果类型条目操作区新增 [润色] 按钮
- 维度/结果类型底部各新增 [全部润色] 按钮
- `callAI(action, params)` 统一封装防抖 + loading + toast

### 3. 前端：editor-quz.vue (Vue2)

- data 新增 `aiGenerating`、`polishCooldown`、`loadingTitle`、`loadingMessage`
- `onLoad` 检测首次进入且无题目 → `autoGenerateQuestions()`
- 加载遮罩：全屏半透明遮罩 + "AI 正在生成题目..."
- 题目卡片右上角新增 [润色] 按钮（`polishQuestion`）
- 选项输入框右侧新增 [润色] 按钮（`polishOption`）
- 底部改为两行按钮布局
- `goBack()` 保存数据到 `editor_quz_init_data` 后 `navigateBack`

### 4. 专家决策方案

| 决策项 | 方案 |
| --- | --- |
| 字段映射 | 云函数 `callCoze` 做映射，前端字段名无需对齐 Coze |
| storage key | 统一 `editor_quz_init_data` |
| aiDescription 传递 | editor-setting → storage → editor-quz 完整链路 |
| 云函数入口 | 统一 `polishSurvey`，无冗余方法 |
| 按钮 loading | 每个按钮独立控制，用 `polishingIndex` 字符串标记 |
| JSON 解析 | try-catch + 正则移除 markdown 代码块 |
| 底部布局 | 分两行：上 `[←上一步] [✨全部润色]` 下 `[+添加题目] [完成设计]` |


### 5. 目录结构

```
uniCloud-alipay/cloudfunctions/ai/
├── index.obj.js    [NEW] AI 云函数：polishSurvey/callCoze/ACTION_TO_WORKFLOW
├── package.json    [NEW] 云函数配置

pages-tools/editor-quz/editor-quz.vue
    [MODIFY] 新增 AI 生成+润色+上一步

pages-tools/editor-setting/editor-setting.vue
    [MODIFY] 新增 AI 描述区+润色按钮
```

## Agent Extensions

### MCP

- **Figma**: 本功能不涉及 Figma 设计稿导入，暂不使用。

### Skill

- 本功能不涉及 PPT/XLSX/DOCX/PDF 文件生成，无需使用。

### SubAgent

- **code-explorer**: 已用于代码探索阶段，后续开发阶段无需再次调用。