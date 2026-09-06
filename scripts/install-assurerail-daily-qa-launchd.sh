#!/usr/bin/env bash
# Installs the standalone AssureRail daily shadow-QA/Strix workflow for the current macOS user.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
TEMPLATE="$ROOT/scripts/launchd/com.assurerail.daily-qa.plist.template"
DEST="${HOME}/Library/LaunchAgents/com.assurerail.daily-qa.plist"
SHADOW="${ARAIL_SHADOW_ROOT:-${ROOT}-shadow}"
SECRET_FILE="${ARAIL_STRIX_SECRET_FILE:-${HOME}/.config/assurerail/strix.env}"
LOG_DIR="${ARAIL_DAILY_LOG_DIR:-${HOME}/Library/Logs/AssureRail}"

[[ "$(uname -s)" == Darwin ]] || { echo "launchd installer is macOS-only; use cron/systemd with scripts/assurerail-daily-qa.sh" >&2; exit 2; }
[[ -f "$TEMPLATE" ]] || { echo "missing launchd template" >&2; exit 1; }
[[ -f "$SECRET_FILE" ]] || { echo "create $SECRET_FILE with LLM_API_KEY=... and chmod 600 before installation" >&2; exit 1; }
mode="$(stat -f '%Lp' "$SECRET_FILE")"
[[ "$mode" == 600 ]] || { echo "$SECRET_FILE must have mode 600 (received $mode)" >&2; exit 1; }

mkdir -p "$(dirname "$DEST")" "$LOG_DIR"
escaped_root="${ROOT//&/\\&}"; escaped_root="${escaped_root//|/\\|}"
escaped_shadow="${SHADOW//&/\\&}"; escaped_shadow="${escaped_shadow//|/\\|}"
escaped_secret="${SECRET_FILE//&/\\&}"; escaped_secret="${escaped_secret//|/\\|}"
escaped_log="${LOG_DIR//&/\\&}"; escaped_log="${escaped_log//|/\\|}"
sed -e "s|__REPO__|$escaped_root|g" -e "s|__SHADOW__|$escaped_shadow|g" \
  -e "s|__STRIX_SECRET_FILE__|$escaped_secret|g" -e "s|__LOG_DIR__|$escaped_log|g" \
  "$TEMPLATE" >"$DEST"
chmod 600 "$DEST"
plutil -lint "$DEST"
launchctl bootout "gui/$(id -u)/com.assurerail.daily-qa" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$DEST"
launchctl print "gui/$(id -u)/com.assurerail.daily-qa" >/dev/null
echo "Installed com.assurerail.daily-qa at 02:15 local time. Logs: $LOG_DIR"
