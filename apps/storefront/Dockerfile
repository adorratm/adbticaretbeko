# syntax=docker/dockerfile:1
FROM node:26-alpine AS deps
WORKDIR /app
COPY package.json .yarnrc.yml yarn.lock ./
COPY .yarn ./.yarn
COPY apps/storefront/package.json ./apps/storefront/
COPY packages ./packages
RUN corepack enable && yarn install --immutable

FROM node:26-alpine AS build
WORKDIR /app
COPY --from=deps /app /app
COPY apps/storefront ./apps/storefront
WORKDIR /app/apps/storefront
RUN yarn build

FROM node:26-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache wget
COPY --from=build /app/apps/storefront/.next ./.next
COPY --from=build /app/apps/storefront/package.json ./package.json
COPY --from=build /app/apps/storefront/public ./public
COPY --from=deps /app/node_modules ./node_modules
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/ || exit 1
CMD ["npx", "next", "start", "-p", "3000"]
