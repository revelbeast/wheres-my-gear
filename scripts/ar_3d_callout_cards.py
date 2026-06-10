from pathlib import Path

FILE = Path("app/scan-item.tsx")
content = FILE.read_text()

# Make cards larger and more 3D
content = content.replace("    width: 158,", "    width: 190,")
content = content.replace(
'''  arCalloutChip: {
    position: "absolute",
    width: 190,
    zIndex: 50,
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.18)",
  },''',
'''  arCalloutChip: {
    position: "absolute",
    width: 190,
    zIndex: 50,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(37,99,235,0.75)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
    transform: [{ perspective: 900 }, { rotateY: "-4deg" }],
  },'''
)

content = content.replace(
'''  arCalloutChipSelected: {
    borderColor: "#2563EB",
    borderWidth: 2,
    transform: [{ scale: 1.04 }],
  },''',
'''  arCalloutChipSelected: {
    borderColor: "#93C5FD",
    borderWidth: 2,
    transform: [{ perspective: 900 }, { rotateY: "-4deg" }, { scale: 1.06 }],
  },'''
)

content = content.replace(
'''  arCalloutHeader: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },''',
'''  arCalloutHeader: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.30)",
  },'''
)

content = content.replace(
'''  arCalloutBody: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },''',
'''  arCalloutBody: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#F8FAFC",
  },'''
)

content = content.replace("    fontSize: 13,", "    fontSize: 16,", 1)
content = content.replace("    fontSize: 12,", "    fontSize: 15,", 1)
content = content.replace("    fontSize: 11,", "    fontSize: 14,", 1)

# Nudge cards left so larger cards don't run off screen
content = content.replace(
'''              left: Math.max(12, Math.min(qrX + qrWidth + 8, screenWidth - 150)),''',
'''              left: Math.max(12, Math.min(qrX + qrWidth + 10, screenWidth - 202)),'''
)

FILE.write_text(content)
print("Applied 3D AR callout card styling")
