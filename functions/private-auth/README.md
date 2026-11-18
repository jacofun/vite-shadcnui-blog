# Private authentication Web function

This Node.js Function Compute Web function supports two explicitly selected modes:

- `AUTH_STORE=environment` (default): single-owner login with pre-registered Passkeys.
- `AUTH_STORE=oss`: invitation-only registration, per-user Passkeys, revocable sessions,
  permission checks and operator-controlled account recovery.

Both modes issue Alibaba Cloud CDN type-A signed URLs for authenticated private resources.
The function does not proxy those files. In OSS mode, authentication state is stored in a
separate private OSS bucket used only by Function Compute; that bucket must not be a CDN origin.

## Runtime

The website sends `POST /api/private-auth/health` on foreground entry and every 60 seconds
after the previous check completes. Hidden or offline pages pause checks; returning to the
page resumes them. Each request times out after 10 seconds. This best-effort heartbeat reduces
idle cold starts but cannot prevent platform recycling. It omits credentials and does not renew
sessions, access OSS or invoke a model. The endpoint requires an allowed browser Origin and
returns uncached `{ "ok": true }` in either auth-store mode.

- Custom runtime: Debian 10 with Node.js 20
- Startup command: `node server.js`
- Listening port: `9000` (read from `FC_SERVER_PORT` when supplied by Function Compute)
- Direct HTTPS domain: `https://www.yanxiao.me/api/private-auth/*`
- Minimum instances: `0`
- Recommended maximum instances: `1` for this private deployment
- Timeout: at least `45` seconds when AI grading or question answering is enabled

The HTTP trigger must allow anonymous browser requests; application authentication is enforced by
the handler. Do not log cookies, WebAuthn assertions, invitation tokens, registry data or signed
resource URLs.

## Common configuration

```text
WEBAUTHN_ORIGIN=https://yanxiao.me
WEBAUTHN_RP_ID=yanxiao.me
SESSION_CURRENT_KEY=<32 random bytes encoded as base64url>
CDN_AUTH_KEY=<the alphanumeric key configured for CDN type-A authentication>
```

Generate the session secret locally:

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

Every POST must contain an HTTPS Origin on `yanxiao.me` or one of its subdomains. Credentialed
CORS responses reflect the validated Origin because wildcard subdomains cannot be combined with
`Access-Control-Allow-Credentials`. Authenticated POSTs also require the CSRF token returned by
`verify` or `session`. Authentication responses are always uncacheable.

## AI request limits and retry behavior

All public assistant requests now require the existing `OSS_CONTENT_*` configuration, in both
login modes. Quotas use the content bucket under `${PRIVATE_RESOURCE_ROOT}/.ai-limits/` (default
`private/.ai-limits/`), covered by the same `private/*` RAM permissions as uploads. This internal
dot-prefixed path is rejected by the resource signing API. No authentication registry or model
is accessed by `/health`.

Limits count accepted requests, including model failures. Public limits apply globally and per
hashed source IP; episode questions and Just Write share private limits globally and per user.
A rejected request returns HTTP 429 with `AI_RATE_LIMITED` before any model call. Both JSON and
SSE use the same limits. Defaults can be overridden in the function environment:

| Setting | Default |
| --- | ---: |
| `PUBLIC_AI_GLOBAL_MINUTE_LIMIT` | 60 |
| `PUBLIC_AI_GLOBAL_DAILY_LIMIT` | 1000 |
| `PUBLIC_AI_IP_MINUTE_LIMIT` | 6 |
| `PUBLIC_AI_IP_DAILY_LIMIT` | 100 |
| `PRIVATE_AI_GLOBAL_MINUTE_LIMIT` | 60 |
| `PRIVATE_AI_GLOBAL_DAILY_LIMIT` | 2000 |
| `PRIVATE_AI_USER_MINUTE_LIMIT` | 20 |
| `PRIVATE_AI_USER_DAILY_LIMIT` | 200 |

Daily counters reset at UTC midnight; minute counters use fixed UTC minute windows. Configure a
lifecycle expiration for `private/.ai-limits/` after at least two days to remove inactive client
counters. These are request budgets, not an exact currency budget or an in-flight concurrency
semaphore. Existing `ASSESSMENT_DAILY_LIMIT` remains separate and unchanged.

