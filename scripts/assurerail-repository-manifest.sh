#!/usr/bin/env bash
# Emit a deterministic SHA-256 manifest for every tracked blob at a Git revision.
# Usage: scripts/assurerail-repository-manifest.sh [ref]
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
REF="${1:-HEAD}"
COMMIT="$(git -C "$REPO_ROOT" rev-parse --verify "$REF^{commit}")"

printf 'assurerailRepositoryManifestVersion=1\n'
printf 'commit=%s\n' "$COMMIT"
printf 'hashAlgorithm=sha256\n'
printf 'fileCount=%s\n' "$(git -C "$REPO_ROOT" ls-tree -r --name-only -z "$COMMIT" | tr -cd '\0' | wc -c | tr -d ' ')"
printf '\n'

while IFS= read -r -d '' path; do
  digest="$({ git -C "$REPO_ROOT" show "$COMMIT:$path" | shasum -a 256; } | awk '{print $1}')"
  printf '%s  %s\n' "$digest" "$path"
done < <(git -C "$REPO_ROOT" ls-tree -r --name-only -z "$COMMIT")
