FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first to maximize Docker layer cache hits.
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

FROM node:20-alpine

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
