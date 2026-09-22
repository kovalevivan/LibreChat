# Artdent AI — Timeweb deployment

Deploys LibreChat v0.8.8-rc3 with OpenRouter, local authentication, agents, files,
RAG, experimental schedules, and a separate Code Interpreter v1.4.1 host.
Application and database images are pinned by digest in `compose.yaml`.
Application source is unchanged. Future application changes should build a new
image from this fork and update `LIBRECHAT_IMAGE` after testing.

## Inventory

Timeweb project: `2950553`, `artdent-ai`, region `ru-1`, zone `spb-3`.

| Resource | ID/address | Configuration |
| --- | --- | --- |
| Application | server `9164141`, `188.225.73.127` | 4 × 5 GHz vCPU, 16 GiB RAM, 160 GiB NVMe |
| Execution | server `9164147`, `188.225.73.95` | 4 × 5 GHz vCPU, 8 GiB RAM, 80 GiB NVMe |
| Private execution API | `10.95.0.2:3112` | WireGuard; application peer `10.95.0.1` |
| Existing outbound proxy | `72.56.87.18:8888` | tinyproxy, application IPv4 allowlisted |
| Main URL | `https://artdent-ai.ru` | Caddy automatic TLS |
| Administration | `https://admin.artdent-ai.ru` | LibreChat Admin Panel |
| Temporary URL | `https://artdent.188-225-73-127.sslip.io` | Until new domain delegation completes |
| Temporary administration | `https://artdent-admin.188-225-73-127.sslip.io` | Same administrator account |

Compute estimate: 13,600 RUB/month at provisioning. IPv4, seven daily provider
backups per disk, and OpenRouter usage are additional. Standard CPU plans returned
`no_free_node`; these available High CPU configurations were used instead.

Capacity assumes up to 100 registered employees with modest concurrent usage.
It is not a benchmark of 100 simultaneous model generations. Models run on
OpenRouter providers. Code workers admit one Python and one other-language job
concurrently, with an overall sandbox limit of two.

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
Generate independent `CODE_REDIS_PASSWORD`, `CODE_MINIO_PASSWORD`,
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

Configuration archives contain secrets; restrict access like the env files.
Never run `docker compose down -v` on a live deployment.

For a full recovery, restore a Timeweb disk backup to a replacement VM and verify
network/DNS configuration. For selective recovery, use `mongorestore --archive
--gzip` and `pg_restore` against new databases first, then restore the corresponding
file archives and the original encryption keys. Stop application writes while
switching to the restored data. Rebuild Meilisearch indexes if recovering only
the logical database dumps; search indexes are not the source of truth.

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

Provider backups, monitoring, storage usage, OpenRouter balance, and application
errors should be checked during operation. Reassess CPU/RAM and worker counts
using measured concurrent demand rather than the number of registered accounts.
