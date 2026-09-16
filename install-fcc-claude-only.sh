#!/bin/sh
# Runs the downloaded FCC installer with only the existing Claude Code wrapper selected.
set -eu
src="$HOME/Downloads/fcc-install.sh"
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT HUP INT TERM
sed \
  -e 's/^install_codex=1$/install_codex=0/' \
  -e 's/^install_pi=1$/install_pi=0/' \
  -e 's/^install_opencode=1$/install_opencode=0/' \
  -e 's/^install_hermes=1$/install_hermes=0/' \
  -e 's/^install_dsh=1$/install_dsh=0/' \
  -e 's/^install_grok=1$/install_grok=0/' \
  -e 's/^install_muse=1$/install_muse=0/' \
  -e 's/^install_aider=1$/install_aider=0/' \
  -e 's/^if command -v cline .* command -v npm .*; then$/if false; then/' \
  -e 's/^if ! installer_is_interactive .* command -v dsh .*; then$/if false; then/' \
  "$src" > "$tmp"
exec sh "$tmp" "$@"
