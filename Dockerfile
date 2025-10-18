# Stage 1 — builder
FROM node:22-slim AS builder

WORKDIR /home/node/app

ENV NODE_ENV=development

# Copiar package + lock e instalar dependências (inclui dev deps para build)
COPY package.json package-lock.json ./
RUN npm ci

# Copiar prisma e código
COPY prisma ./prisma
COPY . .

# Gerar Prisma Client (usa o client gerado no node_modules)
RUN npx prisma generate --schema=prisma/schema.prisma

# Build do Next (precisa das devDependencies)
RUN npm run build

# Stage 2 — runtime
FROM node:22-slim AS runner

WORKDIR /home/node/app
ENV NODE_ENV=production
ENV PORT=3015

# Copiar node_modules e build do builder (inclui @prisma/client gerado)
COPY --from=builder /home/node/app/node_modules ./node_modules
COPY --from=builder /home/node/app/.next ./.next
COPY --from=builder /home/node/app/public ./public
COPY --from=builder /home/node/app/package.json ./package.json
COPY --from=builder /home/node/app/prisma ./prisma

# Ajustar dono e usar user não-root
RUN chown -R node:node /home/node/app
USER node

EXPOSE 3015

CMD ["node", "node_modules/.bin/next", "start", "-p", "3015", "-H", "0.0.0.0"]