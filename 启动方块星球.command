#!/bin/zsh
set -u

SCRIPT_DIR="${0:A:h}"
exec "$SCRIPT_DIR/deploy/start-local.command"
