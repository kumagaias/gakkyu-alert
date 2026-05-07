FROM node:24-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY package.json ./
RUN pnpm install --frozen-lockfile=false
COPY tsconfig.json ./
COPY src ./src
RUN pnpm run build

FROM node:24-alpine
WORKDIR /app
RUN npm install -g pnpm
COPY package.json ./
RUN pnpm install --prod --frozen-lockfile=false
COPY --from=builder /app/dist ./dist
EXPOSE 5000
CMD ["node", "dist/server.js"]
