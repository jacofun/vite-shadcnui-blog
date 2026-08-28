# Private authentication function

This Node.js Function Compute handler authenticates the site owner with a pre-registered
WebAuthn credential, stores a stateless encrypted session in an HttpOnly cookie, and issues
Alibaba Cloud CDN type-A signed URLs for the private English-learning resources.

The function does not read OSS objects, proxy private resources, or persist user data. CDN and
OSS continue to serve the files after CDN validates each signed URL.

## Runtime

- Node.js 20 or newer built-in runtime
- Handler: `index.handler`
- HTTP trigger path exposed through CDN: `/api/private-auth/*`
- Minimum instances: `0`
- Timeout: `3` seconds

The CDN origin must overwrite `X-Origin-Verify` for `/api/private-auth/*`. Do not log this header,
cookies, WebAuthn assertions, or signed resource URLs.

## Required environment variables

```text
WEBAUTHN_ORIGIN=https://yanxiao.me
WEBAUTHN_RP_ID=yanxiao.me
WEBAUTHN_CREDENTIAL_ID=<base64url credential ID>
WEBAUTHN_PUBLIC_KEY=<base64url COSE public key>
SESSION_CURRENT_KEY=<32 random bytes encoded as base64url>
CDN_AUTH_KEY=<the alphanumeric key configured for CDN type-A authentication>
CDN_ORIGIN_VERIFY_KEY=<at least 32 random characters, also configured in the CDN origin header>
```

For multiple Passkeys, replace the two single-credential variables with:

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
AUTH_COOKIE_NAME=__Secure-private_auth
AUTH_COOKIE_PATH=/api/private-auth/
```

The WebAuthn credential must be registered for RP ID `yanxiao.me` by a trusted one-time
registration process. Registration is deliberately excluded from the public function so an
attacker cannot enroll a new authenticator. Store the returned credential ID and COSE public key
in Function Compute environment variables. This stateless design does not persist authenticator
signature counters, so it cannot provide counter-based cloned-authenticator detection; each login
is still bound to a short-lived, encrypted, single-session challenge.

## API

```text
POST /api/private-auth/challenge
POST /api/private-auth/verify
GET  /api/private-auth/session
POST /api/private-auth/sign
POST /api/private-auth/logout
```

Every request must contain the CDN-injected `X-Origin-Verify` header. Every POST must also contain
`Origin: https://yanxiao.me`. After login, `/sign` and `/logout` require the `X-CSRF-Token` returned
by `/verify` or `/session`.

Sign the private lesson index:

```json
{ "resource": "index" }
```

Sign the four fixed files for an episode:

```json
{ "episodeId": "260827-how-do-we-describe-smells" }
```

Arbitrary paths are never accepted by the signing endpoint.

## Local verification

```bash
npm ci
npm test
```

The website deployment workflow creates `private-auth.zip` with `index.js`, `package.json`,
`package-lock.json`, and production `node_modules` at the ZIP root. It uploads the ZIP and its
SHA-256 file to the private OSS bucket under `functions/`. Runtime secrets are never included in
the artifact.
