# Stage 1: build the React frontend
FROM node:20-alpine AS web
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src
RUN npm run build

# Stage 2: Python API + Tesseract (Ledger Rescue OCR) + PostgreSQL driver
FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends tesseract-ocr && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY server ./server
COPY --from=web /app/dist ./dist
ENV PYTHONUNBUFFERED=1
EXPOSE 10000
CMD ["python", "server/server.py"]
