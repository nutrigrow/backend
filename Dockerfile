# ─────────────────────────────────────────────────────
# TAHAP 1: BUILD
# ─────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN DIRECT_URL="postgresql://dummy:dummy@localhost:5432/dummy" \
    npx prisma generate --schema=prisma/schema.prisma

RUN npm prune --omit=dev


# ─────────────────────────────────────────────────────
# TAHAP 2: PRODUCTION
# ─────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS production

RUN apt-get update \
    && apt-get install -y --no-install-recommends dumb-init \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN groupadd --gid 1001 nodejs \
    && useradd --uid 1001 --gid nodejs --create-home nodeuser

COPY --from=builder --chown=nodeuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodeuser:nodejs /app/src ./src
COPY --from=builder --chown=nodeuser:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nodeuser:nodejs /app/package.json ./package.json

RUN mkdir -p /app/public \
    && chown nodeuser:nodejs /app/public

USER nodeuser

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD wget -qO- http://localhost:5000/ || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]