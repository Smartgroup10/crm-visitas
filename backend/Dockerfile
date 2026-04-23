FROM node:22-alpine

WORKDIR /app

# Instalar dependencias (producción)
COPY package*.json ./
RUN npm ci --omit=dev

# Copiar código fuente + schema.sql (el backend lo aplica al arrancar)
COPY src ./src
COPY schema.sql ./schema.sql

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "src/index.js"]
