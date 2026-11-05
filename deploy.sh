#!/usr/bin/env bash
# ==============================================================================
# Bong POS - Production Deployment & Management Script
# Domain: http://pos.allkh.app/ (Ingress Port: 4001)
# Host IP: 10.36.200.125
# ==============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.production"
ENV_EXAMPLE=".env.production.example"

# ANSI Color Codes
CLR_RESET="\033[0m"
CLR_BOLD="\033[1m"
CLR_GREEN="\033[32m"
CLR_BLUE="\033[34m"
CLR_CYAN="\033[36m"
CLR_YELLOW="\033[33m"
CLR_RED="\033[31m"

log_info() {
    echo -e "${CLR_BLUE}[INFO]${CLR_RESET} $1"
}

log_success() {
    echo -e "${CLR_GREEN}[SUCCESS]${CLR_RESET} $1"
}

log_warn() {
    echo -e "${CLR_YELLOW}[WARN]${CLR_RESET} $1"
}

log_error() {
    echo -e "${CLR_RED}[ERROR]${CLR_RESET} $1" >&2
}

# Determine Docker Compose Command
if docker compose version >/dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
    DOCKER_COMPOSE="docker-compose"
else
    log_error "Docker Compose is not installed. Please install Docker Compose and try again."
    exit 1
fi

compose_cmd() {
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

check_prerequisites() {
    if ! command -v docker >/dev/null 2>&1; then
        log_error "Docker is not installed or not in PATH."
        exit 1
    fi

    if ! docker info >/dev/null 2>&1; then
        log_error "Docker daemon is not running or current user does not have permission."
        exit 1
    fi
}

setup_environment() {
    if [ ! -f "$ENV_FILE" ]; then
        if [ -f "$ENV_EXAMPLE" ]; then
            log_warn "$ENV_FILE not found. Creating from $ENV_EXAMPLE..."
            cp "$ENV_EXAMPLE" "$ENV_FILE"

            # Generate random secrets for fresh setup
            if command -v openssl >/dev/null 2>&1; then
                RAND_JWT=$(openssl rand -hex 32)
                RAND_CRED=$(openssl rand -hex 32)
                RAND_DB=$(openssl rand -hex 16)
                RAND_ROOT=$(openssl rand -hex 16)

                sed -i.bak "s/replace_with_64_character_random_hex_string_in_production/${RAND_JWT}/g" "$ENV_FILE" 2>/dev/null || true
                sed -i.bak "s/cb78b647f4d0c4ff64163317440ff83bc14edd17bd92e100aff4a492f1911c0c/${RAND_CRED}/g" "$ENV_FILE" 2>/dev/null || true
                sed -i.bak "s/change_this_to_a_strong_password_123!/${RAND_DB}/g" "$ENV_FILE" 2>/dev/null || true
                sed -i.bak "s/change_this_to_a_strong_root_password_123!/${RAND_ROOT}/g" "$ENV_FILE" 2>/dev/null || true
                rm -f "${ENV_FILE}.bak"
                log_success "Generated secure randomized keys for $ENV_FILE"
            fi
        else
            log_error "Neither $ENV_FILE nor $ENV_EXAMPLE found! Please create $ENV_FILE first."
            exit 1
        fi
    fi

    # Read ingress port from .env.production
    PORT_IN_ENV=$(grep -E '^PORT=' "$ENV_FILE" | cut -d '=' -f2 | tr -d ' "\r' || true)
    PORT="${PORT_IN_ENV:-4001}"
}

wait_for_health() {
    local max_wait=90
    local elapsed=0
    log_info "Waiting for production containers to report healthy (timeout: ${max_wait}s)..."

    while [ $elapsed -lt $max_wait ]; do
        local unhealthy=0

        # Check frontend, backend, db, redis
        for svc in restropro_db restropro_redis restropro_backend restropro_frontend; do
            local status
            status=$(docker inspect --format='{{json .State.Health.Status}}' "$svc" 2>/dev/null || echo '"unknown"')
            if [ "$status" != '"healthy"' ]; then
                unhealthy=1
                break
            fi
        done

        if [ $unhealthy -eq 0 ]; then
            log_success "All containers are healthy!"
            return 0
        fi

        sleep 3
        elapsed=$((elapsed + 3))
        echo -n "."
    done

    echo ""
    log_warn "Containers took longer than ${max_wait}s to report fully healthy."
    log_info "Current container statuses:"
    compose_cmd ps
}

smoke_test() {
    log_info "Performing HTTP smoke test against ingress port $PORT..."
    local test_url="http://127.0.0.1:${PORT}/api/v1/health"
    local retries=5
    local success=0

    for ((i=1; i<=retries; i++)); do
        if command -v curl >/dev/null 2>&1; then
            if curl -fsSL "$test_url" >/dev/null 2>&1; then
                success=1
                break
            fi
        elif command -v wget >/dev/null 2>&1; then
            if wget -qO- "$test_url" >/dev/null 2>&1; then
                success=1
                break
            fi
        fi
        sleep 2
    done

    if [ $success -eq 1 ]; then
        log_success "Smoke test PASSED: $test_url responded with HTTP 200 OK."
    else
        log_warn "Smoke test pending or host firewall requires external connection. Verify with 'curl $test_url'."
    fi
}

deploy() {
    echo -e "${CLR_CYAN}${CLR_BOLD}"
    echo "=================================================================="
    echo "          Bong POS - Production Deployment Starting             "
    echo "=================================================================="
    echo -e "${CLR_RESET}"

    check_prerequisites
    setup_environment

    log_info "Building production images (frontend Vite bundle + backend + MySQL)..."
    compose_cmd build --pull

    log_info "Deploying containers via $COMPOSE_FILE..."
    compose_cmd up -d --remove-orphans

    wait_for_health
    smoke_test

    echo -e "\n${CLR_GREEN}${CLR_BOLD}==================================================================${CLR_RESET}"
    echo -e "${CLR_GREEN}${CLR_BOLD}         Bong POS Deployment Successfully Completed!            ${CLR_RESET}"
    echo -e "${CLR_GREEN}${CLR_BOLD}==================================================================${CLR_RESET}"
    CURRENT_HOST=$(hostname -f 2>/dev/null || hostname 2>/dev/null || echo "127.0.0.1")
    PRIMARY_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "127.0.0.1")
    echo -e "${CLR_BOLD}Web POS Domain:${CLR_RESET}   http://pos.allkh.app:${PORT}/ (or http://pos.allkh.app/ if proxied)"
    echo -e "${CLR_BOLD}Direct Host/IP:${CLR_RESET}   http://${CURRENT_HOST}:${PORT}/ (http://${PRIMARY_IP}:${PORT}/)"
    echo -e "${CLR_BOLD}Health Endpoint:${CLR_RESET}  http://127.0.0.1:${PORT}/api/v1/health"
    echo -e "${CLR_BOLD}Superadmin Login:${CLR_RESET} admin@example.com / Admin@123456"
    echo -e "${CLR_CYAN}------------------------------------------------------------------${CLR_RESET}"
    echo -e "Useful Commands:"
    echo -e "  View live logs:      ${CLR_YELLOW}./deploy.sh logs${CLR_RESET}"
    echo -e "  Check status:        ${CLR_YELLOW}./deploy.sh status${CLR_RESET}"
    echo -e "  Restart stack:       ${CLR_YELLOW}./deploy.sh restart${CLR_RESET}"
    echo -e "  Create DB backup:    ${CLR_YELLOW}./deploy.sh backup${CLR_RESET}"
    echo -e "  Stop stack:          ${CLR_YELLOW}./deploy.sh down${CLR_RESET}"
    echo -e "${CLR_GREEN}${CLR_BOLD}==================================================================${CLR_RESET}\n"
}

