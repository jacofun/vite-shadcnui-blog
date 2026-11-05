import { readFile } from "node:fs/promises";
import { createPrivateResourceContentStore } from "../functions/private-auth/index.js";

const env = JSON.parse(await readFile(process.argv[2], "utf8"));
const store = await createPrivateResourceContentStore({ env });
if (!store.syncPublished) throw new Error("Public publishing storage is not configured");
const path = `${env.PRIVATE_RESOURCE_ROOT || "/private"}/.publishing/index.json`;
await store.updateJson(path, {
  missing: { schemaVersion: 1, entries: [], assets: [] },
  validate: doc => doc?.schemaVersion === 1 && Array.isArray(doc.entries) && Array.isArray(doc.assets),
  leaseMs: 900_000,
  afterWrite: doc => store.syncPublished(doc),
}, doc => doc);
console.log("Published snapshots and selected media synchronized to public OSS.");
