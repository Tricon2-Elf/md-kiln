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

RUN npm run compile && npm prune --production

EXPOSE 3000

CMD ["node", "build/server.js"]
