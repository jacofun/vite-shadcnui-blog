---
title: Nginx 前后端接口路径转换
slug: nginx-path-rewrite
summary: 前端请求路径与后端上下文根不一致时，location 和 proxy_pass 应该如何配合。
date: 2026-08-24
updated: 2026-08-26
category: 工程与架构
tags:
  - Nginx
  - Reverse Proxy
  - Java
draft: false
---

# Nginx 前后端接口路径转换

前端调用 `/api/login`，后端实际接口为 `/rmis-eware/login`。这类问题的关键在于明确两段路径分别由谁维护。

## 推荐配置

```nginx
location /api/ {
    proxy_pass http://backend/rmis-eware/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

当客户端请求 `/api/login` 时，Nginx 会把匹配到的 `/api/` 替换为 `/rmis-eware/`，最终向后端请求：

```text
http://backend/rmis-eware/login
```

## 尾部斜杠的影响

`location` 和 `proxy_pass` 的尾部斜杠会直接影响路径拼接结果。

- `proxy_pass http://backend/rmis-eware/;` 会执行 URI 替换。
- `proxy_pass http://backend;` 会保留原始请求 URI。
- 修改配置后应使用 `nginx -t` 检查语法。

> 配置前先写出“浏览器路径、Nginx 匹配路径、后端目标路径”三项，路径转换会清晰很多。
