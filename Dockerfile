# Stage 1: Build Frontend Assets
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Production Python Backend with FFmpeg
FROM python:3.12-slim
WORKDIR /app

# Install system dependencies (FFmpeg is mandatory for 16 kHz WAV standardization)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend source code and session content
COPY session_content.json ./
COPY backend/ ./backend/

# Copy built frontend assets to be served directly by FastAPI
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Create storage directories
RUN mkdir -p backend/dataset/audio backend/dataset/originals backend/dataset/metadata backend/data backend/temp

ENV PYTHONUNBUFFERED=1
ENV PORT=8000

EXPOSE 8000

# Run unified FastAPI application
CMD ["sh", "-c", "uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port ${PORT}"]
