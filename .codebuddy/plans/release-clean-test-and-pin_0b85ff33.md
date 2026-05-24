---
name: release-clean-test-and-pin
overview: 在 release 分支上清理所有测试页面/按钮以及全部置顶相关功能、页面、组件、云函数。
todos:
  - id: delete-pages-dirs
    content: 删除 11 个测试/pin 页面目录（pin-test, pin-test-stage7, pin-migration-test, pin-dashboard, pin-e2e-test, radar-fake-test, image-debug, slot-fix-test, phase1-test, radar-test, career）并从 pages.json 移除对应 12 个页面注册
    status: completed
  - id: delete-pin-resources
    content: 删除 4 个 pin 组件目录、4 个云函数目录、2 个数据库文件、1 个配置目录、common/ad-utils.js、5 个根目录测试脚本
    status: completed
  - id: clean-index
    content: 清理 pages/index/index.vue：删除 "release测试" 标记、mock 预览区、开发测试按钮区、暗金标签验收区及相关方法和 CSS
    status: completed
    dependencies:
      - delete-pages-dirs
      - delete-pin-resources
  - id: clean-quiz-home
    content: 清理 pages-tools/quiz-home/quiz-home.vue：删除 pin-terminal-entry 和 pin-topbar 组件引用、career 弹窗全部逻辑、Mock 按钮、分享中的 career 逻辑
    status: completed
    dependencies:
      - delete-pages-dirs
      - delete-pin-resources
  - id: clean-result-mysurveys
    content: 清理 result.vue 和 my-surveys.vue：删除 "看广告置顶" 按钮、playAd import、promoteSurvey 方法
    status: completed
    dependencies:
      - delete-pages-dirs
      - delete-pin-resources
  - id: commit-release
    content: 提交 release 分支所有清理变更
    status: completed
    dependencies:
      - clean-index
      - clean-quiz-home
      - clean-result-mysurveys
---

## 用户需求

在 release 分支上执行两阶段清理，使项目达到可发布状态：

1. 移除所有测试相关页面、入口按钮、mock 预览区
2. 移除所有置顶（pin）相关功能、页面、组件、云函数、数据库、工具文件

## 清理范围确认

### 测试页面（删除 pages.json 注册 + 删除目录）

- pin-test、pin-test-stage7、pin-migration-test、pin-dashboard、pin-e2e-test（置顶测试）
- radar-fake-test、image-debug、slot-fix-test、phase1-test、radar-test（功能测试）

### 置顶业务页面（删除 pages.json 注册 + 删除 career 目录）

- career-detail、career-history（完全依赖 pin-system 云函数，无云函数即无法运行）

### 置顶组件（删除目录）

- pin-terminal-entry、pin-topbar、green-channel-splash、queue-terminal

### 置顶云函数和数据库（删除）

- pin-expiry、pin-system、test-pin-expiry、test-pin-stage7 云函数
- pin-pool.schema.json、pin-system-init-schema.js 数据库文件
- uni-config-center/pin-system/ 配置

### 公共文件（删除）

- common/ad-utils.js（全部是 pin 广告逻辑）
- 根目录测试脚本 5 个（test-stage7.mjs、test-stage6.mjs、test-promote-phase2.mjs、test-pin-full.mjs、verify_migration.js）

### 现有页面清理

- **index.vue**：删除 "release测试" 标记、mock 预览区、开发测试按钮区（9个按钮）、暗金标签验收区、4个方法、大片 CSS
- **quiz-home.vue**：删除 pin-terminal-entry/pin-topbar 组件引用和导入，删除 career 弹窗的全部 data/方法/Mock按钮/分享逻辑
- **result.vue**：删除 "看广告置顶" 按钮、playAd import、promoteSurvey 方法
- **my-surveys.vue**：删除 "看广告置顶" 按钮、playAd import、promoteSurvey 方法

## 技术方案

### 操作策略

纯删除操作，不涉及新增代码。按「文件删除 → pages.json 注册清理 → 业务页面引用清理」的顺序执行，确保每一步都是原子操作，出错可回滚。

### 关键决策

- **career 目录整目录删除**：career-detail 和 career-history 页面内部引用了置顶管理台、槽位管理、pin-system 云函数，去掉云函数后这两个页面全部功能失效，直接删除比保留空壳更干净。
- **ad-utils.js 整文件删除**：该文件所有函数都依赖 pin-system 云对象，没有任何独立于置顶系统的功能。
- **Mock 按钮同步删除**：quiz-home 中的 Mock 按钮用于测试暗金标签，属于测试用途。

### 文件修改清单

#### 第一组：目录和文件删除（共 22 个目标）

| 类型 | 路径 | 数量 |
| --- | --- | --- |
| 页面目录 | pages-tools/pin-test/ 等 11 个 | 11 |
| 组件目录 | components/pin-terminal-entry/ 等 4 个 | 4 |
| 云函数目录 | uniCloud-alipay/cloudfunctions/pin-expiry/ 等 4 个 | 4 |
| 数据库文件 | pin-pool.schema.json, pin-system-init-schema.js | 2 |
| 配置文件 | uni-config-center/pin-system/ | 1 |
| 公共文件 | common/ad-utils.js | 1 |
| 根目录脚本 | test-*.mjs 等 5 个 | 5 |


#### 第二组：pages.json 修改

- 从 pages-tools 子包的 pages 数组中删除 12 个页面注册项（10 个测试 + 2 个 career）

#### 第三组：现有页面引用清理（4 个文件）

- pages/index/index.vue
- pages-tools/quiz-home/quiz-home.vue
- pages-tools/result/result.vue
- pages-tools/my-surveys/my-surveys.vue

### 执行顺序

1. 先删除所有目录和文件（物理删除，git 可追踪）
2. 修改 pages.json（移除失效注册）
3. 清理 4 个业务页面中的引用（模板 + 脚本 + 样式）
4. 提交 release 分支