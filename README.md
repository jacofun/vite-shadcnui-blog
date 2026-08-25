# vite-shadcnui-blog

基于 React、TypeScript、Vite 和 Tailwind CSS 构建的静态婚礼邀请站点。项目使用响应式图片、轮播、动画、SEO 元数据和 Waline 互动功能，并通过 GitHub Actions 自动构建后部署到阿里云 OSS。

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
