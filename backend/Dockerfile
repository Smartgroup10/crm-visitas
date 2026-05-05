FROM node:22-alpine

WORKDIR /app

# Instalar dependencias (producción)
COPY package*.json ./
RUN npm ci --omit=dev

# Copiar código fuente + schema.sql (el backend lo aplica al arrancar)
# + seed_clients.sql opcional (listado inicial masivo de clientes con
# CIF y domicilio fiscal — ver src/seed.js applyClientsSeed).
COPY src ./src
COPY schema.sql ./schema.sql
COPY seed_clients.sql ./seed_clients.sql

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "src/index.js"]
