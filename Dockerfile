# Build stage: compile TypeScript -> dist/
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Runtime stage: prod deps + compiled server + web client
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production \
    PLOTO_DATA_DIR=/app/data
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY web ./web
# The SQLite file (postgres.db) lives here; mount a volume on it to keep data.
RUN mkdir -p /app/data && chown node:node /app/data
VOLUME /app/data
USER node
EXPOSE 8080
CMD ["node", "--disable-warning=ExperimentalWarning", "dist/index.js"]
