# HeadHunter in LibreChat administration

The HeadHunter page at `/headhunter` lets an administrator save the registered
HH application's Client ID and Client Secret, copy the fixed callback address,
connect an employer account, check that account, cancel a pending authorization,
and disconnect while retaining the application settings. Blank secret fields
preserve the saved value. Replacing application credentials invalidates the old
HH session; an old in-flight exchange cannot restore it.

This is an overlay for the pinned ClickHouse LibreChat admin panel at commit
`fce9596f823e78f991c7ef60bb97d0ce15d72934`, checked by archive SHA-256 during
build. It retains the deployed Russian translations and uses the panel's shared
Click UI controls and semantic appearance tokens; there is no feature CSS.
`prepare.cjs` installs the route, navigation, translations and server functions.
The underlying LibreChat API and main chat client do not need a new build.

## Ownership and authorization

The panel's server functions require live `access:admin` and `manage:configs`
capabilities from LibreChat on **every** operation. The browser never receives
the management token or saved Client Secret. These server functions contact the
separate HH MCP service using a dedicated management key, distinct from the chat
MCP key. This deployment has one employer account shared by authorized MCP users.
It does not share the existing owner-only LibreChat MCP connection automatically.

The callback is bound to a random state in the encrypted, HTTP-only admin
session and to the initiating user. Logout clears that pending authorization.
The HH service also uses a one-use, expiring state with PKCE. Beginning another
authorization supersedes the previous attempt; cancellation or changing the
application prevents a late exchange from installing tokens. Codes are exchanged
by the servers and the browser returns to a URL without the code.

The HH service encrypts application credentials with AES-256-GCM in its existing
private persistent data directory. Preserve its encryption key separately in the
private deployment environment and include both environment and data directory
in protected backups. Existing HH token-file compatibility is retained. In
managed mode, the chat's `hh_auth` tool exposes only `status` and `me`; it cannot
replace or disconnect the shared account. The standalone CLI remains unchanged.

## Operator bootstrap

These are infrastructure trust settings, installed once by the operator, not
user-facing application credentials. Client ID/Secret are entered in the page.

On the **HH host**, add to the existing `/opt/hh-mcp/deploy/.env`:

```dotenv
HH_ADMIN_TOKEN=<independent random 32-byte hex key>
HH_CONFIG_KEY=<independent random 32-byte hex encryption key>
HH_ADMIN_REDIRECT_URI=https://admin.artdent-ai.ru/headhunter-callback
```

`HH_OAUTH_STATE_TTL_MS` optionally shortens the default 600000 ms authorization
window; 600000 is the protocol's enforced upper bound. `HH_DATA_DIR` optionally
relocates the private data directory (default `~/.hh-mcp`). HTTPS is required for
callbacks, with HTTP loopback allowed only for local integration tests. A missing
management key keeps all admin endpoints disabled; an invalid encryption key
fails startup rather than reading encrypted secrets as plaintext.

Rebuild/recreate only `hh-mcp`. Retain the existing MCP access key, token mount
and revision tag. No application credentials are required for this deployment.

On the **LibreChat host**, build from the repository root:

```sh
docker build -f deploy/headhunter/Dockerfile \
  --build-arg ADMIN_BASE=artdent-admin:brand-20260922 \
  --build-arg REVISION=<git-head> -t artdent-admin:headhunter-<git-head> .
```

Add a private `headhunter-admin.env` to the admin-panel service's `env_file` list:

```dotenv
HH_ADMIN_URL=https://hr.artdent-ai.ru/hh/admin
HH_ADMIN_TOKEN=<the same management key as on the HH host>
```

Change only the admin-panel image and recreate that service. Keep the existing
session secret, backend URL, cookies and existing services. Include the new
private environment file in the existing configuration backup archive. The HH
application's registered Redirect URI must be the address shown by the page.

## Verification and recovery

The dedicated CI builds the pinned panel, typechecks it explicitly and lints the
overlay. The MCP fork's tests cover encryption/restart, redaction, API-key
separation, session invalidation, PKCE/state replay/cancellation, stale exchanges,
managed-chat restrictions and HH token refresh. A local provider fixture supports
browser checks without real HH credentials. Production checks stop before an
actual HH grant until the owner supplies the application credentials in the UI.

Rollback uses the recorded previous admin image and HH commit. Restore only the
matching operator environment if necessary; keep the HH private data directory.
Do not roll back MongoDB or discard another user's recent settings. Once an HH
application is configured, disabling administration must not accidentally restore
write access to `hh_auth`; keep the management-mode boundary until the newer
settings/session have been migrated deliberately.
