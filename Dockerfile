# Multi-stage build for ChatStash

# Stage 1: Builder
FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .

# Stage 2: Development
FROM node:18-alpine AS development
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
EXPOSE 4173
ENV NODE_ENV=development
ENV PORT=4173
CMD ["node", "server.js"]

# Stage 3: Production
FROM node:18-alpine AS production
WORKDIR /app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server.js ./
COPY --from=builder /app/db.js ./
COPY --from=builder /app/storage.js ./
COPY --from=builder /app/xendit.js ./
COPY --from=builder /app/app ./app

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 4173
ENV NODE_ENV=production
ENV PORT=4173

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:4173/health || exit 1

CMD ["node", "server.js"]
