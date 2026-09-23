#!/usr/bin/env bash
set -euo pipefail
umask 077
cd /opt/artdent-ai
exec 9>/run/lock/artdent-backup.lock
flock -n 9 || exit 0
stamp=$(date -u +%Y%m%dT%H%M%SZ)
destination="/var/backups/artdent-ai/$stamp"
mkdir -p "$destination"
restore_services() { docker compose start rag_api api >/dev/null; }
trap restore_services EXIT
# Stop application writes so database dumps and file copies describe one state.
docker compose stop -t 90 api rag_api >/dev/null
docker compose run --rm -T --no-deps mongo-tools sh -c \
  'exec mongodump --quiet --uri "$MONGO_URI" --db LibreChat --archive --gzip' \
  > "$destination/mongodb.archive.gz"
docker compose run --rm -T --no-deps postgres-tools pg_dump -Fc \
  > "$destination/postgres.dump"
# Redis is transient coordination/cache state; don't copy a live AOF during rewrite.
for volume in uploads images skills app_data; do
  source_path=$(docker volume inspect "artdent-ai_$volume" --format '{{.Mountpoint}}')
  tar -C "$source_path" -czf "$destination/$volume.tar.gz" .
done
tar -czf "$destination/config.tar.gz" .env app.env rag.env compose.yaml librechat.yaml Caddyfile
(
  cd "$destination"
  sha256sum ./* > SHA256SUMS
)
restore_services
trap - EXIT
touch "$destination/COMPLETE"
# Provider disk backups retain copies outside this VM; local dumps aid selective restore.
find /var/backups/artdent-ai -mindepth 1 -maxdepth 1 -type d -mtime +7 -exec rm -rf -- {} +
printf 'Backup complete: %s\n' "$destination"