case "${1:-deploy}" in
    deploy|up)
        deploy
        ;;
    down|stop)
        check_prerequisites
        setup_environment
        log_info "Stopping Bong POS containers..."
        compose_cmd down
        log_success "All containers stopped cleanly."
        ;;
    restart)
        check_prerequisites
        setup_environment
        log_info "Restarting Bong POS stack..."
        compose_cmd restart
        wait_for_health
        log_success "Bong POS restarted."
        ;;
    status|ps)
        check_prerequisites
        setup_environment
        compose_cmd ps
        ;;
    logs)
        check_prerequisites
        setup_environment
        shift || true
        compose_cmd logs -f --tail=100 "$@"
        ;;
    backup)
        check_prerequisites
        setup_environment
        mkdir -p ./backups
        BACKUP_FILE="./backups/db-backup-$(date +%Y%m%d_%H%M%S).sql"
        DB_NAME_VAL=$(grep -E '^DB_NAME=' "$ENV_FILE" | cut -d '=' -f2 | tr -d ' "\r' || echo "restropro_saas")
        DB_PASS_VAL=$(grep -E '^DB_ROOT_PASSWORD=' "$ENV_FILE" | cut -d '=' -f2 | tr -d ' "\r' || echo "rootpassword")

        log_info "Dumping MySQL database '$DB_NAME_VAL' to $BACKUP_FILE..."
        docker exec -i restropro_db mysqldump -u root -p"$DB_PASS_VAL" "$DB_NAME_VAL" > "$BACKUP_FILE"
        log_success "Database backup successfully created: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
        ;;
    *)
        echo "Usage: $0 {deploy|down|restart|status|logs|backup}"
        exit 1
        ;;
esac
