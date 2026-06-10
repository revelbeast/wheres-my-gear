from pathlib import Path

FILE = Path("app/scan-item.tsx")
content = FILE.read_text()

old = '''                return [
                  ...withoutExisting,
                  {
                    ...nextOverlay,
                    anchor: currentScanAnchor,
                  },
                ].slice(-5);'''

new = '''                return [
                  ...withoutExisting,
                  {
                    ...nextOverlay,
                    anchor: currentScanAnchor,
                  },
                ]
                  .sort((a, b) => {
                    const aTop = a?.anchor?.top ?? 9999;
                    const bTop = b?.anchor?.top ?? 9999;
                    return aTop - bTop;
                  })
                  .slice(0, 5);'''

if old not in content:
    raise SystemExit("Could not find arLabels return block")

content = content.replace(old, new)

FILE.write_text(content)
print("AR Phase 9 Nearby Labels top-to-bottom sorting applied")
