FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server.js config.json ./
COPY lib ./lib
COPY plugins ./plugins
COPY views ./views
COPY public ./public
COPY content ./content

EXPOSE 3000

CMD ["node", "server.js"]
