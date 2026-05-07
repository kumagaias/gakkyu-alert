FROM node:24-alpine
WORKDIR /app
RUN npm install -g pnpm tsx
COPY package.json ./
RUN pnpm install --frozen-lockfile=false
COPY tsconfig.json ./
COPY src ./src
ARG ENTRY=src/orchestrator/server.ts
ENV ENTRY=${ENTRY}
EXPOSE 5001 5002 5003
CMD ["sh", "-c", "tsx ${ENTRY}"]