Upload publication uses the upload token's issue time so the exact completion request can be
retried after a lost response or failed index write. Conflicting metadata remains rejected.
Grading attempts are claimed through `updateJson` before quota consumption or model calls;
abandoned `grading` states can be retried after 120 seconds. A claim ID prevents an old worker
from overwriting a replacement attempt. Completed retries replay the requested JSON/SSE format.

The existing content-store lease is retained: it is not a linearizable distributed lock during
lease expiry and takeover. Use the documented single-instance boundary for this deployment.
A complete storage-protocol change and cross-instance fencing are deferred; OSS PutObject does
not support HTTP `If-Match` conditional replacement.

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
```

Use the same region as Function Compute and the HTTPS internal OSS endpoint. The Web server reads
rotating STS credentials from the `x-fc-access-key-id`, `x-fc-access-key-secret` and
`x-fc-security-token` request headers supplied by Function Compute; no long-lived AccessKey is
required in the function environment. Local administrator commands can use:

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
| `POST collections/create` | Create a private `files` collection and its index; owner only |
| `POST collections/delete` | Remove a `files` collection, its index and indexed objects; owner only |
| `POST files/delete` | Remove an indexed file and its metadata; owner or write grant only |
| `POST clipboard/get` | Read the private OSS-backed text clipboard |
| `POST clipboard/save` / `POST clipboard/delete` | Add or remove clipboard entries; owner or write grant only |
| `POST just-write/list` / `POST just-write/save` / `POST just-write/delete` | List, create, revise and delete personal English writing; owner only |
| `POST just-write/teach` | Stream English Markdown advice with `Accept: text/event-stream`; owner only |
| `POST trading/ai/parse` | Owner-only natural-language trade extraction; no storage mutation |
| `POST trading/ai/apply` | Owner-only, revision-checked atomic note/execution/timeline/review persistence |
| `POST assessment/grade` | Independently grade and persist a retelling or one AI short-answer question |
| `POST assessment/result` | Return the latest retelling result, or a question result when `questionId` is supplied |
| `POST assessment/ask` | Answer a question about the current episode through the shared assessment model |
| `POST public/assistant/ask` | Stateless current-page Q&A for visitors; no login required |
| `POST uploads/init` | Validate metadata and return short-lived, path-bound OSS PUT URLs; owner or write grant only |
| `POST uploads/complete` | Verify every uploaded object, write metadata and publish the collection index |
| `POST logout` | Revoke the current persistent session |

Just Write entries and optional AI feedback live in `fc/just-write/owner/entries.json`, outside the signed private resource catalog. The service checks the owner role for every Just Write operation. `teach` sends the submitted text to the configured assessment model and streams English Markdown advice without saving the draft. Without the stream accept header, it returns the older structured JSON response in English for existing clients. Previously saved structured feedback remains readable.

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


### AI trading journal

The trading journal uses the existing Function Compute authentication, private content store,
`DASHSCOPE_API_KEY`, `DASHSCOPE_BASE_URL`, `ASSESSMENT_MODEL`, and
`ASSESSMENT_TIMEOUT_MS` settings. No separate trading AI API key or additional infrastructure is needed.
Unlike `assessment/ask` and `just-write/teach`, `trading/ai/parse` is intentionally excluded from
the private AI rate-limit middleware; ordinary authenticated endpoint validation and model timeouts still apply.

The React trade editor first calls `trading/ai/parse` with the natural-language text, current
trade ID (optional), and a time zone (`Asia/Shanghai`, `Asia/Tokyo`, or `UTC`). The backend
resolves today/yesterday/the day before and explicit hour/minute expressions against its current
clock, then sends the annotated statement and existing trade context to the shared Qwen model.
The model returns an untrusted proposal, normalized and validated by the server. There is no
automatic mutation before the owner explicitly applies the preview.

`trading/ai/apply` commits the original statement, generated summary, structured proposal,
unfilled-field warnings, executions, non-execution timeline events, and any applicable review
in a single content-store update. Repeated requests with the same note ID are idempotent.
Previously confirmed plans remain immutable. Retrospective records are marked as such; later
natural-language supplements to previously missing historical plan fields generate new
revision snapshots without replacing the original. Unknown execution price, quantity, or
timestamp is retained as narrative rather than fabricated. Unknown fees are tracked with
`feesComplete=false` and shown as a warning when displaying realized results. R calculations
are deterministic and are based on recorded initial risk, not on language-model arithmetic.

The existing advanced form and screenshot workflow remain available. The AI feature only
organizes privately supplied trade information; it does not access the trading exchange or
verify that a historical fill actually happened.

### English assessment and episode assistant

The assessment routes use Alibaba Model Studio's OpenAI-compatible Chat Completions API. Configure
these variables on the existing function; login and lesson access continue to work before they are
present:

| Variable | Value |
| --- | --- |
| `DASHSCOPE_API_KEY` | Model Studio API key |
| `DASHSCOPE_BASE_URL` | `https://dashscope.aliyuncs.com/compatible-mode/v1` for Beijing |
| `ASSESSMENT_MODEL` | Optional; defaults to `qwen3.7-plus-2026-05-26` |
| `PUBLIC_ASSISTANT_MODEL` | Required only by the public page assistant; must differ from `ASSESSMENT_MODEL` and has no fallback |
| `ASSESSMENT_TIMEOUT_MS` | Optional; defaults to `40000` |
| `ASSESSMENT_RUBRIC_VERSION` | Optional; defaults to `retelling-v1` |
| `ASSESSMENT_DAILY_LIMIT` | Optional per-user model-call limit; defaults to `20` |
| `ASSESSMENT_STORAGE_PREFIX` | Optional FC-only OSS prefix; defaults to `fc/english-assessment` |

