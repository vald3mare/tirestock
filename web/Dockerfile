FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

# Кэш оптимизатора картинок (`.next/cache/images`). Образ собирается от root, а
# сервер работает от node — без этого каталога и прав на него Next не может
# сохранить пережатое фото (EACCES) и оптимизирует его заново на каждый запрос.
# Сам каталог в compose монтируется томом: кэш переживает пересборку образа и
# не раздувает слой контейнера.
RUN mkdir -p /app/.next/cache/images && chown -R node:node /app/.next/cache
USER node
EXPOSE 3000
CMD ["node", "server.js"]
