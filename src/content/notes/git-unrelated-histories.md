---
title: 无强推权限时处理两条独立 Git 历史
slug: git-unrelated-histories
summary: 本地与远端仓库历史完全独立，同时又没有 Force Push 权限时的可行处理方式。
date: 2026-08-18
updated: 2026-08-24
category: 学习与思考
tags:
  - Git
  - Gerrit
  - Repository
draft: false
---

# 无强推权限时处理两条独立 Git 历史

本地分支和远端 `master` 没有共同祖先，希望保留本地历史并替换远端内容，但服务器拒绝非快进推送。

## 约束

没有 Force Push 权限时，远端分支不能直接指向另一条独立历史。要让服务器接受普通推送，新提交必须包含远端当前提交作为祖先。

## 合并两条历史

```bash
git fetch origin
git checkout local-master
git merge origin/master --allow-unrelated-histories
```

发生冲突后，以本地工程内容为准处理文件，再完成提交：

```bash
git add .
git commit
git push origin HEAD:master
```

新的合并提交同时拥有本地和远端两条父历史，因此属于远端 `master` 的快进更新。

## 需要注意的地方

- 远端旧代码仍然存在于历史中，只是不再出现在最新工作树。
- 应先建立临时分支并检查最终文件树。
- 受保护分支要求走评审时，需要推送到评审引用或新分支后创建合并请求。
- 如果合规要求彻底删除远端旧历史，只能由管理员授权改写分支历史。
