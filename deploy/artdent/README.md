# Artdent AI — Timeweb deployment

Deploys LibreChat v0.8.8-rc3 with OpenRouter, local authentication, agents, files,
RAG, experimental schedules, and a separate Code Interpreter v1.4.1 host.
Application and maintenance-tool images are pinned by digest in `compose.yaml`.
MongoDB, PostgreSQL/pgvector, and both Redis-compatible stores run in Timeweb DBaaS.
The Russian locale covers all English UI keys in this fork. The deployment uses
`Dockerfile.locale` to rebuild the frontend from the pinned upstream image's own
source and lockfile, replacing its Russian translation and fixing category-label
localization in the two agent grids. The runtime backend
stays at the pinned version; this avoids mixing newer fork UI code with an older
backend. The translation retains product names, API identifiers, and native
language names. The separate admin panel uses its own Russian image, described below.

## Building the Russian interface

From the repository root, build on the application server (or another Linux
AMD64 Docker host):

```sh
docker build -f deploy/artdent/Dockerfile.locale \
  --build-arg LOCALIZATION_COMMIT="$(git rev-parse HEAD)" \
  -t artdent-librechat:ru-20260922 .
```

Set `LIBRECHAT_IMAGE=artdent-librechat:ru-20260922` in the deployment's `.env`, then
run `docker compose up -d --no-deps api`. Keep the previous image and `.env` for
rollback. To revert only the interface, restore the previous `LIBRECHAT_IMAGE`
value and recreate `api`; no database restore is needed. Local image tags must
be rebuilt or transferred when moving the application to a new host.

Locale checks: `npm run test:ci --workspace=@librechat/frontend -- --runInBand
src/locales/Russian.spec.ts src/locales/Translation.spec.ts`. These check full key
coverage, interpolation variables, rich-text slots, links and runtime loading.

### Login artwork

The main `/login` page displays the approved full-length portraits on either side
of the form at widths of 1024 px and above. The PNGs in
`client/public/assets/login/` retain their original alpha channels. A responsive
`picture` uses a transparent inline placeholder on smaller screens, so mobile
visitors do not download the two desktop images. The portraits are decorative,
excluded from the accessibility tree, and cannot intercept input. Other
authentication screens retain their original layouts.
The runtime serves the portraits from `dist/assets/login` only. Do not copy that
directory into the runtime's `public/assets`: its legacy static mount also serves
the site root, where a `login` directory would redirect the `/login` route.

`Dockerfile.locale` includes the two auth components and portrait assets in its
pinned-source frontend build. The login release uses
`LIBRECHAT_IMAGE=artdent-librechat:login-20260922`; the preceding
`artdent-librechat:ru-20260922` image remains available for rollback. Only the API
container needs recreation to deploy the frontend. No database migration or
authentication behavior change is involved. Build on the 8 GiB application host
with `docker build --memory=5g --memory-swap=5g ...` to leave runtime headroom;
the frontend Node heap is capped at 4 GiB.

### Artdent branding

The app and admin panel use the tooth mark from https://artdentnn.ru/favicon.svg.
`branding/source.svg` preserves the source geometry. The generated variant uses
`#07515B` for the outline, `#087F8C` for the accent and a `#F1F8F8` backing for
visibility on both themes. Run `node deploy/artdent/branding/generate.cjs` from the
repository root after installing dependencies to regenerate the SVG, PNG and
multi-resolution ICO assets. The maskable icon keeps the tooth inside the central
80% safe circle and has an opaque background.

Both Dockerfiles include the same generated assets. The main build replaces the
login logo, browser favicons, Apple touch icon and PWA icons, including legacy
root URLs. The admin build replaces its bundled sidebar logo, public logo and
favicon. `branding/prepare.cjs` versions browser and manifest icon URLs without
changing filesystem globs. Increment its version and matching client references
when changing the artwork again. Provider and tool logos retain their identities.

The branding release uses `LIBRECHAT_IMAGE=artdent-librechat:brand-20260922` and
`ADMIN_IMAGE=artdent-admin:brand-20260922`. Build with `LOCALIZATION_COMMIT` set to
the repository revision, keep the preceding images and `.env`, then recreate only
`api` and `admin-panel`. Verify both health checks, `/login`, browser/manifest icon
URLs and the admin sidebar. Restore the previous image variables to roll back.

### Russian admin panel

`Dockerfile.admin-locale` rebuilds the admin panel from the exact deployed upstream
revision `fce9596f823e78f991c7ef60bb97d0ce15d72934`, with a verified source archive
checksum and its frozen Bun lockfile. The runtime keeps the pinned original image
and replaces only the compiled application. `admin-localization/ru.json` covers
all 1,236 upstream strings, with four additional Russian plural forms. The build
checks coverage, placeholders, numbered rich-text tags, links and TypeScript.

