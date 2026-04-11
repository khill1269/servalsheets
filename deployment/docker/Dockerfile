FROM node:20-alpine@sha256:f598378b5240225e6beab68fa9f356db1fb8efe55173e6d4d8153113bb8f333c AS builder

WORKDIR /app

# Install native build dependencies for canvas, sharp, bcrypt, etc.
RUN apk add --no-cache python3 make g++ pkgconfig \
    cairo-dev pango-dev jpeg-dev giflib-dev librsvg-dev pixman-dev \
    linux-headers

# Copy package files first to maximize Docker layer cache hits.
COPY package*.json ./
COPY tsconfig*.json ./
COPY packages/serval-core/package*.json ./packages/serval-core/
COPY packages/mcp-client/package*.json ./packages/mcp-client/
COPY packages/mcp-http/package*.json ./packages/mcp-http/
COPY packages/mcp-runtime/package*.json ./packages/mcp-runtime/
COPY packages/mcp-stdio/package*.json ./packages/mcp-stdio/

RUN npm install --legacy-peer-deps

COPY . .

# Build workspace packages first (order matters for cross-references)
RUN npx tsc -p packages/serval-core/tsconfig.build.json --skipLibCheck && \
    npx tsc -p packages/mcp-client/tsconfig.build.json --skipLibCheck && \
    npx tsc -p packages/mcp-http/tsconfig.build.json --skipLibCheck && \
    npx tsc -p packages/mcp-runtime/tsconfig.build.json --skipLibCheck && \
    npx tsc -p packages/mcp-stdio/tsconfig.build.json --skipLibCheck

# Build main project (|| true for non-critical type errors in Docker's dep resolution)
RUN npx tsc -p tsconfig.docker.json || true
RUN test -f dist/server.js && test -f dist/http-server.js || \
    (echo "FATAL: dist/server.js or dist/http-server.js missing after tsc" && exit 1)

# NOTE: Intentionally skip npm prune --production. Many production
# imports rely on transitive deps (e.g. @node-saml/node-saml,
# google-auth-library, express-rate-limit, @modelcontextprotocol/sdk)
# that prune removes. Larger image but reliable at runtime.

# ── Runtime stage ──────────────────────────────────────────────
FROM node:20-alpine@sha256:f598378b5240225e6beab68fa9f356db1fb8efe55173e6d4d8153113bb8f333c

WORKDIR /app

RUN apk add --no-cache curl cairo pango jpeg giflib librsvg pixman

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/server.json ./

# Copy workspace packages (dist + package.json for Node.js resolution).
# Docker COPY preserves symlinks as-is, so node_modules/@serval/* will
# be broken symlinks pointing to ../../packages/*. We copy the real
# package content here and re-create the symlinks below.
COPY --from=builder /app/packages/serval-core/dist ./packages/serval-core/dist
COPY --from=builder /app/packages/serval-core/package.json ./packages/serval-core/package.json
COPY --from=builder /app/packages/mcp-client/dist ./packages/mcp-client/dist
COPY --from=builder /app/packages/mcp-client/package.json ./packages/mcp-client/package.json
COPY --from=builder /app/packages/mcp-http/dist ./packages/mcp-http/dist
COPY --from=builder /app/packages/mcp-http/package.json ./packages/mcp-http/package.json
COPY --from=builder /app/packages/mcp-runtime/dist ./packages/mcp-runtime/dist
COPY --from=builder /app/packages/mcp-runtime/package.json ./packages/mcp-runtime/package.json
COPY --from=builder /app/packages/mcp-stdio/dist ./packages/mcp-stdio/dist
COPY --from=builder /app/packages/mcp-stdio/package.json ./packages/mcp-stdio/package.json

# Fix workspace symlinks — Docker COPY copies symlinks as-is, leaving
# broken node_modules/@serval/* -> ../../packages/* links. Replace with
# valid absolute symlinks to the copied workspace package directories.
RUN rm -rf node_modules/@serval && \
    mkdir -p node_modules/@serval && \
    ln -sf /app/packages/serval-core node_modules/@serval/core && \
    ln -sf /app/packages/mcp-client node_modules/@serval/mcp-client && \
    ln -sf /app/packages/mcp-http node_modules/@serval/mcp-http && \
    ln -sf /app/packages/mcp-runtime node_modules/@serval/mcp-runtime && \
    ln -sf /app/packages/mcp-stdio node_modules/@serval/mcp-stdio

RUN addgroup -g 1001 -S servalsheets && \
    adduser -S servalsheets -u 1001
RUN chown -R servalsheets:servalsheets /app

USER servalsheets

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health/live || exit 1

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "dist/http-server.js"]
