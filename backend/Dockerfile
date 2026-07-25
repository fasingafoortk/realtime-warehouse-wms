FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY dist-frontend ./dist-frontend

RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-frontend ./dist-frontend

EXPOSE 3000
ENV NODE_ENV=production

CMD ["node", "dist/server.js"]
