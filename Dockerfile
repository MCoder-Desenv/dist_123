# Stage 1 — builder
FROM node:22.11-alpine AS builder

WORKDIR /home/node/app

# Instalar dependências (inclui devDependencies para permitir prisma generate e build)
COPY package*.json ./
# se tiver package-lock.json, também copie para garantir versões fixas
COPY package-lock.json* ./
RUN npm ci

# Copiar arquivos necessários para gerar client e build
COPY prisma ./prisma
COPY . .

# Gerar Prisma Client e build do Next
RUN npx prisma generate
RUN npm run build

# Stage 2 — runtime (menor)
FROM node:22.11-alpine AS runner

WORKDIR /home/node/app
ENV NODE_ENV=production
ENV PORT=3015

# Copiar node_modules e artefatos de build do stage builder
COPY --from=builder /home/node/app/node_modules ./node_modules
COPY --from=builder /home/node/app/.next ./.next
COPY --from=builder /home/node/app/public ./public
COPY --from=builder /home/node/app/package*.json ./
COPY --from=builder /home/node/app/prisma ./prisma
# Se tiver outros assets (ex.: static), copie também

# Permissões e usuário não-root
RUN chown -R node:node /home/node/app
USER node

EXPOSE 3015

# Iniciar Next em produção, ligando em 0.0.0.0 na porta definida por PORT
CMD ["sh", "-c", "node_modules/.bin/next start -p ${PORT} -H 0.0.0.0"]