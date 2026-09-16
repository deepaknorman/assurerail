#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
npm --prefix "${repo_root}/apps/assurerail-api" run test:ai-eval
