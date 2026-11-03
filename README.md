# vite-shadcnui-blog

基于 React、TypeScript、Vite 和 Tailwind CSS 构建的个人站点，包含公开笔记、婚礼纪念页、Passkey 认证、私人资源、英语学习和 Just Write。前端通过 GitHub Actions 部署到阿里云 OSS，认证、上传校验和 AI 接口由 `functions/private-auth/` 提供。

## 技术栈

- React 19 + TypeScript
- Vite 7
- Tailwind CSS 4
- shadcn/Radix UI 组件
- Framer Motion
- Embla Carousel
- vite-imagetools（AVIF/WebP/JPEG 响应式图片）
- Waline
- GitHub Actions + Aliyun OSS

## 本地开发

要求 Node.js 22 和 pnpm 10，与 CI 环境保持一致。

```bash
pnpm install
pnpm dev
```

常用命令：

```bash
pnpm lint      # ESLint 静态检查
pnpm build     # TypeScript 检查并生成 dist/
pnpm check     # lint + build，提交前推荐执行
pnpm test:client # 上传超时、重试与取消回归
npm test --prefix functions/private-auth # 后端完整测试
pnpm preview   # 本地预览生产构建
```

## 目录结构

```text
src/
├── assets/gallery/       # 婚礼图片源文件
├── components/common/    # 通用组件
├── components/hooks/     # 页面 hooks
├── components/ui/        # UI 基础组件
├── components/wedding/   # 婚礼页面业务组件
├── config/               # 页面配置
├── lib/                  # 通用工具
└── pages/                # 页面入口

public/                    # 不经过 Vite 模块处理的静态资源
.github/workflows/         # CI/CD 工作流
```

## 图片构建

`vite-imagetools` 会在构建阶段为图库图片生成多尺寸 AVIF、WebP 和 JPEG 资源。页面通过 `<picture>` / `<source>` 让浏览器选择适合当前设备的格式和尺寸。

新增图库图片时放入：

```text
src/assets/gallery/hero/
src/assets/gallery/story/
```

## 自动部署到阿里云 OSS

工作流文件：

```text
.github/workflows/deploy-oss.yml
```

行为：

- 向 `main` 推送：执行 lint、build，并部署 `dist/` 到 OSS。
- 针对 `main` 的 Pull Request：只执行 lint 和 build，不读取部署密钥，也不部署。
- 支持在 Actions 页面手动触发部署。

Repository Secrets：

```text
ALIYUN_OSS_ACCESS_KEY_ID
ALIYUN_OSS_ACCESS_KEY_SECRET
```

Repository Variables：

```text
ALIYUN_OSS_REGION
ALIYUN_OSS_TARGET
```

`ALIYUN_OSS_TARGET` 应使用 `oss://bucket/path/` 形式。当前工作流不会删除 OSS 中只存在于远端的文件；如果目标目录确认由本项目独占，可再评估启用 `ossutil sync --delete`。

## 提交前检查

```bash
pnpm check
```

只有 lint 和生产构建都通过的代码才应进入 `main`。

## 本次可靠性修复的边界

- 上传完成请求支持跨秒重复提交，保留已有冲突校验。
- Just Write 未保存时，站内导航和浏览器后退统一提示；保存成功后正常返回。
- 上传连续 60 秒无进展会超时，并进入已有重试流程；用户取消不重试。
- 固定地址资源重新验证缓存，Vite 哈希资源保留长期缓存。
- AI 限额和批改任务恢复说明见 [后端配置](functions/private-auth/README.md#ai-request-limits-and-retry-behavior)。
- 本次保留现有存储协议、依赖版本和页面样式；分布式锁改造与模块拆分留待后续单独实施。
