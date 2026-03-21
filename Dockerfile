FROM node:20-slim

# Instala Chromium e dependências para whatsapp-web.js
RUN apt-get update && apt-get install -y \
  chromium \
  fonts-noto-color-emoji \
  ca-certificates \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

# Diz ao puppeteer para usar o Chromium do sistema (não baixar outro)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app
COPY package*.json ./
RUN npm install --only=production
COPY . .

CMD ["node", "server.js"]
