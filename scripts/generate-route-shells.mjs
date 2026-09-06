import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const distDir = path.join(root, "dist");
const indexFile = path.join(distDir, "index.html");
const routesFile = path.join(root, ".generated/route-shells.txt");

const routes = (await readFile(routesFile, "utf8"))
  .split("\n")
  .map((route) => route.trim())
  .filter(Boolean);

for (const route of routes) {
  const relativeRoute = route.replace(/^\/+|\/+$/g, "");
  if (!relativeRoute) continue;

  const routeDir = path.join(distDir, relativeRoute);
  await mkdir(routeDir, { recursive: true });
  await copyFile(indexFile, path.join(routeDir, "index.html"));
}

console.log(`Generated ${routes.length} static route shells`);
