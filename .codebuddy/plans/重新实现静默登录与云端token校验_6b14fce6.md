---
name: 重新实现静默登录与云端token校验
overview: 回滚之前所有改动，基于官方uni-id文档重新实现：App.vue静默登录（每次启动都调loginByWeixin）、survey与pin-system的_before中checkToken错误日志与 createInstance 改用 clientInfo。
todos:
  - id: revert-app-vue
    content: 使用 git checkout HEAD 恢复 App.vue 到原始版本
    status: completed
  - id: revert-survey
    content: 使用 git checkout HEAD 恢复 survey/index.obj.js 到原始版本
    status: completed
  - id: revert-pin-system
    content: 使用 git checkout HEAD 恢复 pin-system/index.obj.js 到原始版本
    status: completed
  - id: rewrite-silent-login
    content: 重写 App.vue silentLogin()，删除 token 信任，改用 loginByWeixin + mutations.loginSuccess
    status: completed
    dependencies:
      - revert-app-vue
  - id: fix-survey-catch
    content: survey _before catch 添加 console.error 日志
    status: completed
    dependencies:
      - revert-survey
  - id: fix-pin-system-catch
    content: pin-system _before catch 添加 console.error 日志
    status: completed
    dependencies:
      - revert-pin-system
---

## 需求

回滚之前在 App.vue、survey/index.obj.js、pin-system/index.obj.js 上做的所有改动。然后从头重新实现静默登录（无感登录）功能，要求：

1. 修复副本工程 localStorage 继承了原工程旧 token 导致登录状态异常的问题
2. 云对象 `_before()` 的 token 校验 catch 不能静默吞错误
3. 紧密围绕官方文档 `https://doc.dcloud.net.cn/uniCloud/uni-id/cloud-common.html#checktoken` 实现

## 核心问题

- 副本工程的 localStorage 有原工程的 `uni_id_token`，其 `tokenExpired` 时间戳仍在未来
- 原始 `silentLogin()` 发现 storage 有"有效"token 就直接 return，不做任何登录动作
- 云对象 `_before()` 用这个旧 token 调用 `checkToken` 失败 → `this.uid = null`
- catch 块静默吞错误，无法诊断
- 原始代码 `res.userInfo || {}` 存在隐式 bug：`loginByWeixin` 不返回 `userInfo` 字段

## 解决方案

### 客户端 (App.vue)

- 删除对 localStorage token 的信任，每次启动都调 `uni.login()` + `uniIdCo.loginByWeixin()`
- `loginByWeixin` 是幂等的（官方确认），已注册用户调用只刷新 token，不会重复注册
- 成功后使用标准 `mutations.loginSuccess({ showToast: false, autoBack: false })` 处理，它会自动从数据库拉取完整用户信息

### 服务端 (survey & pin-system _before)

- catch 块改为 `console.error('...', e.errCode, e.message)`，让错误可见
- 参照官方文档规范：`uniID.createInstance({ clientInfo: this.getClientInfo() })`

## 技术方案

### 回滚策略

使用 `git checkout HEAD -- <file>` 将三个文件恢复到本次对话前的原始状态，然后在此基础上修改。

### 实现方案

#### 1. App.vue — `silentLogin()`

```
删除旧的 localStorage token 信任逻辑

新逻辑：
async silentLogin():
  1. uni.login({ provider: 'weixin' }) → 获取临时 code
  2. uniIdCo = uniCloud.importObject('uni-id-co', { customUI: true })
  3. res = await uniIdCo.loginByWeixin({ code })
  4. if (res.errCode === 0 || res.errCode === 'uni-id-account-exists'):
       mutations.loginSuccess({ showToast: false, autoBack: false })
       内部的调用链：
         mutations.setUserInfo({ _id: res.uid }, { cover: true })  ← 修复原始 bug
         mutations.updateUserInfo()                                ← 从数据库拉取完整信息
         uni.$emit('uni-id-pages-login-success')
     else:
       console.warn('[静默注册] 登录失败', res.errCode, res.errMsg)
  5. catch:
       console.warn('[静默注册] 异常', e.message)
```

关键差异：

- **删除** `if (token && tokenExpired > Date.now()) return` — 这是导致副本工程问题的根因
- **删除** `mutations.setUserInfo(res.userInfo || {}, { cover: true })` — `loginByWeixin` 不返回 `userInfo`
- **改用** `mutations.loginSuccess()` — 标准 uni-id-pages 登录成功处理流程，内部调用 `updateUserInfo()` 从数据库拉取
- 静默登录场景传 `{ showToast: false, autoBack: false }` 避免弹 toast 和页面跳转

#### 2. survey/index.obj.js — `_before()`

目前是标准实现无需大改，只改 catch：

```
catch (e) {
  console.error('[survey] token 校验失败', e.errCode, e.message)
}
```

#### 3. pin-system/index.obj.js — `_before()`

同上：

```
catch (e) {
  console.error('[pin-system] token 校验失败', e.errCode, e.message)
}
```

### 无UI变更

本任务为纯逻辑修改，不涉及 UI/UX 设计。