Results are kept outside `PRIVATE_RESOURCE_ROOT`, so they cannot be exposed through the CDN signing
endpoint. Grading calls return JSON and completed attempt IDs are idempotent. The server recomputes
objective scores from episode metadata before saving them.

`POST /assessment/ask` uses the same `ASSESSMENT_MODEL`. Requests with
`Accept: text/event-stream` receive `meta`, `delta`, `done` and `error` events as model output is
generated; JSON responses remain available during migration. It receives the current episode ID, one question and up to six recent chat
messages. The server supplies the episode transcript and instructs the model to stay within that
episode. Transcript and user text are treated as untrusted input so embedded instructions cannot
change the assistant's scope or request secrets. Assistant questions do not consume
`ASSESSMENT_DAILY_LIMIT` and their conversation history is stored only in the browser.

`POST /public/assistant/ask` is available to site visitors without a login cookie or CSRF token.
It accepts only `pagePath` and one question of at most 140 characters; conversation history is
rejected and nothing is persisted. The function loads the trusted current-page or notes-index material from
`/ai-assistant-context.json`, asks `PUBLIC_ASSISTANT_MODEL` for a concise Simplified Chinese answer,
and supports the same streamed and JSON response modes.
Opening the assistant presents page-specific starter questions without sending a request. The system
prompt confines answers to the homepage, notes index, current note or wedding
memorial page, treats page and visitor text as
untrusted, and caps each model response at 500 tokens. The route requires an allowed browser
Origin.

Upload URLs bind the object path, method, content type and `x-oss-forbid-overwrite=true`, and expire
after 15 minutes. The browser never receives OSS credentials. Audio and plain-text transcript are
required for `audio-transcript` collections; PDF is optional. An item is added to `index.json` only
after every object is present with the declared size and type and the transcript passes a basic
content check. A short-lived OSS lock object serializes index replacement across function
instances. Keep the GitHub Actions resource-sync workflow concurrency at one and avoid publishing
the same collection from Actions while a browser upload is being finalized.

Owners can create generic `files` collections from `/resources`. These collections accept multiple
browser-selected files, uploaded one at a time with a 1 GiB per-file limit. MP3, MP4 and FLV files
are assigned fixed media content types and their container signatures are checked before the item
is published. Other extensions are stored as `application/octet-stream` and deliberately receive
no open or download link. The browser uses native playback for MP3/MP4 and MSE through `mpegts.js`
for FLV; actual codec support still depends on the browser.

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

The function deployment workflow creates `fc-blog-authenticator-web.zip` with `server.js`,
`index.js`, `publishing.js`, `public-publishing.js`, `package.json`, `package-lock.json` and production `node_modules` at the ZIP root. It
uploads the ZIP to the private content bucket under `functions/fc-cicd/`, then updates only the
code of `fc-blog-authenticator-web`. Runtime secrets, operator scripts and tests are excluded from
the artifact.