```sh
docker build -f deploy/artdent/Dockerfile.admin-locale \
  --build-arg LOCALIZATION_COMMIT="$(git rev-parse HEAD)" \
  -t artdent-admin:ru-20260922 .
```

Set `ADMIN_IMAGE=artdent-admin:ru-20260922` in the server's `.env` and run
`docker compose up -d --no-deps admin-panel`. Keep a copy of `.env` for rollback.
Restore its previous `ADMIN_IMAGE` and recreate only `admin-panel` to roll back;
no database changes or restore are involved. Rebuild or transfer the local image
when replacing the host.

This deployment selects Russian for every administrator, independent of browser
language or an old i18next language cache. HTML language, page title and displayed
dates also use Russian. English remains the fallback for any newly added keys.
Technical identifiers, model names and values entered by administrators are not
translated. No account roles, permissions or application settings are changed.

## Inventory

Timeweb project: `2950553`, `artdent-ai`, region `ru-1`, zone `spb-3`.

| Resource | ID/address | Configuration |
| --- | --- | --- |
| Application | server `9164141`, `188.225.73.127` | 2 × 5 GHz vCPU, 8 GiB RAM, 160 GiB NVMe |
| Execution | server `9164147`, `188.225.73.95` | 2 × 5 GHz vCPU, 4 GiB RAM, 80 GiB NVMe |
| Private execution API | `10.95.0.2:3112` | WireGuard; application peer `10.95.0.1` |
| Existing outbound proxy | `72.56.87.18:8888` | tinyproxy, application IPv4 allowlisted |
| Managed MongoDB 8.0 | cluster `4212335`, `192.168.95.30:27017` | 1 dedicated vCPU, 2 GiB RAM, 40 GiB NVMe |
| Managed PostgreSQL 15 | cluster `4212337`, `192.168.95.31:5432` | 1 dedicated vCPU, 2 GiB RAM, 40 GiB NVMe; pgvector 0.8.6 |
| Managed application Valkey 8.1 | cluster `4212339`, `192.168.95.32:6379` | 1 dedicated vCPU, 2 GiB RAM, 20 GiB NVMe |
| Managed execution Valkey 8.1 | cluster `4212341`, `192.168.95.33:6379` | 1 dedicated vCPU, 2 GiB RAM, 20 GiB NVMe |
| Main URL | `https://artdent-ai.ru` | Caddy automatic TLS |
| Administration | `https://admin.artdent-ai.ru` | LibreChat Admin Panel |
| Temporary URL | `https://artdent.188-225-73-127.sslip.io` | Until new domain delegation completes |
| Temporary administration | `https://artdent-admin.188-225-73-127.sslip.io` | Same administrator account |

Monthly prices from Timeweb's authenticated `account/services/cost` API on
2026-09-22, after resizing for 20 employees:

| Resource | Base, RUB/month | IPv4 and billed backups | Total |
| --- | ---: | ---: | ---: |
| Application | 5,400 | 200 + 960 | 6,560 |
| Execution | 3,200 | 200 + 480 | 3,880 |
| MongoDB | 2,150 | 0 | 2,150 |
| PostgreSQL | 2,150 | 240 | 2,390 |
| Application Valkey | 1,850 | 0 | 1,850 |
| Execution Valkey | 1,850 | 0 | 1,850 |
| **Project total** | **16,600** | **2,080** | **18,680** |

The previous configuration cost 26,780 RUB/month including those extras; the
reduction saves 8,100 RUB/month (30.2%). These are full-month rates, not the bill
for the partially elapsed month. The existing shared overseas proxy costs another
2,360 RUB/month including its IP and backup; allocating its entire cost to Artdent
would make the total 21,040 RUB/month. OpenRouter tokens, domain renewal and future
usage-based storage/traffic charges are separate. The current billing response
lists a separate DB backup charge only for PostgreSQL; zero means no separate
charge in that response, not a promise of free backups indefinitely.

Standard CPU plans returned `no_free_node` at provisioning; these available High
CPU configurations were used instead. General DBaaS plans returned
`no_free_resources`; dedicated CPU configurator `121` was available. The resize
retains these CPU families, IPs and disks. Disk shrinking requires a separate
migration. These are single-node database deployments, not application-level HA
clusters.

All four databases have no public IP. VPC `artdent-ai-private`
(`network-0fe44199afd5457b9726525f9b747d11`) uses `192.168.95.0/24`.
Application private IP is `192.168.95.4`; execution private IP is `192.168.95.20`.
The application requires a persistent eth1 configuration for its private address.
WireGuard remains the transport for the execution API.

