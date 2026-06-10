from pathlib import Path

FILE = Path("app/scan-item.tsx")
content = FILE.read_text()

# Hide Labels In View panel
content = content.replace(
  "{arLabels.length > 1 ? (",
  "{false && arLabels.length > 1 ? (",
  1
)

# Hide detail card but keep the callout system active
content = content.replace(
'''          <View
            style={[
              styles.arCard,''',
'''          <View
            pointerEvents="none"
            style={[
              styles.arCard,
              { display: "none" },''',
1
)

# Make callouts larger and more tappable
content = content.replace("    width: 116,", "    width: 158,")
content = content.replace("    borderRadius: 8,", "    borderRadius: 10,")
content = content.replace("    paddingVertical: 4,", "    paddingVertical: 6,")
content = content.replace("    paddingVertical: 5,", "    paddingVertical: 8,")
content = content.replace("    fontSize: 11,", "    fontSize: 13,", 1)
content = content.replace("    fontSize: 10,", "    fontSize: 12,", 1)
content = content.replace("    fontSize: 9,", "    fontSize: 11,", 1)

# Make selected callout more obvious
content = content.replace(
'''  arCalloutChipSelected: {
    borderColor: "#2563EB",
    borderWidth: 2,
  },''',
'''  arCalloutChipSelected: {
    borderColor: "#2563EB",
    borderWidth: 2,
    transform: [{ scale: 1.04 }],
  },'''
)

FILE.write_text(content)
print("AR callouts-only scanner view applied")
