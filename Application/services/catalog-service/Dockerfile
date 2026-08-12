FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=6212 DATABASE_HOST=silicon-lanes-postgres DATABASE_PORT=5432 DATABASE_USER=postgres DATABASE_NAME=silicon_lanes_catalog
COPY --from=dependencies /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src
USER node
EXPOSE 6212
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + process.env.PORT + '/health', { headers: { 'x-silicon-lanes-probe': 'docker' } }).then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"]
CMD ["npm", "start"]