## Owner publishing workspace

Local implementation: `/resources/publish` reuses the existing Passkey session and CSRF token.
Only `owner` can manage content; the resource-upload grant alone does not grant publishing rights.
There is no new password or login endpoint. The new `publishing.js` module must be packaged with
`index.js` and `server.js`; the FC packaging workflow includes it.

- `POST publishing/list`: drafts, publication state and uploaded media previews.
- `POST publishing/upload-init` / `publishing/upload-complete`: reuse direct signed OSS PUT,
  progress/retry support, and server-side size/type/container-header validation. Images: JPG,
  JPEG, PNG and WebP (20 MiB). Videos (1 GiB): MP4, M4V, MOV, F4V, 3GP, 3G2, WebM, MKV,
  AVI, WMV, ASF, FLV, MPG, MPEG, MPE, M2V, VOB, TS, MTS, M2TS, OGV, RM and RMVB.
  Completion is idempotent within the 15-minute upload token. Header checks identify the
  expected container; they do not decode the complete file, inspect codecs or scan for malware.
- `publishing/list` also returns `uploadFormats` with each extension, MIME type, media kind
  and byte limit. The owner file picker and preflight checks use this list; the server still
  independently validates the upload. Publishing validation errors preserve their HTTP 4xx
  status, code and message rather than being reported as authentication-service failures.
- `POST publishing/save`: save an article or media moment draft, optional Markdown body up to
  30,000 characters and up to 12 selected media assets. Media is optional.
- `POST publishing/publish` / `publishing/unpublish`: explicitly publish a snapshot or withdraw
  it. Editing a draft does not change the previously published snapshot. Writes require the
  current version, preventing silent overwrite by stale editors.
- `GET public/content`: anonymous, uncached, published snapshots only. Private fields, other
  media and drafts are excluded. Media URLs are generated only for the selected published assets.

Content and uploads live in `${PRIVATE_RESOURCE_ROOT}/.publishing/` in the existing content bucket.
Existing `private/*` RAM permissions cover the default prefix. No existing private collection is
made public. Published media remains stored privately and is delivered through the existing CDN
signature mechanism. Shared URLs can remain usable until the CDN-configured authentication window
ends; withdrawal immediately removes the item from the API, but is not immediate media revocation.
CDN signature duration follows the CDN configuration, not a per-link expiry parameter.

Published articles are linked from `/notes`, moments from `/fragments`; `/journal` lists public
entries and `/journal/:entryId` displays one entry. Existing Markdown-in-git notes stay supported.
Dynamic entries are not yet included in the build-generated RSS, sitemap or AI context; the public
journal supports reading them without a frontend rebuild. The owner workspace is bounded to 100
entries and 500 uploaded assets, and uses the existing content-store locking boundary. Asset garbage
collection and transcoding are not part of this change.

Video originals are stored without conversion. Browser playback depends on both container and
codec support; accepting MOV, MKV or older formats does not guarantee inline playback. Owner
previews, public entries and the homepage video dialog provide an original-file link and a
message on playback failure. Cross-origin downloads can open a browser tab rather than force
a save. H.264/AAC MP4 remains a suitable export option when broad device playback is needed.

Validate with `npm test --prefix functions/private-auth`, `npm run test:client`, `npm run lint`,
and `npm run build`. Browser verification can use a mocked OSS adapter; production OSS/CDN access
and deployment must be checked separately before release.

## Public content served directly by OSS

Visitors read `/published/content.json` and `/published/media/<asset-id>.<format>` from the
website bucket. No login, FC response, runtime signature or FC heartbeat is required for public
reading. The legacy FC public-content endpoint remains for compatibility; the site does not use
it as a fallback. Authentication, upload authorization, publishing and AI remain dynamic.

