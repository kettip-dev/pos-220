#!/usr/bin/env bash
# ==============================================================================
# Bong POS - 1-Click Deploy to Second Server (Rocky Linux / Tailscale)
# Target: root@rocky.tail5d006f.ts.net:/opt/restro-pos
# Ingress: http://rocky.tail5d006f.ts.net:4001
# ==============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ACTION="${1:-deploy}"

"$SCRIPT_DIR/remote-deploy.sh" "rocky.tail5d006f.ts.net" "root" "/opt/restro-pos" "$ACTION"
