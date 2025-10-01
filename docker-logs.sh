#!/bin/bash

# GOProQ Docker Logs Script
# Usage: ./docker-logs.sh [production|development] [service]

set -e

# Default to production if no argument provided
MODE=${1:-production}
SERVICE=${2:-""}

echo "📊 Viewing GOProQ $MODE logs..."

case $MODE in
    "production")
        if [ -n "$SERVICE" ]; then
            echo "📋 Logs for $SERVICE service:"
            docker-compose -f docker-compose.production.yml logs -f "$SERVICE"
        else
            echo "📋 Logs for all services:"
            docker-compose -f docker-compose.production.yml logs -f
        fi
        ;;
    "development")
        if [ -n "$SERVICE" ]; then
            echo "📋 Logs for $SERVICE service:"
            docker-compose -f docker-compose.development.yml logs -f "$SERVICE"
        else
            echo "📋 Logs for all services:"
            docker-compose -f docker-compose.development.yml logs -f
        fi
        ;;
    *)
        echo "❌ Invalid mode. Use 'production' or 'development'"
        echo "Usage: ./docker-logs.sh [production|development] [service]"
        echo "Available services: backend, frontend"
        exit 1
        ;;
esac
