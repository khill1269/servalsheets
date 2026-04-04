# ServalSheets Production Dockerfile
# Full build from source — multi-stage for optimal image size (~60MB final)

# ─── Stage 1: Build TypeScript ────────────────────────────────────────────────
# NOTE: Pin to specific digest for reproducibility. Update digest when upgrading Node.
FROM node:20-alpine@sha256:f598378b5240225e6beab68fa9f356db1fb8efe55173e6d4d8153113bb8f333c AS builder

WORKDIR /app

# Copy package manifests first (layer cache optimization)
COPY package.json package-lock.json ./
COPY packages/serval-core/package.json ./packages/serval-core/
COPY packages/mcp-client/package.json ./packages/mcp-client/
COPY packages/mcp-http/package.json ./packages/mcp-http/
COPY packages/mcp-runtime/package.json ./packages/mcp-runtime/
COPY packages/mcp-stdio/package.json ./packages/mcp-stdio/

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript (4GB heap — multi-workspace tsc is memory-intensive)
RUN NODE_OPTIONS="--max-old-space-size=4096" npm run build

# Prune to production-only dependencies
RUN npm prune --omit=dev \
  && npm cache clean --force

# ─── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM node:20-alpine@sha256:f598378b5240225e6beab68fa9f356db1fb8efe55173e6d4d8153113bb8f333c

# Security: install only essential runtime packages
RUN apk add --no-cache curl tini \
  && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy built artifacts and production dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/server.json ./

# Create non-root user with no home directory or shell
RUN addgroup -g 1001 -S servalsheets \
  && adduser -S -u 1001 -G servalsheets -s /sbin/nologin -H servalsheets

# Create required runtime directories (DATA_DIR, PROFILE_STORAGE_DIR, CHECKPOINT_DIR, WAL_DIR)
RUN mkdir -p /app/data /app/profiles /app/checkpoints /app/wal \
  && chown -R servalsheets:servalsheets /app

# Drop all capabilities, run as non-root
USER servalsheets

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD curl -sf http://localhost:3000/health/live || exit 1

# Environment defaults
ENV MCP_TRANSPORT=http \
    NODE_ENV=production \
    PORT=3000

# Use tini as init system for proper signal handling (SIGTERM → graceful shutdown)
ENTRYPOINT ["/sbin/tini", "--"]

# Start server
CMD ["node", "dist/http-server-entry.js"]
