# ─────────────────────────────────────────────────────
# TAHAP 1: BUILD
# Install semua deps (termasuk devDeps untuk prisma generate),
# generate Prisma client, lalu prune devDeps.
# ─────────────────────────────────────────────────────
FROM node:26-alpine AS builder

WORKDIR /app

# Install SEMUA dependencies dulu — prisma (devDep) dibutuhkan saat generate
COPY package*.json ./
RUN npm ci

# Copy seluruh source
COPY . .

# Generate Prisma client
# Prisma 7 baca config dari prisma.config.ts → butuh DIRECT_URL
# Dummy URL aman untuk generate (hanya menghasilkan kode, tidak konek DB)
RUN DIRECT_URL="postgresql://dummy:dummy@localhost:5432/dummy" \
    npx prisma generate --schema=prisma/schema.prisma

# Hapus devDependencies setelah generate selesai
RUN npm prune --omit=dev

# ─────────────────────────────────────────────────────
# TAHAP 2: PRODUCTION
# Image minimal dengan non-root user dan dumb-init.
# ─────────────────────────────────────────────────────
FROM node:26-alpine AS production

# dumb-init: meneruskan sinyal (SIGTERM dll.) ke proses Node dengan benar
RUN apk add --no-cache dumb-init

WORKDIR /app

# Buat non-root user untuk keamanan
RUN addgroup -g 1001 -S nodejs && adduser -S nodeuser -u 1001

# Salin artefak dari builder stage
# src/ sudah include src/generated/prisma hasil generate
COPY --from=builder --chown=nodeuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodeuser:nodejs /app/src ./src
COPY --from=builder --chown=nodeuser:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nodeuser:nodejs /app/package.json ./package.json

# Folder public untuk file upload
RUN mkdir -p /app/public && chown nodeuser:nodejs /app/public

USER nodeuser

EXPOSE 5000

# Health check internal Docker
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD wget -qO- http://localhost:5000/ || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]