Capacity assumes up to 20 registered employees with modest concurrent usage.
It is not a benchmark of 20 simultaneous model generations. Models run on
OpenRouter providers. Code workers admit one Python and one other-language job
concurrently, with an overall sandbox limit of two. The API container allows
3 GiB (2 GiB Node heap), RAG 1 GiB and the sandbox 2 GiB; Code API's default
per-job memory limit is 256 MiB. Watch peak RAM and queues as actual usage grows.
Before resizing, observed host RAM use was approximately 1.5 GiB on the app and
1.1 GiB on the runner; these idle observations are not a concurrent-load test.
PostgreSQL uses Timeweb's recommended 2 GiB settings: `shared_buffers=65536`
(512 MiB in 8 KiB pages), `effective_cache_size=131072` (1 GiB), and
`maintenance_work_mem=262144` (256 MiB in KiB).

## Application installation

Install Ubuntu 24.04, Docker Engine, Compose v2, Buildx, UFW, Fail2ban,
unattended-upgrades, and WireGuard tools. Permit inbound SSH, HTTP and HTTPS only;
allow WireGuard UDP 51820 only from the other VM. Password-based SSH is disabled.
The execution VM does not expose HTTP/HTTPS or Code API on its public address.

Copy `compose.yaml`, `librechat.yaml`, and `Caddyfile` to `/opt/artdent-ai`.
Copy the example env files to `.env`, `app.env`, and `rag.env`, respectively.
Generate independent 32-byte secrets with `openssl rand -hex 32`; `CREDS_IV`
requires 16 bytes. Keep these files mode 0600, the directory mode 0700, and never
commit real credentials. Preserve encryption keys across redeployments.

Set `MONGO_URI`, `REDIS_URI`, `POSTGRES_HOST`, `POSTGRES_USER`, `POSTGRES_DB`, and
`POSTGRES_PASSWORD` in `.env` to the managed endpoints. URL-encode passwords in
connection URIs. MongoDB authenticates against `admin`; the application database
is `LibreChat`. PostgreSQL uses `librechat_rag`, owned by the application user,
with the `vector` extension enabled through Timeweb's `pgvector` extension setting.
Valkey uses AOF with `appendfsync=everysec` and `maxmemory-policy=noeviction`;
do not use Timeweb's default `allkeys-lru` for queues and coordination state.

Local MongoDB, PostgreSQL, and Redis services are retained under the
`legacy-databases` profile and are stopped in production. Normal `compose up`
does not start them. Maintenance client containers have the `maintenance` profile
and no persistent database volumes; `backup.sh` runs these clients on demand.

`RAG_OPENAI_API_KEY` and `OPENROUTER_KEY` use the OpenRouter key. The RAG and app
JWT secrets must match. Both chat and embeddings use the overseas proxy.
The proxy requires the app's public IPv4 in both tinyproxy Allow and UFW rules.
`NO_PROXY` must include every internal service and `10.95.0.2`.

```sh
cd /opt/artdent-ai
docker compose config --quiet
docker compose up -d
docker compose exec -e ALLOW_REGISTRATION=true api \
  node config/create-user.js ADMIN_EMAIL Admin admin --email-verified=true
```

Enter the initial password at the prompt. The first account becomes ADMIN.
Public registration remains disabled in the serving API. Add other employees
through the Admin Panel. HR and Sales groups are provisioned, but distinct
department access policies require assigning employees and resource grants.
Groups alone do not imply shared access to everybody's files or conversations.
Email delivery and password reset are disabled until an email provider is set up.

After delegation, verify A records point to `188.225.73.127`; Caddy retries TLS
issuance automatically. Remove the temporary hostname after confirming the main
domain works. Do not bypass TLS warnings or change existing MX/TXT records.

## Execution host

Timeweb does not expose `/dev/kvm` on this VM. This deployment uses the official
direct NsJail backend on a separate host. It shares the execution VM's kernel;
it is not the microVM isolation provided by the upstream KVM mode. There are no
application database credentials or OpenRouter keys on this host. Do not attach
company host directories or the Docker socket to generated-code workspaces.

`prepare-code.sh` retrieves pinned source and replaces a slow git-submodule clone
with the same pinned, checksum-verified NsJail/Kafel sources. Install Buildx first.

```sh
bash prepare-code.sh
# Copy code-compose.yaml to /opt/artdent-code/compose.prod.yaml.
# Supply /opt/artdent-code/.env with unique secrets and the public JWT verifier.
cd /opt/artdent-code
docker compose -f compose.prod.yaml config --quiet
docker compose -f compose.prod.yaml build
docker compose -f compose.prod.yaml --profile setup build package-init
docker compose -f compose.prod.yaml run --rm package-init
docker compose -f compose.prod.yaml up -d
```

