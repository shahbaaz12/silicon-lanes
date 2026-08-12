FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=6612 DATABASE_DIR=/data
COPY --from=dependencies /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 6612
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + process.env.PORT + '/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"]
CMD ["npm", "start"]

