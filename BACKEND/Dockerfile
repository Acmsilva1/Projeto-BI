# Build + runtime API Hospital BI
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine
RUN apk add --no-cache curl
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 3020
HEALTHCHECK --interval=30s --timeout=8s --start-period=15s --retries=3 \
  CMD curl -sf "http://127.0.0.1:${HOSPITAL_BI_API_PORT:-3020}/health" || exit 1
CMD ["node", "dist/server.js"]
