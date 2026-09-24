FROM node:24-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY web/package.json web/package.json
RUN npm ci

COPY server server
COPY web web
RUN npm run build

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/package.json ./server/package.json
COPY --from=builder /app/web/dist ./web/dist

# Pre-create /data, world-writable. docker-compose.yml mounts the disposable
# SQLite index volume here and runs the container as a configurable ${PUID}:
# ${PGID} — a *named* volume copies its mount point's permissions from the
# image on first creation, so without this the volume would start out
# root-owned and the app couldn't write its index under a non-root PUID. Since
# PUID/PGID are chosen at `docker compose up` time, not build time, a fixed
# chown can't track them; a world-writable directory works for any uid without
# needing a rebuild whenever the user's uid changes. It's a self-contained,
# disposable cache directory, not shared with anything else, so the loosened
# permission has no real blast radius.
RUN mkdir -p /data && chmod 1777 /data

EXPOSE 3000
CMD ["node", "server/dist/index.js"]
