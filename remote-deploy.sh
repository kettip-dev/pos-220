#!/usr/bin/env bash
# ==============================================================================
# Bong POS - Remote 1-Click Deployment Script (Bash)
# Targets:
#   - Primary: root@10.36.200.125:/opt/restro-pos
#   - Second:  root@rocky.tail5d006f.ts.net:/opt/restro-pos
# Ingress Port: 4001
# ==============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

REMOTE_INPUT="${1:-10.36.200.125}"
if [[ "$REMOTE_INPUT" =~ ^(second|rocky|2)$ ]]; then
    REMOTE_HOST="rocky.tail5d006f.ts.net"
elif [[ "$REMOTE_INPUT" =~ ^(primary|1)$ ]]; then
    REMOTE_HOST="10.36.200.125"
else
    REMOTE_HOST="$REMOTE_INPUT"
fi
REMOTE_USER="${2:-root}"
REMOTE_DIR="${3:-/opt/restro-pos}"
ACTION="${4:-deploy}"

SSH_TARGET="${REMOTE_USER}@${REMOTE_HOST}"

CLR_RESET="\033[0m"
CLR_BOLD="\033[1m"
CLR_GREEN="\033[32m"
CLR_BLUE="\033[34m"
CLR_CYAN="\033[36m"
CLR_YELLOW="\033[33m"
CLR_RED="\033[31m"

log_info() { echo -e "${CLR_BLUE}[INFO]${CLR_RESET} $1"; }
log_success() { echo -e "${CLR_GREEN}[SUCCESS]${CLR_RESET} $1"; }
log_warn() { echo -e "${CLR_YELLOW}[WARN]${CLR_RESET} $1"; }
log_error() { echo -e "${CLR_RED}[ERROR]${CLR_RESET} $1" >&2; }

echo -e "${CLR_CYAN}${CLR_BOLD}=================================================================="
echo -e "       Bong POS - 1-Click Remote Deployment to ${REMOTE_HOST}       "
echo -e "==================================================================${CLR_RESET}"

log_info "Verifying SSH connection to ${SSH_TARGET}..."
ssh -o BatchMode=yes -o ConnectTimeout=5 "${SSH_TARGET}" "echo ok" >/dev/null 2>&1 || {
    log_error "Could not authenticate to ${SSH_TARGET} via SSH."
    exit 1
}
log_success "SSH connection verified."

if [ "$ACTION" = "deploy" ]; then
    log_info "Preparing remote directory ${REMOTE_DIR} on ${REMOTE_HOST}..."
    ssh "${SSH_TARGET}" "mkdir -p ${REMOTE_DIR}"

    log_info "Archiving and streaming workspace to ${SSH_TARGET}:${REMOTE_DIR}..."
    tar -czf - \
        --exclude="node_modules" \
        --exclude="*/node_modules/*" \
        --exclude=".git" \
        --exclude="*/.git/*" \
        --exclude="dist" \
        --exclude="*/dist/*" \
        --exclude="tmp" \
        --exclude="*/tmp/*" \
        --exclude="backups" \
        --exclude="desktop-releases" \
        --exclude="restropro-desktop" \
        --exclude="*.log" \
        --exclude=".gemini" \
        --exclude=".system_generated" \
        --exclude=".agents" \
        --exclude=".claude" \
        -C "$SCRIPT_DIR" . | ssh "${SSH_TARGET}" "tar -xzf - -C ${REMOTE_DIR}"

    log_success "Workspace transferred successfully."

    log_info "Executing ./deploy.sh on remote server..."
    ssh -t "${SSH_TARGET}" "cd ${REMOTE_DIR} && chmod +x deploy.sh && ./deploy.sh"
else
    log_info "Forwarding action '${ACTION}' to remote deploy script..."
    ssh -t "${SSH_TARGET}" "cd ${REMOTE_DIR} && ./deploy.sh ${ACTION}"
fi
