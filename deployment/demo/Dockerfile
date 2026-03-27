# ServalSheets Demo - Cloud Run Deployment
# Read-only demo instance with rate limiting

FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace package manifests first so npm can resolve local packages.
COPY package*.json ./
COPY packages/serval-core/package*.json ./packages/serval-core/
COPY packages/mcp-client/package*.json ./packages/mcp-client/
COPY packages/mcp-http/package*.json ./packages/mcp-http/
COPY packages/mcp-runtime/package*.json ./packages/mcp-runtime/
COPY packages/mcp-stdio/package*.json ./packages/mcp-stdio/

RUN npm ci

COPY . .

RUN npm run build
RUN npm prune --production

FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache curl

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/server.json ./
COPY --from=builder /app/packages/serval-core/dist ./packages/serval-core/dist
COPY --from=builder /app/packages/mcp-client/dist ./packages/mcp-client/dist
COPY --from=builder /app/packages/mcp-http/dist ./packages/mcp-http/dist
COPY --from=builder /app/packages/mcp-runtime/dist ./packages/mcp-runtime/dist
COPY --from=builder /app/packages/mcp-stdio/dist ./packages/mcp-stdio/dist
COPY deployment/demo/index.html ./public/index.html

RUN addgroup -g 1001 -S servalsheets && \
    adduser -S servalsheets -u 1001
RUN chown -R servalsheets:servalsheets /app

USER servalsheets

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8080/health/ready || exit 1

ENV MCP_TRANSPORT=http
ENV NODE_ENV=production
ENV PORT=8080
ENV HTTP_PORT=8080
ENV DEMO_MODE=true
ENV READ_ONLY=true
ENV LOG_LEVEL=info
ENV LOG_FORMAT=json
ENV RATE_LIMIT_MAX_REQUESTS=30
ENV RATE_LIMIT_WINDOW_MS=60000

CMD ["node", "dist/http-server.js"]
