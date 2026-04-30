#!/usr/bin/env bash
set -euo pipefail

OUT="CHAT_HANDOFF.txt"

{
  echo "WHERE'S MY GEAR PROJECT HANDOFF"
  echo "Generated: $(date)"
  echo
  echo "==== FILE TREE ===="
  find app components lib -maxdepth 4 -type f | sort
  echo
  echo "==== FILE: app/(tabs)/_layout.tsx ===="
  if [ -f "app/(tabs)/_layout.tsx" ]; then
    cat "app/(tabs)/_layout.tsx"
  else
    echo "MISSING"
  fi
  echo
  echo "==== FILE: app/(tabs)/index.tsx ===="
  if [ -f "app/(tabs)/index.tsx" ]; then
    cat "app/(tabs)/index.tsx"
  else
    echo "MISSING"
  fi
  echo
  echo "==== FILE: app/(tabs)/inventory.tsx ===="
  if [ -f "app/(tabs)/inventory.tsx" ]; then
    cat "app/(tabs)/inventory.tsx"
  else
    echo "MISSING"
  fi
  echo
  echo "==== FILE: app/(tabs)/checklists.tsx ===="
  if [ -f "app/(tabs)/checklists.tsx" ]; then
    cat "app/(tabs)/checklists.tsx"
  else
    echo "MISSING"
  fi
  echo
  echo "==== FILE: app/(tabs)/profile.tsx ===="
  if [ -f "app/(tabs)/profile.tsx" ]; then
    cat "app/(tabs)/profile.tsx"
  else
    echo "MISSING"
  fi
  echo
  echo "==== FILE: components/ui/ScreenBackground.tsx ===="
  if [ -f "components/ui/ScreenBackground.tsx" ]; then
    cat "components/ui/ScreenBackground.tsx"
  else
    echo "MISSING"
  fi
  echo
  echo "==== FILE: lib/gearService.ts ===="
  if [ -f "lib/gearService.ts" ]; then
    cat "lib/gearService.ts"
  else
    echo "MISSING"
  fi
  echo
  echo "==== FILE: lib/settingsService.ts ===="
  if [ -f "lib/settingsService.ts" ]; then
    cat "lib/settingsService.ts"
  else
    echo "MISSING"
  fi
} > "$OUT"

echo "Created $OUT"