FC keeps authoritative drafts/publication snapshots in the private bucket. On publish,
unpublish or owner `publishing/sync-public`, selected publication originals are streamed once
to the website bucket. Already copied originals are reused. Only whitelisted snapshot fields
are written to the manifest; draft bodies, private paths and unselected uploads stay private.
Each JSON object replacement is atomic at OSS, but the private index, media copies and public
manifest are not one distributed transaction. Failed synchronization reports `PUBLIC_SYNC_PENDING`;
refresh the editor and use “同步公开内容” to repair from authoritative snapshots. The existing
single-instance store boundary still applies. Publication/sync holds the index lease for up to
15 minutes; a crashed invocation requires waiting for that lease before retrying. Large originals
consume FC transfer time only while publishing, never while visitors browse. A request that
hits FC's configured execution timeout can be retried; completed originals are reused.

The FC workflow merges only `PUBLISHING_PUBLIC_*` settings into existing environment variables,
using the existing website bucket target/region and deployment secrets, then runs
`scripts/sync-public-content.mjs` to migrate existing **published** snapshots. Other FC runtime
settings and environment variables are preserved. Temporary migration credentials are removed
with an always-run cleanup step and are not logged. Deployment requires FC GetFunction permission.
The website OSS credential needs GetObject/PutObject/DeleteObject under `<site-prefix>/published/*`;
the source credential needs read access to the private publishing prefix. No bucket-wide ACL or
private-bucket visibility is changed. Review credential scope before deployment; a dedicated key
restricted to the published prefix can replace the reused website deployment key later.

Public JSON uses `no-cache,max-age=0,must-revalidate`; media uses a 60-second cache. CDN rules
for `/published/*` must honor these origin headers and must not require private-path signatures.
Withdrawing removes the entry and deletes originals that no remaining publication references;
previously cached/downloaded copies are not revoked. Deletion is attempted before manifest
replacement so storage errors remain retryable. A failed withdrawal manifest write can leave an
older manifest referring to removed media until synchronization is retried. Frontend deployment
never deletes the `published/` prefix. Do not add an empty build-time manifest over this live data.
Before switching an existing deployment's frontend, complete the FC migration and verify the
static manifest and media URLs anonymously; confirm your CDN cache rules separately.

## 交易函数共用短期凭证

前端通过现有登录 Cookie、Origin 和 CSRF 校验调用 `POST /api/private-auth/trading/binance/token`。只有 `owner` 可以领取有效期 120 秒、用途为 `trading:sync` 的 RS256 JWT；OSS 注册表模式继续检查会话撤销、账号状态与权限。该接口不创建交易内容存储，也不访问新加坡或币安。

北京 FC 新增以下环境变量，现有登录/存储配置全部保留：

| 变量 | 值 |
| --- | --- |
| `BINANCE_SYNC_PRIVATE_KEY` | 仅北京保存的 PKCS#8 RSA PEM 私钥，至少 2048 位；接受换行或字面量 `\n` |
| `BINANCE_SYNC_KEY_ID` | `trade-sync-v1`，须匹配新加坡 JWKS 的 `kid` |
| `BINANCE_SYNC_ISSUER` | `https://www.yanxiao.me` |
| `BINANCE_SYNC_AUDIENCE` | `binance-trade-sync` |
| `BINANCE_SYNC_URL` | `https://yanxiao.me/trade/api/sync`，新加坡服务的 HTTPS 反向代理地址；与北京 API 域名独立 |

除私钥外均提供表内默认值，FC 原生 JWT 策略须接受上述签发者与受众。私钥缺失或配置无效只会使本接口返回 `503 BINANCE_SYNC_UNAVAILABLE`，不影响原登录和交易日志。不得将私钥放入 `VITE_*`、前端源码、GitHub 仓库或日志。

前端拿到凭证后经 `/trade/api/sync` 直接调用新加坡；北京不代理同步。同步结果只反映原始成交/资金流水写入，暂不将它们自动生成交易日志或纳入网站统计。前端不持久化令牌、不自动重试长请求；注销阻止领取新凭证，已签发凭证在最长 120 秒有效期内仍可用，已开始的任务继续运行。

