# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/core/package.json ./packages/core/
COPY packages/agents/package.json ./packages/agents/
COPY packages/jobs/package.json ./packages/jobs/
COPY packages/pixel/package.json ./packages/pixel/
COPY packages/shopify-app/package.json ./packages/shopify-app/
RUN npm ci
COPY . .
RUN npx prisma generate --schema=packages/core/prisma/schema.prisma
ENV NEXT_TELEMETRY_DISABLED=1
ENV RECOVERFLOW_RUNTIME_MODE=DEMO
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV RECOVERFLOW_RUNTIME_MODE=DEMO
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:3000/api/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npm", "run", "start"]
