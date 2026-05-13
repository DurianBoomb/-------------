---
name: fix-editor-overview-save-navigation
overview: 修复 editor-overview 保存后找不到 workbench 路由导致错误跳转到小程序首页的问题
todos:
  - id: fix-save-navigation
    content: 改 editor-overview.vue 保存后 fallback 为 reLaunch 到 workbench
    status: completed
---

修复问卷编辑器保存后的导航逻辑。

当前流程：tool-survey（创作中心）→ 新建问卷 → editor-setting → editor-quz → editor-overview → 保存
预期行为：保存后导航到工作台（workbench）
当前行为：保存后回到小程序首页（list/list.nvue）

根因：createSurvey 从 tool-survey 直接 navigateTo 到 editor-setting，跳过了 workbench。页面栈为 [list/list, tool-survey, editor-setting, editor-quz, editor-overview]，workbench 不在栈中。当前代码 findIndex 返回 -1，fallback 的 navigateBack({ delta: 999 }) 一路退到栈底 list/list。

修复方案：editor-overview 保存后，如果 workbench 在栈中（从工作台进入编辑），用 navigateBack 回去保留路由栈；如果 workbench 不在栈中（新建问卷场景），用 reLaunch 直接打开工作台。

## 涉及文件

| 文件 | 改动 |
| --- | --- |
| `pages-tools/editor-overview/editor-overview.vue` | 改一处（第 282 行 fallback） |


其他文件无需改动。

## 实现逻辑

当前 `doSave()` 中保存成功后的代码（第 274-284 行）：

```js
const pages = getCurrentPages()
const routes = pages.map(p => p.route)
const workbenchIndex = routes.findIndex(r => r.includes('workbench'))
if (workbenchIndex !== -1) {
    const delta = pages.length - 1 - workbenchIndex
    uni.navigateBack({ delta })
} else {
    uni.navigateBack({ delta: 999 })  // <-- 问题在这：找不到时一路退到栈底
}
```

改为：else 分支使用 `uni.reLaunch` 直接打开 workbench。

```js
} else {
    // 新建问卷入口：workbench 不在栈中，直接打开
    uni.reLaunch({ url: '/pages-tools/workbench/workbench' })
}
```

## 两种场景验证

**场景一：工作台 → 编辑问卷 → 保存**

- 页面栈：[..., tool-survey, workbench, editor-setting, editor-quz, editor-overview]
- findIndex 找到 workbench → navigateBack 回去 → 路由栈完整，返回按钮保留

**场景二：新建问卷 → 保存**

- 页面栈：[..., tool-survey, editor-setting, editor-quz, editor-overview]
- findIndex 找不到 → reLaunch 到 workbench → 干净的栈