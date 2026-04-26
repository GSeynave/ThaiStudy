#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOKS_DIR="$ROOT_DIR/.git/hooks"
COMMIT_MSG_HOOK="$HOOKS_DIR/commit-msg"

mkdir -p "$HOOKS_DIR"

cat >"$COMMIT_MSG_HOOK" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
node "$ROOT_DIR/scripts/check-commit-message.mjs" "$1"
EOF

chmod +x "$COMMIT_MSG_HOOK"

echo "Installed commit-msg hook at $COMMIT_MSG_HOOK"
