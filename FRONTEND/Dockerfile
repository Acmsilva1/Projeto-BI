# Build estático + Nginx (proxy /api → backend)
FROM node:22-alpine AS build
WORKDIR /app
COPY FRONTEND/package.json FRONTEND/package-lock.json* ./
RUN npm ci
COPY FRONTEND/ .
ARG VITE_API_BASE=/api
ENV VITE_API_BASE=$VITE_API_BASE
RUN npm run build

FROM nginx:alpine
COPY FRONTEND/docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
