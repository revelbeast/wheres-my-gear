from pathlib import Path

FILE = Path("app/scan-item.tsx")
content = FILE.read_text()

replacements = {
  'backgroundColor: "rgba(10, 25, 55, 0.78)"': 'backgroundColor: "rgba(46, 69, 153, 0.95)"',
  'backgroundColor: "rgba(10,25,55,0.82)"': 'backgroundColor: "rgba(46,69,153,0.95)"',
  'backgroundColor: "rgba(37,99,235,0.28)"': 'backgroundColor: "rgba(59,130,246,0.34)"',
}

for old, new in replacements.items():
    content = content.replace(old, new)

content = content.replace(
'''    borderColor: "rgba(59,130,246,0.30)",
  },''',
'''    borderColor: "rgba(255,255,255,0.18)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },''',
1
)

content = content.replace(
'''    borderColor: "rgba(59,130,246,0.35)",
  },''',
'''    borderColor: "rgba(255,255,255,0.18)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },''',
1
)

FILE.write_text(content)
print("Final AR App Tour blue polish applied")
