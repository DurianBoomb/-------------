# 排查提示：云函数 `survey.getFavorites()` 返回"未登录"

> 交给 DeepSeek 或其他 AI 排查用，把你选的 AI 当作**精通 uni-app + uniCloud + uni-id 的全栈架构师**。

---

## 项目概况

- **框架**：Vue2 + uni-app + uniCloud（阿里云服务空间）
- **路由**：uniIdRouter + uni-simple-router（pages.json 配了 `"uniIdRouter": { "loginPage": "uni_modules/uni-id-pages/pages/login/login-withoutpwd", "needLogin": ["/uni_modules/uni-id-pages/pages/userinfo/userinfo"], "resToLogin": true }`）
- **用户系统**：uni-id-pages + uni-id-common

## 已实现的功能

1. **微信静默注册/登录**（`App.vue` 的 `onLaunch` → `silentLogin()` → `uni.login()` → `uniIdCo.loginByWeixin()`）
   - 已验证：控制台输出 `[静默注册] 成功 login`，token 已写入 storage
   - 带 token 过期自动刷新：检查 `uni_id_token_expired`，过期则清 token 重登
2. **删除了 profile/favorites/answer-history 页面的 noAuth 登录锁**（这些页面不再显示"未登录"提示）

## 当前问题

`pages-tools/quiz-home/quiz-home.vue` 页面在 `onShow` 时调用 `survey` 云对象的 `getFavorites()` 方法，返回错误：`Error: 未登录`。

### 具体现象

- 控制台日志显示 `getFavorites` 返回 `error: Error: 未登录`
- 前端代码已做了 catch 处理，不会显示 UI 弹窗
- 但用户仍然在界面看到"未登录"提示——怀疑是 uni-app 框架层或 uni-id-pages 层有全局错误提示
- 同时 `appInit.js` 的 `uniCloud.interceptObject` 的 `fail` 回调也会打印这个错误

### 关键日志

```
appInit.js:96 {objectName: "survey", methodName: "getFavorites", params: Array(0), error: Error: 未登录
    at _construct (vendor.js:2800)
```

### 云函数 survey/index.obj.js 的 _before()

```javascript
_before() {
    this.timestamp = Date.now()
}
```

没有 uni-id 的初始化。但 `package.json` 有 uni-id-common 依赖：

```json
{
  "dependencies": {
    "uni-id-common": "file:../../../uni_modules/uni-id-common/uniCloud/cloudfunctions/common/uni-id-common"
  },
  "extensions": {
    "uni-cloud-jql": {}
  }
}
```

### getFavorites 方法

```javascript
async getFavorites() {
    const uid = this.getClientInfo().uid
    if (!uid) return { errCode: 'AUTH_ERROR', errMsg: '未登录' }
    // ...正常查询逻辑
}
```

### 关键线索

- **`getTagList()` 不需要 uid，能正常调用成功**
- **`getFavorites()` 需要 uid，但 `this.getClientInfo().uid` 返回 null**
- **客户端已经有 token**（验证过 `uni.getStorageSync('uni_id_token')` 有值，且 silentLogin 成功）
- `uni-id-co` 云对象能正常处理 `loginByWeixin`（silent login 成功过），但可能没部署在当前服务空间
- 项目目录下 `uniCloud-alipay/cloudfunctions/` 中没有 `uni-id-co` 文件夹——它位于 `uni_modules` 中，部署时自动上传
- 用户使用 HBuilderX 运行模式，云函数在运行时应该会自动同步

## 需要排查的方向

1. `survey` 云函数是否已正确上传到开发服务空间？
2. `survey` 云函数的 `_before()` 是否需要调用 `uniID.createInstance({ context: this })` 或类似初始化？
3. 客户端 token 是否被正确传递到 `survey` 云函数（不是 `uni-id-co`）？
4. `uni-id-common` 在 `survey` 这个非 uni-id 云函数上是否需要额外配置才能解析 token？
5. `this.getClientInfo().uid` 返回 null 的可能原因是什么？
6. 是否有全局错误拦截器或 uni-app 框架层在云函数返回错误码时自动弹出提示？

## 需要提供

**直接给出可用的代码修改方案**，不要泛泛的建议。如果是云函数配置问题，给出具体的 `_before()` 修改代码。如果是服务空间/部署问题，给出排查步骤。
