#!/bin/bash

# Setup script for Family-Friendly Facilities Map App

set -e

echo "🚀 Setting up Family-Friendly Facilities Map App..."

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "❌ Node.js version 18 or higher is required. Current version: $(node -v)"
  exit 1
fi

echo "✓ Node.js version: $(node -v)"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Setup Prisma
echo ""
echo "🗄️  Setting up Prisma..."
cd backend
if [ ! -f .env ]; then
  echo "⚠️  Backend .env file not found. Copying from .env.example..."
  cp .env.example .env
  echo "⚠️  Please update backend/.env with your DATABASE_URL"
fi

npx prisma generate
cd ..

# Setup Frontend
echo ""
echo "🎨 Setting up Frontend..."
cd frontend
if [ ! -f .env ]; then
  echo "⚠️  Frontend .env file not found. Copying from .env.example..."
  cp .env.example .env
  echo "⚠️  Please update frontend/.env with your VITE_GRAPHQL_URL and VITE_MAPBOX_TOKEN"
fi
cd ..

echo ""
echo "✅ Setup completed!"
echo ""
echo "Next steps:"
echo "1. Update backend/.env with your DATABASE_URL"
echo "2. Update frontend/.env with your VITE_GRAPHQL_URL and VITE_MAPBOX_TOKEN"
echo "3. Run database migrations: cd backend && npx prisma migrate deploy"
echo "4. Seed the database: npm run seed --workspace=backend"
echo "5. Start development: npm run dev"
