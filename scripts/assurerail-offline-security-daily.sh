#!/usr/bin/env bash
set -euo pipefail
umask 077

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
exec "${NODE_BINARY:-node}" "$SCRIPT_DIR/assurerail-offline-security-daily.mjs" "$@"
