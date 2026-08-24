#!/bin/sh
# Claude Code PostToolUse hook: format a single file that was just written or
# edited. Reads the tool payload as JSON on stdin, pulls out the file path, and
# runs Prettier on it (respecting .prettierignore and skipping unsupported
# types). Keeps every file Claude touches in a web session already-formatted,
# so pushes never trip the CI `format:check` gate. Referenced by
# .claude/settings.json.
#
# Best-effort: any failure exits 0 so it never blocks an edit.

file=$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);process.stdout.write((j.tool_input&&(j.tool_input.file_path||j.tool_input.filePath))||"")}catch(e){}})' 2>/dev/null)

[ -z "$file" ] && exit 0
[ -f "$file" ] || exit 0

npx --no-install prettier --write --ignore-unknown "$file" >/dev/null 2>&1

exit 0
