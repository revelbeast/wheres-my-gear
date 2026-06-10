from pathlib import Path

FILE = Path("app/scan-item.tsx")
content = FILE.read_text()

old = '''                    top: label.calloutAnchor.top,
                    left: label.calloutAnchor.left,'''

new = '''                    top: label.calloutAnchor.top,
                    left: Math.max(
                      12,
                      Math.min(
                        label.calloutAnchor.left,
                        Dimensions.get("window").width - (isSelected ? 292 : 202)
                      )
                    ),'''

if old not in content:
    raise SystemExit("Could not find callout anchor style block")

content = content.replace(old, new)

content = content.replace(
'''  arCalloutChipSelected: {
    width: 230,''',
'''  arCalloutChipSelected: {
    width: 280,'''
)

FILE.write_text(content)
print("Fixed expanded AR card screen bounds")
