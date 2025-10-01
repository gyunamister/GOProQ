#!/bin/bash

# GOProQ Docker Start Script
# Usage: ./docker-start.sh [production|development]

set -e

# Default to production if no argument provided
MODE=${1:-production}

echo "🚀 Starting GOProQ in $MODE mode..."

case $MODE in
    "production")
        echo "📦 Building and starting production containers..."
        docker-compose -f docker-compose.production.yml up --build -d
        echo "✅ Production services started!"
        echo "🌐 Frontend: http://localhost"
        echo "🔧 Backend API: http://localhost:8080"
        echo "📚 API Docs: http://localhost:8080/docs"
        ;;
    "development")
        echo "🔧 Building and starting development containers..."
        docker-compose -f docker-compose.development.yml up --build -d
        echo "✅ Development services started!"
        echo "🌐 Frontend: http://localhost:3000 (with hot reload)"
        echo "🔧 Backend API: http://localhost:8080 (with auto-reload)"
        echo "📚 API Docs: http://localhost:8080/docs"
        ;;
    *)
        echo "❌ Invalid mode. Use 'production' or 'development'"
        echo "Usage: ./docker-start.sh [production|development]"
        exit 1
        ;;
esac

echo ""
echo "📊 To view logs: docker-compose -f docker-compose.$MODE.yml logs -f"
echo "🛑 To stop: docker-compose -f docker-compose.$MODE.yml down"
echo "🔍 To check status: docker-compose -f docker-compose.$MODE.yml ps"
