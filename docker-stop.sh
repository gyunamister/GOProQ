#!/bin/bash

# GOProQ Docker Stop Script
# Usage: ./docker-stop.sh [production|development] [--volumes]

set -e

# Default to production if no argument provided
MODE=${1:-production}
REMOVE_VOLUMES=${2:-""}

echo "🛑 Stopping GOProQ $MODE services..."

case $MODE in
    "production")
        if [ "$REMOVE_VOLUMES" = "--volumes" ]; then
            echo "⚠️  Removing volumes (this will delete all data)..."
            docker-compose -f docker-compose.production.yml down -v
            echo "🗑️  Volumes removed"
        else
            docker-compose -f docker-compose.production.yml down
            echo "✅ Production services stopped (volumes preserved)"
        fi
        ;;
    "development")
        if [ "$REMOVE_VOLUMES" = "--volumes" ]; then
            echo "⚠️  Removing volumes (this will delete all data)..."
            docker-compose -f docker-compose.development.yml down -v
            echo "🗑️  Volumes removed"
        else
            docker-compose -f docker-compose.development.yml down
            echo "✅ Development services stopped (volumes preserved)"
        fi
        ;;
    *)
        echo "❌ Invalid mode. Use 'production' or 'development'"
        echo "Usage: ./docker-stop.sh [production|development] [--volumes]"
        exit 1
        ;;
esac

echo ""
echo "📊 To view logs: docker-compose -f docker-compose.$MODE.yml logs"
echo "🚀 To restart: ./docker-start.sh $MODE"
