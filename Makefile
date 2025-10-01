# GOProQ Docker Management Makefile

.PHONY: help build start stop logs clean restart status

# Default target
help:
	@echo "GOProQ Docker Management"
	@echo "======================="
	@echo ""
	@echo "Available commands:"
	@echo "  make build-prod     - Build production images"
	@echo "  make build-dev      - Build development images"
	@echo "  make start-prod     - Start production services"
	@echo "  make start-dev      - Start development services"
	@echo "  make stop-prod      - Stop production services"
	@echo "  make stop-dev       - Stop development services"
	@echo "  make logs-prod      - View production logs"
	@echo "  make logs-dev       - View development logs"
	@echo "  make restart-prod   - Restart production services"
	@echo "  make restart-dev    - Restart development services"
	@echo "  make status-prod    - Check production service status"
	@echo "  make status-dev     - Check development service status"
	@echo "  make clean          - Clean up containers and images"
	@echo "  make clean-all      - Clean up everything including volumes"

# Build commands
build-prod:
	@echo "🔨 Building production images..."
	docker-compose -f docker-compose.production.yml build

build-dev:
	@echo "🔨 Building development images..."
	docker-compose -f docker-compose.development.yml build

# Start commands
start-prod:
	@echo "🚀 Starting production services..."
	docker-compose -f docker-compose.production.yml up -d

start-dev:
	@echo "🚀 Starting development services..."
	docker-compose -f docker-compose.development.yml up -d

# Stop commands
stop-prod:
	@echo "🛑 Stopping production services..."
	docker-compose -f docker-compose.production.yml down

stop-dev:
	@echo "🛑 Stopping development services..."
	docker-compose -f docker-compose.development.yml down

# Logs commands
logs-prod:
	@echo "📊 Viewing production logs..."
	docker-compose -f docker-compose.production.yml logs -f

logs-dev:
	@echo "📊 Viewing development logs..."
	docker-compose -f docker-compose.development.yml logs -f

# Restart commands
restart-prod: stop-prod start-prod
	@echo "🔄 Production services restarted"

restart-dev: stop-dev start-dev
	@echo "🔄 Development services restarted"

# Status commands
status-prod:
	@echo "📊 Production service status:"
	docker-compose -f docker-compose.production.yml ps

status-dev:
	@echo "📊 Development service status:"
	docker-compose -f docker-compose.development.yml ps

# Clean commands
clean:
	@echo "🧹 Cleaning up containers and images..."
	docker-compose -f docker-compose.production.yml down --rmi all
	docker-compose -f docker-compose.development.yml down --rmi all
	docker system prune -f

clean-all:
	@echo "🧹 Cleaning up everything including volumes..."
	docker-compose -f docker-compose.production.yml down -v --rmi all
	docker-compose -f docker-compose.development.yml down -v --rmi all
	docker system prune -af
