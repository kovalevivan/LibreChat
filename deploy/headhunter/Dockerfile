ARG ADMIN_BASE=registry.librechat.ai/clickhouse/librechat-admin-panel@sha256:a395465d1daa3c11495810a8c224df86675985d50de42e98e36eeedbd8aecb94
FROM ${ADMIN_BASE} AS existing
FROM ${ADMIN_BASE} AS build
USER root
WORKDIR /app
ADD https://codeload.github.com/ClickHouse/librechat-admin-panel/tar.gz/fce9596f823e78f991c7ef60bb97d0ce15d72934 /tmp/admin-source.tar.gz
RUN echo '88a58326cefe2a3875298fbfa0859d628de238d0f13cb5473bd6bf5beed4b59a  /tmp/admin-source.tar.gz' | sha256sum -c - \
    && tar -xzf /tmp/admin-source.tar.gz --strip-components=1 -C /app \
    && bun install --frozen-lockfile
COPY deploy/headhunter /tmp/headhunter
COPY --from=existing /app/dist/client/favicon.ico /app/public/favicon.ico
RUN bun /tmp/headhunter/prepare.cjs /tmp/headhunter \
    && NODE_OPTIONS=--max-old-space-size=4096 bun run build \
    && bun x tsc --noEmit
FROM ${ADMIN_BASE}
COPY --from=build --chown=bun:bun /app/dist /app/dist
ARG REVISION
LABEL ai.artdent.headhunter.revision=${REVISION}
