#!/bin/bash
# Build script for Render deployment
# Installs dependencies and builds both frontend + backend

set -e

echo "▸ Installing frontend dependencies..."
cd frontend
npm ci || npm install
echo "▸ Building frontend (Vite + TypeScript)..."
npm run build
cd ..

echo "▸ Installing server dependencies..."
cd server
npm ci || npm install
cd ..

echo "✓ Build complete — frontend/dist ready, server ready"
