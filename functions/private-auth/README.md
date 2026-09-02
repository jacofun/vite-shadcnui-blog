# Private authentication function

This Node.js Function Compute handler supports two explicitly selected modes:

- `AUTH_STORE=environment` (default): single-owner login with pre-registered Passkeys.
- `AUTH_STORE=oss`: invitation-only registration, per-user Passkeys, revocable sessions,
  permission checks and operator-controlled account recovery.

Both modes issue Alibaba Cloud CDN type-A signed URLs for authenticated private resources.
The function does not proxy those files. In OSS mode, authentication state is stored in a
separate private OSS bucket used only by Function Compute; that bucket must not be a CDN origin.

## Runtime

- Node.js 20 or newer built-in runtime
- Handler: `index.handler`
- HTTP trigger path exposed through CDN: `/api/private-auth/*`
- Minimum instances: `0`
- Recommended maximum instances: `1` for this private deployment
- Timeout: `3` seconds for environment mode; `10` seconds for OSS mode

The CDN origin must overwrite `X-Origin-Verify` for `/api/private-auth/*`. Do not log this header,
cookies, WebAuthn assertions, invitation tokens, registry data or signed resource URLs.

## Common configuration

```text
WEBAUTHN_ORIGIN=https://yanxiao.me
WEBAUTHN_RP_ID=yanxiao.me
SESSION_CURRENT_KEY=<32 random bytes encoded as base64url>
CDN_AUTH_KEY=<the alphanumeric key configured for CDN type-A authentication>
CDN_ORIGIN_VERIFY_KEY=<at least 32 random characters, also configured in the CDN origin header>
```

Generate the session and origin verification secrets locally:

```bash
node scripts/generate-secrets.mjs
```

Optional settings:

```text
SESSION_PREVIOUS_KEY=<previous 32-byte key during rotation>
SESSION_VERSION=1
SESSION_TTL_SECONDS=2592000
WEBAUTHN_CHALLENGE_TTL_SECONDS=300
CDN_URL_TTL_SECONDS=3600
CDN_PUBLIC_ORIGIN=https://yanxiao.me
PRIVATE_RESOURCE_PREFIX=/private/english-learning/6minuteenglish
PRIVATE_RESOURCE_ROOT=/private
AUTH_COOKIE_NAME=__Secure-private_auth
AUTH_COOKIE_PATH=/api/private-auth/
```

Every request must contain the CDN-injected origin verification header. Every POST must contain
`Origin: https://yanxiao.me`; authenticated POSTs also require the CSRF token returned by
`verify` or `session`. Authentication responses must remain uncacheable at the CDN.

## Environment mode

Add either one credential:

```text
AUTH_STORE=environment
WEBAUTHN_CREDENTIAL_ID=<base64url credential ID>
WEBAUTHN_PUBLIC_KEY=<base64url COSE public key>
```

Or multiple credentials:

```json
WEBAUTHN_CREDENTIALS_JSON=[
  {
    "id": "<base64url credential ID>",
    "publicKey": "<base64url COSE public key>",
    "counter": 0,
    "transports": ["internal", "hybrid"]
  }
]
```

This legacy mode does not offer registration or persist signature counters. It is retained for a
small, pre-provisioned owner deployment.

## OSS mode

OSS mode keeps the technology stack to Function Compute and one private OSS bucket. The bucket is
mounted at `/home/fc` from its `/fc` prefix for inspection, but authentication writes deliberately
use the OSS API. OSS filesystem mount rename and concurrent-write semantics are not atomic across
function instances; `AppendObject` with an expected byte position supplies the compare-and-swap
boundary required by account, credential and session updates.

### Required function settings

```text
AUTH_STORE=oss
OSS_AUTH_BUCKET=<private function-only bucket>
OSS_AUTH_REGION=oss-cn-<region>
OSS_AUTH_ENDPOINT=https://oss-cn-<region>-internal.aliyuncs.com
WEBAUTHN_ORIGIN=https://yanxiao.me
WEBAUTHN_RP_ID=yanxiao.me
SESSION_CURRENT_KEY=<32-byte base64url key>
SESSION_VERSION=2
CDN_AUTH_KEY=<existing CDN type-A key>
CDN_ORIGIN_VERIFY_KEY=<existing origin header secret>
```

Use the same region as Function Compute and the HTTPS internal OSS endpoint. The handler reads
rotating STS credentials from `context.credentials`; no long-lived AccessKey is required in the
function environment. Local administrator commands can use:

```text
ALIBABA_CLOUD_ACCESS_KEY_ID=...
ALIBABA_CLOUD_ACCESS_KEY_SECRET=...
ALIBABA_CLOUD_SECURITY_TOKEN=...  # when using STS
```

