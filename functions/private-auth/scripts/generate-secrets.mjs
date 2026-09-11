import { randomBytes } from "node:crypto";

console.log(`SESSION_CURRENT_KEY=${randomBytes(32).toString("base64url")}`);
