#!/usr/bin/env bash
set -euo pipefail

OUT="CHAT_HANDOFF.txt"

print_file () {
  local file="$1"
  echo
  echo "==== FILE: $file ===="
  if [ -f "$file" ]; then
    cat "$file"
  else
    echo "MISSING"
  fi
}

{
  echo "WHERE'S MY GEAR PROJECT HANDOFF"
  echo "Version in App Store Connect: 1.0.1"
  echo "Current development target: 1.0.2"
  echo "Branch: $(git branch --show-current 2>/dev/null || echo 'unknown')"
  echo "Latest commit: $(git log -1 --oneline 2>/dev/null || echo 'unknown')"
  echo "Generated: $(date)"
  echo

  echo "==== FILE TREE ===="
  find app components lib types -maxdepth 5 -type f | sort 2>/dev/null || true

  print_file "app/_layout.tsx"
  print_file "app/(tabs)/_layout.tsx"
  print_file "app/(tabs)/index.tsx"
  print_file "app/(tabs)/inventory.tsx"
  print_file "app/(tabs)/checklists.tsx"
  print_file "app/(tabs)/profile.tsx"

  print_file "app/checklists/index.tsx"
  print_file "app/checklists/new.tsx"
  print_file "app/checklists/create.tsx"
  print_file "app/checklists/create-template.tsx"
  print_file "app/checklists/templates.tsx"
  print_file "app/checklists/[checklistId].tsx"

  print_file "lib/checklistsService.ts"
  print_file "lib/gearService.ts"
  print_file "lib/settingsService.ts"
  print_file "types/checklists.ts"

  print_file "components/ui/ScreenBackground.tsx"
  print_file "components/ui/Themed.tsx"
} > "$OUT"

echo "Created $OUT"
