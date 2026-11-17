FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.18.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
RUN CI=1 pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

RUN pnpm prune --prod
RUN pnpm install --prod --frozen-lockfile
RUN node -e "import('vite').then(() => console.log('vite runtime dependency ok'))"

FROM node:22-bookworm-slim
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.18.0 --activate
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/scripts ./scripts
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD  ["sh", "-c", "pnpm db:migrate && pnpm start"]
