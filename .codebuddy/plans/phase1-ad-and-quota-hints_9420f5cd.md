---
name: phase1-ad-and-quota-hints
overview: 阶段一：广告未实装提示 + Coze 额度耗尽处理。涉及 4 个文件，6 处改动。
todos:
  - id: ad-utils-modal
    content: 修改 common/ad-utils.js：playAd() 中 toast 改为 Modal，支持无 surveyId 场景（跳过 pin 检查直接弹 Modal）
    status: completed
  - id: coze-429-detection
    content: 修改 uniCloud-alipay/cloudfunctions/survey/index.obj.js：generateFromCoze 中检测 res.statusCode === 429，返回 COZE_QUOTA_EXHAUSTED
    status: completed
  - id: search-playad-coze
    content: 修改 pages-tools/search/search-page.vue：submitCustomTag 中 await playAd() + doGenerate 新增 COZE_QUOTA_EXHAUSTED 分支
    status: completed
    dependencies:
      - ad-utils-modal
      - coze-429-detection
  - id: preview-coze
    content: 修改 pages-tools/survey-preview/survey-preview.vue：regenerate() 新增 COZE_QUOTA_EXHAUSTED 分支
    status: completed
    dependencies:
      - coze-429-detection
---

## 用户需求

执行发版前工作计划**阶段一**：广告未实装提示 + 扣子额度用完提示。共 6 个子任务，涉及 4 个文件。

## 核心功能

### 广告未实装提示

- 用户点击任何"看广告"入口时，弹出 Modal 告知"广告功能尚未实装，本次生成免费，请耐心等待 AI 为您创作问卷~"
- 用户确认后继续走原有业务逻辑；取消则不执行

### 扣子额度用完提示

- Coze API 返回 HTTP 429 时，云函数统一返回 `COZE_QUOTA_EXHAUSTED` 错误码
- 前端在生成问卷和重新生成的回调中捕获该错误码，弹出 Modal："AI 额度已用完"并给出引导

## 技术方案

### 改动文件清单（4 个）

| 文件 | 改动类型 | 改动说明 |
| --- | --- | --- |
| `common/ad-utils.js` | 修改 | playAd() 中 toast → Modal，支持无 surveyId 场景 |
| `pages-tools/search/search-page.vue` | 修改 | submitCustomTag 中 await playAd() + doGenerate 新增 COZE_QUOTA_EXHAUSTED 分支 |
| `pages-tools/survey-preview/survey-preview.vue` | 修改 | regenerate() 新增 COZE_QUOTA_EXHAUSTED 分支 |
| `uniCloud-alipay/cloudfunctions/survey/index.obj.js` | 修改 | generateFromCoze 中检测 res.statusCode === 429 |


### 实现细节

#### 1. ad-utils.js — playAd() 改造

- 移除 `uni.showToast`，改用 `uni.showModal`（title: "广告功能尚未实装"，content: "本次生成免费，请耐心等待 AI 为您创作问卷~"，confirmText: "确认生成"）
- **无 surveyId 场景**（生成问卷时）：跳过 pin 资格检查，直接弹 Modal，确认后 `resolve({ adPassed: true })`，取消则 `resolve(null)`
- **有 surveyId 场景**（置顶时）：保持 pin 资格检查 → 通过后弹 Modal → 确认后 `resolve(await callHandleAdRewardWithRetry(surveyId, 0))`
- 函数改为返回 `Promise`：调用方 `await playAd()` 或 `await playAd(surveyId)`

#### 2. search-page.vue — submitCustomTag() 对接

- `hideCustomPopup()` 之后、`doGenerate()` 之前插入：

```js
const adResult = await playAd()
if (!adResult) return // 用户取消
this.doGenerate(name, desc)
```

#### 3. search-page.vue — doGenerate() 新增 COZE_QUOTA_EXHAUSTED

- 在 `else if (res.errCode === 'VALIDATE_ERROR')` 之后新增：

```js
else if (res.errCode === 'COZE_QUOTA_EXHAUSTED') {
    uni.showModal({
        title: 'AI 额度已用完',
        content: '当前 AI 生成额度已耗尽，您可以：\n1. 等待每日额度重置\n2. 联系开发者获取更多额度',
        showCancel: false,
        confirmText: '知道了'
    })
}
```

#### 4. survey-preview.vue — regenerate() 同样新增

- 在 `else if (res.errCode === 'AUTH_ERROR')` 之后新增同上的 COZE_QUOTA_EXHAUSTED 处理

#### 5. index.obj.js — generateFromCoze() 捕获 429

- 在 `const raw = res.data`（第 464 行）之前，检查 `res.statusCode === 429`：

```js
if (res.statusCode === 429) {
    return { errCode: 'COZE_QUOTA_EXHAUSTED', errMsg: 'AI 额度已用完，请稍后再试' }
}
```

- uniCloud httpclient 返回对象含 `statusCode` 字段，直接判断即可

### 架构决策

- 不新增文件，不新增云函数方法
- `playAd()` 保持异步 Promise 返回，现有调用方（my-surveys.vue）无需改动
- 额度耗尽错误码 `COZE_QUOTA_EXHAUSTED` 在云函数侧定义，前端根据该 errCode 展示 Modal