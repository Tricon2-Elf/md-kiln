FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY views ./views
COPY assets ./assets
COPY content ./content
COPY config.json ./

RUN mkdir -p /app/dist \
  && npm run compile \
  && npm prune --production \
  && chown -R node:node /app

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD test -f /app/dist/index.html || exit 1

CMD ["node", "build/server.js"]
