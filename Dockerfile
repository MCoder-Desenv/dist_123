# Stage 1 — builder
FROM node:22-slim AS builder

WORKDIR /home/node/app
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

# Instalar dependências do SO necessárias para o Prisma (OpenSSL)
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Copiar package + lock
COPY package.json package-lock.json ./

# Copiar o schema do Prisma ANTES de rodar npm ci (postinstall pode executar prisma generate)
COPY prisma ./prisma

# Instalar dependências (inclui dev deps para build e executa postinstall -> prisma generate)
RUN npm ci --include=dev

# Copiar resto do código
COPY . .

# Se quiser garantir geração explícita (opcional, pois postinstall já roda)
RUN npx prisma generate --schema=prisma/schema.prisma || true

# Build do Next
RUN npm run build

# Stage 2 — runtime
FROM node:22-slim AS runner

WORKDIR /home/node/app
ENV NODE_ENV=production
ENV PORT=3015
ENV HOST=0.0.0.0

# Instalar OpenSSL no stage final também (para evitar warnings do Prisma)
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Copiar node_modules e build do builder
COPY --from=builder /home/node/app/node_modules ./node_modules
COPY --from=builder /home/node/app/.next ./.next
COPY --from=builder /home/node/app/public ./public
COPY --from=builder /home/node/app/package.json ./package.json
COPY --from=builder /home/node/app/prisma ./prisma

# Ajustar dono e usar user não-root
RUN chown -R node:node /home/node/app
USER node

EXPOSE 3015

# CMD usando caminho absoluto para o binário do Next.js
CMD ["sh", "-c", "npx prisma migrate deploy --schema=prisma/schema.prisma && node node_modules/.bin/next start"]