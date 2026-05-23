---
name: 阶段零B：云对象骨架 + 资历系统
overview: 创建 pin-system 云对象骨架（含资历查询 + 预热方法）和 pin-expiry 定时云函数骨架
todos:
  - id: create-pin-system-package
    content: 创建 pin-system 的 package.json（参照 survey 的依赖声明）
    status: completed
  - id: create-pin-system-obj
    content: 创建 pin-system/index.obj.js（_before + ping + getSeniority + 8个空壳方法）
    status: completed
    dependencies:
      - create-pin-system-package
  - id: create-pin-expiry
    content: 创建 pin-expiry 定时云函数骨架（index.js + package.json）
    status: completed
---

根据工作计划和设计文档，完成阶段零B的任务：

1. **创建 `pin-system` 云对象**（`index.obj.js`），包含：

- `_before()` 认证中间件（通过 uni-id 获取当前用户标识注入 `this.uid`）
- `ping()` 预热方法（首页 onLoad 时调用，降低冷启动延迟）
- `getSeniority()` 资历查询方法（查询 `career.exposureCount`，映射 Lv.0~Lv.3）
- 8 个空壳方法（`enterPool`, `queueToPool`, `draw`, `getQueueStatus`, `executeAccel`, `generateCareer`, `checkCareerStatus`, `markCareerAsRead`）

2. **创建 `pin-expiry` 普通云函数**骨架（`index.js` + `package.json`）
3. 两个云函数的 `package.json` 依赖声明（`uni-id-common`, `uni-config-center`）

## 技术栈

- 当前项目：Vue2 + uni-app + uniCloud（支付宝云）
- 后端：uniCloud 云对象（Node.js），使用 `uni-id-common` 做认证
- 配置管理：`uni-config-center`

## 实现方案

### 1. 云对象风格

严格参照项目现有 `survey/index.obj.js` 的模式：

- 顶层 `const uniID = require('uni-id-common')`
- `_before()` 中：`uniID.createInstance({ context: this.getCloudInfo() })` + `checkToken(token)` 获取 uid
- 方法参数使用解构 `{ param1, param2 }`
- 返回格式统一 `{ errCode: 0, data: ... }` 或 `{ errCode: 'ERROR', errMsg: '...' }`
- 集合引用在顶层初始化

### 2. getSeniority 实现细节

```
getSeniority():
  1. 查询 uni-id-users 获取 career.exposureCount
  2. 遍历 config 中 seniority.levels 数组匹配档位
  3. 老用户无 career 字段时兜底返回 Lv.0
  4. 返回 { exposureCount, level, label, nextLevelAt }
  5. 请求内缓存：首次查结果存 this._seniority，同一调用内复用
```

### 3. 资历分档（来自 config.json）

| 档位 | 边界 | 含义 |
| --- | --- | --- |
| Lv.0 | exposureCount === 0 | 新人/稀客 |
| Lv.1 | [1, 5] | 偶发者 |
| Lv.2 | [6, 20] | 常客 |
| Lv.3 | >= 21 | 老面孔 |


### 4. 配置文件读取

通过 `require('uni-config-center')('pin-system').config()` 读取全局参数

### 5. 空壳方法

除 `ping()` 和 `getSeniority()` 外，其余方法仅保留方法签名、参数解构、返回 `{ errCode: 'NOT_IMPLEMENTED', errMsg: '方法尚未实现' }`

## 目录结构

```
uniCloud-alipay/cloudfunctions/
├── pin-system/
│   ├── index.obj.js          # [NEW] 云对象主文件
│   └── package.json          # [NEW] 依赖声明
└── pin-expiry/
    ├── index.js              # [NEW] 定时云函数骨架
    └── package.json          # [NEW] 依赖声明
```

### 文件详细说明

**pin-system/index.obj.js** — [NEW] 置顶系统核心云对象。实现：

- `_before()`：调用 `this.getUniIdToken()` 获取 token，用 `uniID.createInstance()` + `checkToken()` 解析 uid 注入 `this.uid`
- `ping()`：空方法，return `{ errCode: 0 }`
- `getSeniority()`：查用户资历并映射档位，含请求内缓存
- 8 个空壳方法：仅方法签名 + 返回暂未实现

**pin-system/package.json** — [NEW] 声明 `uni-id-common`、`uni-config-center` 的依赖路径（参照 survey/package.json）

**pin-expiry/index.js** — [NEW] 定时云函数骨架。使用 `exports.main` 模式，空壳仅打印日志 `console.log('[pin-expiry] 定时触发，暂未实现')`

**pin-expiry/package.json** — [NEW] 声明 `uni-config-center` 依赖