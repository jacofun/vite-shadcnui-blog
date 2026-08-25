# Repository Guidelines

## Project Structure & Module Organization
The Vite + React invite lives inside `src/`, with `pages/MainContent.tsx` orchestrating the layout. Reusable shadcn-inspired primitives stay under `src/components/ui/` (button, card, progress), while `components/animations/` and `components/gallery/` hold feature blocks. Event copy, schedule data, and SEO defaults are centralized in `src/config/config.ts`; adjust values there rather than scattering literals. Shared helpers such as `formatEventDate` belong in `src/lib/`, and static assets should be placed in `public/` or `src/assets/` for Vite to bundle.

## Build, Test, and Development Commands
- `pnpm install`: sync dependencies defined in `pnpm-lock.yaml`.
- `pnpm dev`: start the hot-reloading dev server at `http://localhost:5173`.
- `pnpm build`: run `tsc -b` then produce an optimized production bundle.
- `pnpm preview`: serve the latest build for final smoke testing.
- `pnpm lint`: enforce the ESLint presets (TypeScript, React Hooks, Vite refresh).

## Coding Style & Naming Conventions
Author components in TypeScript using lowercase filenames (`button.tsx`) with PascalCase exports when they render a single component. Keep indentation at two spaces and prefer double quotes, matching the existing ESLint-configured style; run `pnpm lint --fix` if you diverge. Compose Tailwind class strings from layout -> spacing -> color -> effects, and reuse tokens from `config.ts` instead of hardcoded values. Import shared utilities and configs through the `@/` alias provided in `tsconfig.json` for consistent paths.

## Testing Guidelines
There is no automated test harness yet, so complete desktop and mobile walkthroughs in the dev server before shipping. Log console output and check animation timing, carousel controls, and metadata tags after each change. If you introduce automated tests, colocate `*.test.tsx` files with their components and document the required commands in this guide.

## Commit & Pull Request Guidelines
History favors short, present-tense subjects (often in Chinese), e.g. `重构页面结构`; keep subjects under 72 characters and group related work per commit. Explain notable UI or data changes in the body when needed. Pull requests should include: a concise summary, screenshots or screen recordings of the altered sections, references to tracking issues, and a checklist of `pnpm lint`, `pnpm build`, and manual QA steps. Request review only after the preview or screenshots demonstrate the new invitation state.

## Content & Visual Updates
Update copy, schedule details, and accent colors through `src/config/config.ts` so they propagate everywhere. Place new imagery in `public/` or `src/assets/` and import via Vite's asset syntax rather than absolute URLs. Extend the existing shadcn-inspired primitives before introducing new libraries to keep the visual language cohesive.
