# Stage 1: Build
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Serve
FROM node:22-alpine
RUN npm install -g serve
COPY --from=build /app/dist /app
EXPOSE 80
CMD ["serve", "-s", "/app", "-l", "80"]
