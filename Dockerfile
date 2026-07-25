# Stage 1: Build Angular Frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Build Express Backend
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
# Run tsc directly instead of the full unified npm run build (which tries to cd to frontend)
RUN npx tsc

# Stage 3: Production Runner
FROM node:20-alpine AS runner
WORKDIR /app

# Install production dependencies for backend
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --only=production

# Copy built backend and frontend assets
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

EXPOSE 3000
ENV NODE_ENV=production

WORKDIR /app/backend
CMD ["node", "dist/server.js"]