密钥生成、FC 原生 JWT 配置、FC 原生 JWT 触发器、CDN 透传及轮换步骤见 [binance-trade-sync README](https://github.com/jacofun/binance-trade-sync#6-登录后前端直连新加坡)。部署 ZIP 已包含 `binance-sync-token.js`，工作流不写入签名私钥。

验证命令：`npm test --prefix functions/private-auth`、`pnpm test:client`（包含直接同步时的 Cookie/CSRF 隔离、过期令牌、错误目标和中断不重试测试）、`pnpm lint`、`pnpm build`。


同步入口由 `/trade/api` 迁移至 `/trade/api/sync`。CDN 应将新路径映射到现有新加坡函数，允许 POST 和 OPTIONS、透传 X-JWT-Token，并禁用缓存。新加坡处理器不依赖 CDN 外部路径，无需新增新加坡环境变量。

同步端点默认是 `https://yanxiao.me/trade/api/sync`，获取凭证的北京 API 仍是 `https://www.yanxiao.me/api/private-auth/trading/binance/token`。前端允许受控的 `yanxiao.me` 和 `www.yanxiao.me` 的 `/trade/api/sync`，不要求同步端点与北京 API 同源。**已有 FC 环境变量优先于默认值**：若北京此前显式配置了 `BINANCE_SYNC_URL`，请手工将旧路径改成新路径，推荐值为 `https://yanxiao.me/trade/api/sync`。无需重新生成密钥，`BINANCE_SYNC_ISSUER` 与 FC 原生 JWT 策略保持一致。

是否跨域由浏览器页面的 Origin 决定：使用 `https://yanxiao.me` 打开网站时，同步为同源请求；页面位于 `https://www.yanxiao.me` 时，同步才需要新加坡入口的 CORS。若保留 www 页面，需在 CDN/网关处理无 JWT 的 OPTIONS 预检，并允许 `Origin: https://www.yanxiao.me`、`POST`、`X-JWT-Token` 和 `Content-Type`，POST 仍执行 JWT 校验。不要假定放开前端地址校验就完成了网关 CORS 配置。


### 后续云函数的统一 JWT 请求头

同步前端使用 `X-JWT-Token: Bearer <JWT>`，新加坡代码和 FC 平台 JWT 的 Header 参数名也必须为 `X-JWT-Token`。保留 `Bearer ` 前缀的末尾空格；CORS 允许 `X-JWT-Token`、`Content-Type`，CDN 透传该请求头。业务 JWT 不再通过 `Authorization` 传递，避免与 CDN 的 OSS 回源签名共用字段；新加坡也不会从旧请求头回退读取凭证。

交易同步与行情分析复用本节的签发接口及全部 `BINANCE_SYNC_*` 配置，沿用现有 audience/scope。浏览器拿到凭证后直连同一域名的 `/trade/api/sync` 或 `/trade/api/signal/analyze`，不会让北京转发行情分析请求。签名、公钥及 issuer/audience 策略统一由 FC 原生 JWT 入口管理，两个业务函数无需 JWT 环境变量；旧 `SYNC_JWT_*`、`SIGNAL_JWT_*`、`SIGNAL_AUTH_MODE` 不再读取，可删除。共用凭证授权这两项交易能力，签发接口继续只允许 owner，并保留登录态、Origin、CSRF 与撤销检查。

交易日志页面新增“分析交易机会”：默认 BTCUSDT，可选择顺势、反转或综合风格，显示候选方向、入场、止损、目标、证据、反对理由、耗时和请求编号。结果到期后在页面标记过期，不写 OSS、不自动下单。暂无机会也属于成功响应；错误展示函数/FC 错误码和请求编号。分析请求不自动重试，关闭面板或取消等待会中止浏览器请求。无新增北京环境变量，模型参数继续在交易信号函数维护。

代码部署后，需在新加坡 HTTP 触发器或实际回源自定义域名的 JWT 设置中手工将 Header 名称从 `Authorization`（或排查时的临时名称）改为 `X-JWT-Token`。若 CDN/网关另有 CORS 配置，也须允许新请求头。无需更换现有签名密钥或调整函数环境变量，工作流不会替你修改平台鉴权设置。

## 勾选币安成交并创建交易日志

交易日志增加“币安实盘 · 勾选成交”。桌面端点击成交整行、移动端点击成交卡片即可切换选择；复选框和日志链接独立操作。打包成功后返回交易记录列表，需要写复盘时再进入三个问题编辑器。浏览器使用网站原有登录 Cookie 和 CSRF 调用北京的 `POST trading/binance/list`、`preview`、`import`；仅 owner 可操作。新加坡的同步接口和 `X-JWT-Token` 方案继续沿用，读取数据和打包日志不再调用币安或新加坡。

北京函数需读取新加坡写入的私有 OSS 目录。可配置以下环境变量；Bucket、地域和端点未填写时复用 `OSS_CONTENT_BUCKET`、`OSS_CONTENT_REGION`、`OSS_CONTENT_ENDPOINT`，目录默认 `fc/binance-sync/owner`：

```json
{
  "BINANCE_DATA_OSS_BUCKET": "新加坡同步使用的 OSS_BUCKET",
  "BINANCE_DATA_OSS_REGION": "oss-cn-beijing",
  "BINANCE_DATA_OSS_ENDPOINT": "https://oss-cn-beijing-internal.aliyuncs.com",
  "BINANCE_DATA_OSS_PREFIX": "fc/binance-sync/owner"
}
```

若北京函数不具备同地域内网访问条件，端点使用 `https://oss-cn-beijing.aliyuncs.com`。这些值配置在北京网站 FC，不是 GitHub Secrets；同步目录必须与新加坡的 `OSS_PREFIX` 完全一致。现有部署保留这些环境变量。

使用网站现有 OSS 凭据来源（FC 调用临时凭据或 `ALIBABA_CLOUD_ACCESS_KEY_ID/SECRET`，与原 content store 一致），为对应角色/账号追加同步目录的只读权限即可，无需复制新加坡的币安 API Key 或新增部署密钥：

```json
{
  "Version": "1",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["oss:GetObject"],
    "Resource": ["acs:oss:*:*:YOUR_BUCKET/fc/binance-sync/owner/*"]
  }]
}
```

将 Bucket 和目录替换为实际值，追加到现有授权而非覆盖原策略。跨账号 Bucket 还需配置资源侧授权。本功能不需要 ListObjects、写入或删除原始成交的权限。读取仅允许固定 state 和按交易对/月组织的成交路径，客户端不能指定 Bucket 或任意对象名；权限、JSON 或账户绑定异常会报错，不按空记录处理。

列表按北京时间筛选、转换为 UTC 月分区读取，每次最多 93 天、每页 50 条。已落盘的历史月份可持续查看，不受币安在线历史接口窗口限制；最多勾选 150 条成交。前端只提交成交编号，后端重新读取原始价格、数量、费用与盈亏。支持跨页选择、创建新日志、补充同账户/交易对/持仓方向的待补全或持仓中币安日志，日志更新与重复关联检查在既有 entries.json 更新锁内完成；相同请求可重试，不会重复创建或导入。

原计划的入场价、止损和计划数量不从实际成交反推，留待本人补充；成交均价在预览中单独展示。记录保留 binding、原始成交/订单编号和十进制字段作为来源。账目金额通过 18 位定点十进制相加，日志净成交损益采用币安 realizedPnl 减已知的同结算币种 commission，不额外叠加 income 流水，不分摊资金费。异币种费用保留原币种与数值，不做隐式换汇，标记费用不完整并排除业绩统计。API Key 轮换会改变同步 binding；需要迁移历史时，先核对来源关系，不应把同账户旧成交当作新账户重新导入。

用户须明确确认“从开仓开始至今的成交均已选齐”。未确认、起始仓位不明、反手或缺少开仓时保存为“待补全”，不进入胜率/R 统计；新增的更早开仓或后续平仓可补充到同一日志。确认完整且数量归零时才是已平仓。单向持仓需选择多空；双向持仓的 LONG/SHORT 与方向必须一致，不能混合打包。一个交易对内多轮独立开平仓应由用户分别打包。

币安执行时间轴只读，手工更正/新增接口不会改写已关联成交。AI 继续保存三个问题的原文、总结和复盘，也可补充原计划中空缺的风险字段；文字中再次提及成交时不重复新增执行。净成交损益不等同于包含资金费的账户收益；缺少初始风险时 R 保持为空。

验证：`npm test --prefix functions/private-auth` 覆盖服务端原件读取、北京时间跨月、长 ID、精确费用、重复/并发导入、补充成交、方向与完整性、权限及来源只读；`npm run test:client`、`npm run lint`、`npm run build` 验证原前端流程和类型/构建。功能上线后需用 owner 登录验证实际 OSS 读取权限与目录。
