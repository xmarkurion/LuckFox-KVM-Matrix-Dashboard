# syntax=docker/dockerfile:1

# Build the Vue production bundle and compile the TypeScript Node proxy.
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run type-check && npm run build

# Runtime image: Node serves the API proxy and the built Vue app from /app/dist.
FROM node:22-alpine AS production
WORKDIR /app

ENV NODE_ENV=production \
    PORT=8787 \
    KVM_CONFIG=/app/kvm.config.json

COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY kvm.config.json ./kvm.config.json
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/api/health >/dev/null || exit 1

CMD ["node", "dist-server/index.js"]
