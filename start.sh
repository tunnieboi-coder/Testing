#!/usr/bin/env bash
set -e

echo "🚀 Starting TrustOps GRC Platform..."

# Install dependencies
echo "📦 Installing dependencies..."
cd /home/user/Testing/backend && npm install --silent
cd /home/user/Testing/frontend && npm install --silent

# Seed database if needed
DB_PATH="/home/user/Testing/backend/data/grc.db"
if [ ! -f "$DB_PATH" ]; then
  echo "🌱 Seeding database..."
  cd /home/user/Testing/backend && npx tsx src/seed.ts
fi

echo ""
echo "✅ TrustOps GRC Platform"
echo "   Backend:  http://localhost:3001"
echo "   Frontend: http://localhost:5173"
echo ""
echo "Starting services..."

# Start backend
cd /home/user/Testing/backend && npx tsx src/index.ts &
BACKEND_PID=$!

# Start frontend
cd /home/user/Testing/frontend && npx vite &
FRONTEND_PID=$!

# Wait for both
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" SIGINT SIGTERM
wait
