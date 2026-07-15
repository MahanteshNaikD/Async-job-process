# Multi-stage API image
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build:api

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY libs/database/src/migrate.js ./libs/database/src/migrate.js
COPY libs/database/migrations ./libs/database/migrations
COPY web ./web
COPY docker/api-entrypoint.sh ./docker/api-entrypoint.sh
RUN chmod +x ./docker/api-entrypoint.sh
EXPOSE 3000
CMD ["./docker/api-entrypoint.sh"]
