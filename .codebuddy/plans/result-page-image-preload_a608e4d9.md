---
name: result-page-image-preload
overview: 先 git commit 当前更改，然后修改 result.vue 中用 uni.getImageInfo() 预加载配图，解决图片异步下载导致的布局塌陷 bug。
todos:
  - id: git-commit
    content: 提交当前工作区所有变更（2 modified + 1 untracked）
    status: completed
  - id: fix-image-preload
    content: 修改 onLoad 中 image 处理逻辑：用 uni.getImageInfo 预加载图片后再赋值 resultImage
    status: completed
    dependencies:
      - git-commit
---

## 用户需求

先提交当前 git 工作区的所有更改，然后修改 `pages-tools/result/result.vue` 中 `onLoad` 的配图加载逻辑，解决配图偶现显示异常的问题。

## 产品概述

结果页在显示云端配图（非 emoji）时，图片下载未完成就渲染了 `<image>` 标签，导致 `.anim-res-1` 入场动画组件内布局塌陷。需要确保图片完全下载后才切换显示。

## 核心功能

- 提交当前工作区所有变更（2 个 modified 文件 + 1 个 untracked 文件）
- 修改 onLoad 中 image 处理逻辑：临时 URL 获取后，用 `uni.getImageInfo()` 等待图片下载完成再赋值 `resultImage`
- 加载失败则保持 `resultImage` 为空，走 emoji 兜底分支

## 技术方案

### 实现方式

在 `onLoad` 的 image 处理分支中，获取临时 URL 后不直接赋值 `resultImage`，改为调用 `uni.getImageInfo({ src: url })` 等待图片完全下载。只有 `getImageInfo` 成功后才设置 `this.resultImage = url`，失败则保持空字符串让模板走 `v-else` 的 emoji 分支。

### 修改范围

单个文件，单处改动：`pages-tools/result/result.vue` 第 97-105 行。

### 修改前

```javascript
if (o.image) {
    const raw = decodeURIComponent(o.image)
    if (raw.startsWith('cloud://')) {
        const res = await uniCloud.getTempFileURL({ fileList: [raw] })
        this.resultImage = res.fileList[0].tempFileURL || raw
    } else {
        this.resultImage = raw
    }
}
```

### 修改后

```javascript
if (o.image) {
    const raw = decodeURIComponent(o.image)
    let url = raw
    if (raw.startsWith('cloud://')) {
        const res = await uniCloud.getTempFileURL({ fileList: [raw] })
        url = res.fileList[0].tempFileURL || raw
    }
    try {
        await new Promise((resolve, reject) => {
            uni.getImageInfo({ src: url, success: resolve, fail: reject })
        })
        this.resultImage = url
    } catch (e) {
        console.warn('[result] 配图预加载失败，使用 emoji 兜底:', e)
    }
}
```

### 关键决策

- `uni.getImageInfo` 在小程序中会等待图片完全下载后才回调 success，确保 `<image>` 渲染时图片本体已就绪
- 非 cloud:// 的普通 URL 同样经过 `getImageInfo` 预加载，保持一致
- 加载失败不中断页面，静默降级到 emoji 显示