---
name: 方案A演示：问卷编辑器工具集成
overview: 按照方案A的架构，创建一个演示用的"问卷编辑器"工具，将其集成到工具集小程序中。包括：创建tools数据库schema和初始数据、编写云函数、创建工具页面、改造list.nvue为工具列表入口、注册pages-tools子包。
todos:
  - id: create-db-schema
    content: 创建tools.schema.json和tools.init_data.json
    status: completed
  - id: create-cloud-function
    content: 创建tools云对象（index.obj.js + package.json）
    status: completed
    dependencies:
      - create-db-schema
  - id: create-survey-page
    content: 创建pages-tools/tool-survey/survey.vue演示页面
    status: completed
  - id: modify-pages-json
    content: 在pages.json中注册pages-tools子包
    status: completed
    dependencies:
      - create-survey-page
  - id: modify-list-nvue
    content: 改造list.nvue：数据源切换到tools表、卡片字段适配、点击跳转改为pagePath驱动
    status: completed
    dependencies:
      - create-db-schema
      - modify-pages-json
---

## 产品概述

创建一个演示用的"问卷编辑器"工具，验证方案A（数据库存pagePath）的完整工作流：list.nvue从tools表获取工具列表，用户点击卡片后通过数据库中的pagePath直接跳转到工具页面。

## 核心功能

- list.nvue展示从tools表获取的工具列表卡片（图标+名称+描述）
- 点击卡片通过pagePath跳转到对应工具页面，跳转失败时友好提示
- 数据库tools表存储工具元数据（含pagePath），支持上下架
- 云函数tools提供getList接口查询上架工具
- 演示用的问卷编辑器页面（无实际功能）

## 技术栈

- 前端框架：Vue2 + uni-app（微信小程序）
- 云服务：uniCloud（云对象模式）
- 数据库：uniCloud DB（带schema校验）
- 参考现有模式：`product/index.obj.js`云对象、`unicloud-db`组件直连查询

## 实现方案

### 数据层

1. 创建`tools.schema.json`定义表结构，字段：toolId/name/icon/description/category/pagePath/status/sort/needLogin
2. 创建`tools.init_data.json`插入一条"问卷编辑器"初始记录，pagePath为`/pages-tools/tool-survey/survey`

### 云函数层

3. 创建`tools`云对象，提供`getList`方法：查询`status==1`的工具列表，按`sort`升序排列

### 前端改造

4. list.nvue改造要点：

- `<unicloud-db>`的collection从`opendb-news-articles`联表查询改为单表`tools`查询
- where条件从`article_status == 1`改为`status == 1`
- 添加`orderby="sort asc"`排序
- 卡片模板：icon替代avatar、name替代title、description替代author+日期
- 点击事件：`goDetail`改为`goTool`，通过`item.pagePath`跳转，fail回调提示"工具暂未开放"
- 搜索逻辑：keyword过滤改为匹配name字段
- 删除不再需要的联表查询（colList计算属性）、GPS定位等无关逻辑

5. 创建`pages-tools/tool-survey/survey.vue`：纯演示页面，显示"问卷编辑器"标题和一行提示文字
6. `pages.json`添加`pages-tools`子包，注册`tool-survey/survey`路径

### 关键设计决策

- list.nvue继续使用`unicloud-db`组件直连查询tools表，而非手动调云函数，保持与现有代码风格一致且更简洁
- 卡片布局保持双列瀑布流，仅替换展示字段，保持视觉一致性
- navigateTo的fail回调作为方案A的兜底机制，防止pagePath错误导致白屏

## 目录结构

```
c:\Users\hange\Documents\HBuilderProjects\快乐大狐狸工具集\
├── pages\list\list.nvue                          # [MODIFY] 数据源从文章改为tools表，点击跳转改为pagePath驱动
├── pages.json                                     # [MODIFY] 添加pages-tools子包
├── pages-tools\
│   └── tool-survey\
│       └── survey.vue                             # [NEW] 问卷编辑器演示页面
├── uniCloud-alipay\
│   ├── database\
│   │   ├── tools.schema.json                      # [NEW] tools表结构定义
│   │   └── tools.init_data.json                   # [NEW] 问卷编辑器初始数据
│   └── cloudfunctions\
│       └── tools\
│           ├── index.obj.js                        # [NEW] tools云对象，提供getList
│           └── package.json                        # [NEW] 云函数包配置
```