#!/bin/sh
# Fake claude CLI — error variant. Emits a result with an error message,
# then exits 1. Used to verify runClaudeAnalysis surfaces lastResultMessage.

cat > /dev/null
case "$1" in
  --version) echo "fake-claude 0.0.0-test"; exit 0 ;;
esac

printf '%s\n' '{"type":"system","subtype":"init"}'
printf '%s\n' '{"type":"result","result":"Simulated analysis failure for testing."}'
exit 1
