FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./

FROM base AS development
ENV NODE_ENV=development
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start:dev", "--", "--path", "tsconfig.docker.json"]

FROM base AS build
ENV NODE_ENV=development
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS production
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

USER node

EXPOSE 3000
CMD ["node", "dist/main"]
