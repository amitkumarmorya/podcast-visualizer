# --- Stage 1: Build Frontend ---
FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

# Copy frontend source and build static export
COPY . .
RUN npm run build


# --- Stage 2: Build Backend & Serve ---
FROM python:3.9-slim

WORKDIR /app

# Install backend dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Python backend code
COPY execution /app/execution
COPY directives /app/directives
COPY credentials.json* /app/
COPY token.json* /app/

# Copy Next.js static build into /out for FastAPI to serve
COPY --from=builder /app/out /app/out

# Railway provisions the PORT environment variable dynamically
ENV PORT=8000

# Start Uvicorn pointing at execution.main:app
CMD uvicorn execution.main:app --host 0.0.0.0 --port $PORT