Optional storage settings and defaults:

```text
OSS_AUTH_LOG_OBJECT=fc/private-auth/store/events.jsonl
OSS_AUTH_SNAPSHOT_OBJECT=fc/private-auth/snapshots/snapshot-latest.json
OSS_AUTH_RATE_PREFIX=fc/private-auth/rate-limits
OSS_AUTH_SNAPSHOT_INTERVAL=50
OSS_AUTH_MAX_LOG_BYTES=536870912
```

To enable browser uploads, configure the separate CDN-backed private content bucket:

```text
OSS_CONTENT_BUCKET=<private content bucket>
OSS_CONTENT_REGION=oss-cn-<region>
OSS_CONTENT_ENDPOINT=https://oss-cn-<region>-internal.aliyuncs.com
OSS_CONTENT_PUBLIC_ENDPOINT=https://oss-cn-<region>.aliyuncs.com
```

The Function Compute RAM role needs `GetObject`, `GetObjectMeta`, `PutObject` and `DeleteObject` for
`private/*` in this content bucket. Keep `fc/private-auth/*` in the function-only authentication
bucket. The public endpoint is used only to generate short-lived browser PUT URLs; verification
and index updates use the internal endpoint. Configure the content bucket CORS rule to allow
`PUT` from `https://yanxiao.me`, allow `Content-Type` and `x-oss-forbid-overwrite`, and expose
`ETag`.

Because the bucket's `/fc` prefix is mounted at `/home/fc`, the default objects appear at:

| OSS object | Mounted view | Purpose |
| --- | --- | --- |
| `/fc/private-auth/store/events.jsonl` | `/home/fc/private-auth/store/events.jsonl` | Authoritative append-only state log |
| `/fc/private-auth/snapshots/snapshot-latest.json` | `/home/fc/private-auth/snapshots/snapshot-latest.json` | Replaceable read cache |
| `/fc/private-auth/rate-limits/*` | `/home/fc/private-auth/rate-limits/*` | Per-minute global and hashed-IP counters |

Do not edit these mounted files. A snapshot is only a cache; a corrupt or stale snapshot falls
back to the validated event chain. Each event contains the complete bounded registry, linked by
its preceding and next byte position. A conflicting append is retried from current state, while an
ambiguous timeout is not blindly replayed. Exact WebAuthn verification retries use stored
completion receipts.

Set an OSS lifecycle rule that deletes `fc/private-auth/rate-limits/` objects after two days.
Keep the event log and snapshot indefinitely and back them up with restricted access. After a
restore, rotate `SESSION_VERSION` and discard restored challenges, invitations and sessions before
serving traffic, so old access is not revived.

Grant the Function Compute RAM role only the OSS read/write permissions needed for
`fc/private-auth/*` in this bucket. The handler performs GetObject/GetObjectMeta, AppendObject and
PutObject; it neither lists the bucket nor accesses other prefixes. Keep the bucket private and
do not attach it to CDN.

### Capacity and operating boundary

The registry is intentionally bounded for a private, small group: 20 users, 8 Passkeys per user,
8 live sessions per user, 20 outstanding invitation records, 32 challenge/completion records and
60 KiB per complete state. The append log defaults to a 512 MiB hard limit and fails closed when
full. Rate counters are separate small objects, so failed login traffic does not copy the registry
into the main log.

This design minimizes managed products and fixed cost. It has more OSS reads/writes than a
database and is not suitable for public registration or high concurrency. Monitor log size; an
offline compaction/rotation procedure should be added before the log approaches its limit.

### Initialize and administer

Run these commands locally from `functions/private-auth/` after `npm ci`. The administrator tool
is excluded from the deployment ZIP.

```bash
node scripts/admin.mjs bootstrap
node scripts/admin.mjs invite private-resources
node scripts/admin.mjs invite private-resources english-learning
node scripts/admin.mjs invite
node scripts/admin.mjs list
node scripts/admin.mjs revoke-invite <invitation-hash>
node scripts/admin.mjs disable <user-id>
node scripts/admin.mjs enable <user-id>
node scripts/admin.mjs permissions <user-id> private-resources
node scripts/admin.mjs permissions <user-id> private-resources english-learning
node scripts/admin.mjs permissions <user-id> private-resources private-resources-write
node scripts/admin.mjs permissions <user-id>
```

`bootstrap` creates the initial owner invitation and refuses an initialized store. If that token
is lost before enrollment, use `reissue-bootstrap`. Ordinary invites create members; the browser
cannot choose role or permissions. Invitation bearer tokens contain 96 bits of randomness encoded
as 16 Base64URL characters, are returned once, stored only as SHA-256 hashes and expire after
24 hours by default. Configure `INVITATION_TTL_SECONDS` between
300 and 604800 seconds.

