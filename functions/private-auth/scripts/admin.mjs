#!/usr/bin/env node
// Local operator tool only. Never include this script in the function ZIP.
import { readFile } from "node:fs/promises";
import { administer, createOssEventStore } from "../index.js";

const [command, ...args] = process.argv.slice(2);
const usage = `Usage: node scripts/admin.mjs <command> [arguments]
  bootstrap                         Create the one-time owner invitation
  reissue-bootstrap                 Replace a lost/expired invitation before owner enrollment
  import-owner <credentials.json>    Import existing owner public credentials
  invite [private-resources] [english-learning]  Create a member invitation
  list                              List account IDs and invitation hashes (no secrets)
  revoke-invite <invitation-hash>    Revoke an unused invitation
  disable <user-id>                  Disable account and revoke sessions
  enable <user-id>                   Enable account; old sessions stay revoked
  permissions <user-id> [private-resources] [english-learning]  Replace grants and revoke sessions
  recover <user-id> --confirm-revoke-all   Revoke ALL old Passkeys/sessions; issue recovery invitation

Requires OSS_AUTH_BUCKET, OSS_AUTH_REGION, OSS_AUTH_ENDPOINT and configured
ALIBABA_CLOUD_ACCESS_KEY_ID/SECRET (and SECURITY_TOKEN for STS).
Invitation tokens are shown once on stdout: do not run this in CI or shared logs.
Use INVITATION_TTL_SECONDS (default 86400) and OWNER_DISPLAY_NAME as needed.`;

try {
  if (!command || command === "--help") {
    console.log(usage);
  } else {
    const options = { command, displayName: process.env.OWNER_DISPLAY_NAME || "Owner",
      ttlSeconds: Number(process.env.INVITATION_TTL_SECONDS || 86400) };
    const noArgs = ["bootstrap", "reissue-bootstrap", "list"];
    if ((noArgs.includes(command) && args.length) ||
        (["disable", "enable", "revoke-invite", "import-owner"].includes(command) && args.length !== 1) ||
        (command === "invite" && args.length > 2) ||
        (command === "permissions" && (args.length < 1 || args.length > 3)) ||
        (command === "recover" && (args.length !== 2 || args[1] !== "--confirm-revoke-all"))) {
      throw new Error("INVALID_ARGUMENTS");
    }
    if (command === "import-owner") options.credentials = JSON.parse(await readFile(args[0], "utf8"));
    if (command === "invite") options.permissions = args;
    if (["disable", "enable", "permissions", "recover"].includes(command)) options.userId = args[0];
    if (command === "permissions") options.permissions = args.slice(1);
    if (command === "revoke-invite") options.invitationHash = args[0];
    options.store = await createOssEventStore();
    console.log(JSON.stringify(await administer(options), null, 2));
  }
} catch (error) {
  // SDK messages can contain request details. Never dump raw SDK errors or stacks.
  console.error(`Administrative operation failed (${error.code || "CHECK_ARGUMENTS_AND_CONFIGURATION"}).`);
  console.error("If a write timed out, inspect with 'list' before retrying; do not repeat recovery blindly.");
  process.exitCode = 1;
}
