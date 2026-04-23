FROM node:22-alpine

WORKDIR /app

# Instalar dependencias (producción)
COPY package*.json ./
RUN npm ci --omit=dev

# Copiar código fuente
COPY src ./src

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "src/index.js"]