The upstream `scripts/setup-local-auth-env.js` creates an Ed25519 signing key for
LibreChat and the matching public verifier for Code API. Run it with explicit
`--librechat-env`, `--codeapi-env`, and `--base-url http://10.95.0.2:3112/v1` paths
in a trusted location. Only the public verifier goes to the execution host.
Set `CODE_REDIS_HOST=192.168.95.33` and `CODE_REDIS_PASSWORD` to the separate
managed execution Valkey credentials. Do not point execution services at the
application Valkey or copy application database credentials onto this VM.
Generate independent `CODE_MINIO_PASSWORD`,
`CODEAPI_INTERNAL_SERVICE_TOKEN`, `CODEAPI_EGRESS_GRANT_SECRET`, and
`CODEAPI_BRIDGE_TOKEN`. Execution manifest signing keys are also generated by the
upstream helper. Never use upstream development defaults in production.

The proxy broker and file server enforce signed execution manifests. JWT subject
and tenant identify the user. Internal ports are not published. The only published
Code API port binds to the WireGuard address. Enable `execute_code` in the LibreChat
agent capabilities only after execution, file upload/download, and authorization
checks pass. Stateful sessions and arbitrary company filesystem access are not
enabled by this deployment.

## Backup and recovery

Copy `backup.sh` and the service/timer files to the application VM, make the
script executable, and enable `artdent-backup.timer`. It runs at approximately
03:15 Moscow, briefly stops API/RAG writes, dumps MongoDB and PostgreSQL, archives
uploads and configuration, then starts the application. Local copies keep seven
days. Provider disk backups separately retain seven daily copies outside each VM.
Each managed database also retains seven daily provider backups, starting
2026-09-23. Manual post-migration backups completed successfully on 2026-09-22:
MongoDB `104601347`, PostgreSQL `104601349`, application Valkey `104601351`,
execution Valkey `104601359`. Maintenance window: 01:00–02:00 UTC.

Configuration archives contain secrets; restrict access like the env files.
Never run `docker compose down -v` on a live deployment.

For a full recovery, restore a Timeweb disk backup to a replacement VM and verify
network/DNS configuration. For selective recovery, use `mongorestore --archive
--gzip` and `pg_restore` against new databases first, then restore the corresponding
file archives and the original encryption keys. Stop application writes while
switching to the restored data. Rebuild Meilisearch indexes if recovering only
the logical database dumps; search indexes are not the source of truth.
Redis coordination/cache state is recreated during a logical recovery.
Restoring PostgreSQL into DBaaS requires `--no-owner --no-privileges` and a restore
list excluding `EXTENSION` entries; Timeweb owns the preinstalled vector extension.
Enable it before restoring. Both a pre-migration dump and a managed PostgreSQL
backup were restored successfully into a disposable database.

## Migration and rollback

The 2026-09-22 migration stopped writers, exported MongoDB/PostgreSQL, restored
managed databases, and compared every MongoDB document and index before switching.
All 51 collections and 106 documents matched. PostgreSQL retained its embedding.
Redis 7.4 DUMP payloads were incompatible with Valkey 8.1, so migration used typed
logical copies, preserving values, stream IDs, and absolute expiration times.
All 16 application keys and 28 execution keys were verified at cutover.

Original compose/env files and final source dumps are retained, root-only, in
`/opt/artdent-ai/migration/cutover` and `/opt/artdent-code/migration/cutover`.
Original database volumes remain on their respective VMs; do not delete them
until the retention decision is made. They are snapshots of the cutover, not
replicas of new writes. To roll back after production resumes, stop writers and
export current managed data back into the old databases before restoring the old
compose/env files; simply restarting the old containers would lose newer changes.
Redis/Valkey transfers must use a tested logical format when binary dump versions
differ. Existing provider backups and local archives contain secrets and user data.

## Verification performed

- Public HTTPS login, ADMIN role, and disabled public registration.
- A real model response through LibreChat → tinyproxy → OpenRouter.
- File upload, OpenRouter embeddings, and retrieval of a known code from the file.
- Python execution, artifact download, and rejection of another signed user's access.
- A real LibreChat agent created a CSV through Code API; public authenticated download
  returned the expected file. Python, Node, Bun and Bash packages are installed.
- Logical MongoDB and PostgreSQL restore into disposable databases, then cleanup.
- Private WireGuard connectivity and public port checks.
- `npm run lighthouse`: passed; median LCP 4.10 s, CLS 0.0174, TBT 72.8 ms.
- Shell syntax, Compose validation, and secret scanning before publishing.

Managed migration verification additionally covered public ADMIN login, model
response, embedded file upload/retrieval, Python execution, agent-generated CSV
download, and rejection of another user's file access. Both Valkey instances
passed Lua, Streams, Pub/Sub, AOF, and eviction-policy checks. The schedules engine
started successfully; no recurring production task was created as a test.
Lighthouse passed again after the managed configuration change (three runs).

Provider backups, monitoring, storage usage, OpenRouter balance, and application
errors should be checked during operation. Reassess CPU/RAM and worker counts
using measured concurrent demand rather than the number of registered accounts.
