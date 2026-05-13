# Git 使用指南

> 适用项目：快乐大狐狸工具集（Vue2 + uni-app + uniCloud 微信小程序）
> 目的：防止操作丢失，回退有据可依

---

## 一、核心概念（一句话）

- **commit（提交）**：给当前代码打个快照，写一句"这版改了什么"
- **branch（分支）**：平行宇宙，互不干扰
- **checkout / switch**：切换到某个快照或分支
- **diff**：看看这次改了哪些地方

---

## 二、日常流程

### 2.1 开始工作前

```bash
# 确保当前是干净的
git status
```

### 2.2 完成一个功能模块后

```bash
git add .
git commit -m "feat: 完成了XX功能"
```

**commit 频率原则：** 一个独立改动 = 一次 commit。比如：
- ✅ "feat: 搜索页新增分类手风琴标签" ← 好的
- ✅ "fix: 修复问卷提交按钮未禁用bug" ← 好的
- ❌ "改了各种东西" ← 不好的，回退时不知道回哪个

### 2.3 写了几行发现走歪了，想还原

```bash
# 放弃某个文件的所有未提交改动
git checkout -- pages-tools/search/search-page.vue

# 放弃所有未提交改动（谨慎！）
git checkout -- .
```

### 2.4 改完了想看看自己改了啥

```bash
git diff
```

还没 `git add` 的话，diff 显示工作区和上次 commit 的差异。

### 2.5 想回到某个历史版本

```bash
# 看历史记录
git log --oneline

# 会显示：
# a1b2c3d feat: 搜索页新增分类手风琴标签
# e4f5g6h fix: 修复问卷提交bug

# 回到某个版本（但不删除后面的 commits）
git revert a1b2c3d

# 或强行走时间机器（删除后面的 commits，谨慎！）
git reset --hard a1b2c3d
```

---

## 三、分支策略（单人开发也建议用）

```bash
# 查看当前分支
git branch

# 新建分支做实验性改动
git checkout -b feat-experiment

# 改完没问题，合并回主分支
git checkout main
git merge feat-experiment

# 删掉实验分支
git branch -d feat-experiment
```

**什么时候用分支：**
- 拿不准能不能成功的大改动
- 想在两个方向上同时尝试
- 同一个文件的改动跨度大，不方便一个一个 commit 回退

---

## 四、对应你遇到的情况

### 情况：我改了一堆，你手动回退，结果碎片残留

**有 Git 的正确做法：**

```bash
# 先看我改了啥
git diff pages-tools/search/search-page.vue

# 如果我的改动你要保留 → merge
# 如果我的改动你要放弃 → checkout 回原来状态
git checkout -- pages-tools/search/search-page.vue

# 如果 commit 过了，更精确：
git revert <我那次的commit hash>
```

**关键区别：** 手动回退 ≈ 凭记忆重写，git revert 或 checkout ≈ 精确还原到某个时间点的文件内容，**不会漏改、不会留碎片**。

---

## 五、常用命令速查

| 你想做什么 | 命令 |
|-----------|------|
| 看当前状态 | `git status` |
| 把所有改动加入暂存区 | `git add .` |
| 加某个文件 | `git add pages/xxx.vue` |
| 提交（打快照） | `git commit -m "说明"` |
| 看提交历史 | `git log --oneline` |
| 放弃某个文件改动 | `git checkout -- 文件路径` |
| 放弃全部未提交改动 | `git checkout -- .` |
| 撤销某次提交（推荐） | `git revert <commit-hash>` |
| 强制回退到某版本 | `git reset --hard <commit-hash>` |
| 看和上次提交的差异 | `git diff` |
| 创建并切换到新分支 | `git checkout -b 分支名` |
| 合并分支 | `git merge 分支名` |

---

## 六、起步（第一次用）

这个项目目前还没 commit。如果想从现在开始用 Git：

```bash
# 初始化仓库（已经做过则跳过）
git init

# 添加所有文件到暂存区
git add .

# 创建第一个快照
git commit -m "chore: 项目初始提交"

# 之后每次改完功能重复：
# git add . && git commit -m "feat: xxx"
```

> ⚠️ `node_modules/` 和 `unpackage/` 已在 `.gitignore` 中排除，不会进入版本控制。

---

**一句话总结：完成一个小改动就 commit 一次，想回退就用 git revert 或 git checkout，不要手动改代码回退。**
