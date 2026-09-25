#!/bin/bash
# Launcher for the persistent dev server.
#
# Run under launchd (see scripts/com.slhj.sift-dev.plist) so the site stays up
# across crashes, logouts and reboots. Vite's HMR means edits appear in the
# browser without restarting anything.
#
# Bound to localhost on purpose: the dev server exposes /api/inference/*, which
# executes commands on the inference node over SSH. It must not be reachable
# from the wider network.

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

# launchd gives a minimal PATH; the bridge shells out to ssh and scp.
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

# Prefer the nvm-managed node this project was built against.
NVM_NODE="$HOME/.nvm/versions/node/v22.23.2/bin"
[ -d "$NVM_NODE" ] && export PATH="$NVM_NODE:$PATH"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] starting sift dev server ($(node -v)) in $PROJECT_DIR"
exec node node_modules/vite/bin/vite.js --port 5173 --strictPort
