# 基底映像走 Google 的 Docker Hub 鏡像（Zeabur 建置機直拉 docker.io 會被 429 限流，見根 Dockerfile）
FROM mirror.gcr.io/library/node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY . .
EXPOSE 8787
CMD ["node", "src/index.js"]
