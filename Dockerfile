# syntax=docker/dockerfile:1
#
# Single-image build for Banker. Three stages, one tiny runtime image:
#   1. build the React SPA
#   2. build the Go server — a static binary that IS PocketBase (data, REST
#      API, schema migrations) plus an in-process WebSocket realtime bridge
#      on /ws and static hosting of the SPA. No Node sidecar, no separate
#      PocketBase download.
#   3. copy both into a minimal Alpine runtime.

# Stage 1: build the SPA
FROM node:20-alpine AS web
WORKDIR /app
# Empty VITE_PB_URL → the SDK builds relative URLs the browser resolves
# against the current origin. The server hosts the SPA, so it's same-origin.
ARG VITE_PB_URL=""
ENV VITE_PB_URL=$VITE_PB_URL
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: build the single Go server binary
FROM golang:1.25-alpine AS server
WORKDIR /src
COPY server/go.mod server/go.sum ./
RUN go mod download
COPY server/ ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /banker .

# Stage 3: minimal runtime
FROM alpine:3.20
RUN apk add --no-cache ca-certificates wget
WORKDIR /pb
COPY --from=server /banker /pb/banker
COPY --from=web /app/dist /pb/pb_public
COPY pb/pb_migrations /pb/pb_migrations

EXPOSE 8080

# The binary auto-runs `serve --http=0.0.0.0:$PORT` (PORT defaults to 8080),
# applies the pb_migrations on first boot, and — if PB_ADMIN_EMAIL /
# PB_ADMIN_PASSWORD are set — creates the admin superuser once.
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q -O - "http://127.0.0.1:${PORT:-8080}/api/health" || exit 1

ENTRYPOINT ["/pb/banker"]
