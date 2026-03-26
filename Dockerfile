# ServalSheets Production Dockerfile
# Multi-stage build for optimal image size (~50MB final)

# Stage 1: Build
# NOTE: Pin to specific tag for reproducibility. Run `docker pull node:20-alpine`
# then `docker inspect --format='{{index .RepoDigests 0}}' node:20-alpine` to get
# the current digest and append @sha256:... to the FROM line below.
FROM node:25-alpine AS builder

WORKDIR /app

# Copy package files (root + all workspace packages for npm ci)
COPY package*.json ./
COPY packages/serval-core/package*.json ./packages/serval-core/
COPY packages/mcp-client/package*.json ./packages/mcp-client/
COPY packages/mcp-http/package*.json ./packages/mcp-http/
COPY packages/mcp-runtime/package*.json ./packages/mcp-runtime/
COPY packages/mcp-stdio/package*.json ./packages/mcp-stdio/

# Install dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Prune devDependencies
RUN npm prune --production

# Stage 2: Runtime (same pin as builder — keep in sync)
FROM node:25-alpine

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy built artifacts and production dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/server.json ./

# Create non-root user
RUN addgroup -g 1001 -S servalsheets && \
    adduser -S servalsheets -u 1001

# Change ownership
RUN chown -R servalsheets:servalsheets /app

# Switch to non-root user
USER servalsheets

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health/live || exit 1

# Default to HTTP transport
ENV MCP_TRANSPORT=http
ENV NODE_ENV=production
ENV PORT=3000

# Start server
CMD ["node", "dist/http-server.js"]
