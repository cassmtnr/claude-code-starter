#!/bin/sh
# Fake claude CLI — slow variant. Sleeps so the SIGTERM cleanup test has
# time to send the signal and observe the process termination.

cat > /dev/null
case "$1" in
  --version) echo "fake-claude 0.0.0-test"; exit 0 ;;
esac

printf '%s\n' '{"type":"system","subtype":"init"}'
# Sleep 30s; tests should SIGTERM well before this completes.
# `exec` replaces the shell with sleep so SIGTERM to the child PID kills it
# directly (no orphaned grandchild keeping the pipe open).
exec sleep 30
echo '{"type":"result","result":"should never reach here"}'
exit 0