For full credential loss, verify identity outside the site and run:

```bash
node scripts/admin.mjs recover <user-id> --confirm-revoke-all
```

Recovery revokes every old Passkey and session for the account and returns a one-time enrollment
token. Keep two independent owner authenticators. If an administrator write times out, inspect
`list` before retrying; never repeat recovery blindly.

To initialize OSS mode with existing owner public credentials:

```bash
node scripts/admin.mjs import-owner /absolute/private/path/credentials.json
```

The JSON uses the same `id`, base64url `publicKey`, `counter`, `transports` and optional
`webauthnUserId` fields as environment mode. Test real-device login before changing production
traffic. Switching back to environment mode after revocation would trust the old environment
allowlist again.

## Persistent HTTP API

All paths are relative to `/api/private-auth/`.

| Endpoint | Request / behavior |
| --- | --- |
| `POST register/options` | Invitation token, display name and credential name |
| `POST register/verify` | WebAuthn registration response; returns a session |
| `POST challenge` / `POST verify` | Discoverable Passkey login |
| `GET session` | Current user, grants, CSRF token and expiry |
| `POST reauth/challenge` / `POST reauth/verify` | Refreshes server-side recent-auth time |
| `GET passkeys` | Own credential metadata only |
| `POST passkeys/options` / `POST passkeys/verify` | Add a Passkey after recent authentication |
| `POST passkeys/rename` / `POST passkeys/remove` | Manage own Passkeys; last key cannot be removed |
| `POST sign` | Sign resources under `PRIVATE_RESOURCE_ROOT`; requires private-resource access |
| `POST uploads/init` | Validate metadata and return short-lived, path-bound OSS PUT URLs; owner or write grant only |
| `POST uploads/complete` | Verify every uploaded object, write metadata and publish the collection index |
| `POST logout` | Revoke the current persistent session |

Recent authentication lasts five minutes. WebAuthn verification requires user verification, the
configured origin and RP ID. Persistent fixed-window limits allow 120 authentication attempts per
minute globally and 20 per platform-reported source IP. IPs are SHA-256 hashed in OSS object names;
caller-provided forwarding headers are not trusted.

The signing endpoint accepts a fixed catalog request or up to 12 named paths. Every requested path
must be an absolute, normalized child of `PRIVATE_RESOURCE_ROOT`; traversal, encoded paths, query
strings, fragments, backslashes and unsafe path segments are rejected. The previous lesson-index
and episode request formats remain supported while clients migrate. Owners, accounts with the new
`private-resources` grant and accounts with the legacy `english-learning` grant may sign resources.
Revocation stops new signed URLs but cannot invalidate a URL already issued before its CDN type-A
expiry.

Upload URLs bind the object path, method, content type and `x-oss-forbid-overwrite=true`, and expire
after 15 minutes. The browser never receives OSS credentials. Audio and plain-text transcript are
required for `audio-transcript` collections; PDF is optional. An item is added to `index.json` only
after every object is present with the declared size and type and the transcript passes a basic
content check. A short-lived OSS lock object serializes index replacement across function
instances. Keep the GitHub Actions resource-sync workflow concurrency at one and avoid publishing
the same collection from Actions while a browser upload is being finalized.

The generic private-resource catalog belongs at `/private/index.json` in the CDN-backed private
content bucket. A deployable copy is provided at `examples/private-resource-index.json`; its
minimal structure is:

```json
{
  "schemaVersion": 1,
  "updatedAt": null,
  "collections": [
    {
      "collectionId": "6minuteenglish",
      "title": "6 Minute English",
      "description": "BBC Learning English 精听、跟读与复述课程",
      "type": "audio-transcript",
      "basePath": "/private/english-learning/6minuteenglish",
      "indexPath": "/private/english-learning/6minuteenglish/index.json",
      "tags": ["英语学习", "精听", "B1-B2"]
    }
  ]
}
```

## Local verification and deployment

```bash
npm ci
npm test
npm audit --omit=dev
```

Tests cover invitation and credential ownership, CAS conflicts, OSS snapshots and Range reads,
ambiguous appends, independent persistent rate counters, recovery/session revocation and real
P-256 WebAuthn verification. A real FC RAM role, internal OSS endpoint and device registration
must still be checked before production rollout.

The website deployment workflow creates `private-auth.zip` with `index.js`, `package.json`,
`package-lock.json` and production `node_modules` at the ZIP root. It uploads the ZIP and SHA-256
file to the private content bucket under `functions/`. Runtime secrets, operator scripts and tests
are excluded from the artifact.
