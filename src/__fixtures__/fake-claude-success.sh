#!/bin/sh
# Fake claude CLI — success variant. Emits a representative stream-json
# sequence then exits 0. Used by Phase 11 H3/H5/M4 tests.

# Drain stdin so the parent's child.stdin.write/end completes without EPIPE.
cat > /dev/null

# Match real `claude --version` short-circuit if someone calls us that way.
case "$1" in
  --version) echo "fake-claude 0.0.0-test"; exit 0 ;;
esac

# Emit canned stream-json. One JSON object per line per real CLI behavior.
printf '%s\n' '{"type":"system","subtype":"init"}'
printf '%s\n' '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Read","input":{"file_path":"package.json"}}]}}'
printf '%s\n' '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Write","input":{"file_path":".claude/CLAUDE.md"}}]}}'
printf '%s\n' '{"type":"result","result":"Analysis complete (fake)."}'
exit 0
