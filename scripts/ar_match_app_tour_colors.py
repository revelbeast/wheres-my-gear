from pathlib import Path

FILE = Path("app/scan-item.tsx")
content = FILE.read_text()

replacements = {
    'backgroundColor: "rgba(15, 23, 42, 0.84)"': 'backgroundColor: "rgba(10, 25, 55, 0.78)"',
    'borderColor: "rgba(255,255,255,0.14)"': 'borderColor: "rgba(59,130,246,0.30)"',
    'backgroundColor: "rgba(37, 99, 235, 0.22)"': 'backgroundColor: "rgba(37,99,235,0.28)"',
    'backgroundColor: "rgba(15, 23, 42, 0.88)"': 'backgroundColor: "rgba(10,25,55,0.82)"',
    'borderColor: "rgba(255,255,255,0.16)"': 'borderColor: "rgba(59,130,246,0.35)"',
    'backgroundColor: "#2563EB"': 'backgroundColor: "#3B82F6"',
}

for old, new in replacements.items():
    content = content.replace(old, new)

# Add subtle glow to primary AR button if not already present.
content = content.replace(
'''  arPrimaryButton: {
    marginTop: 10,
    backgroundColor: "#3B82F6",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },''',
'''  arPrimaryButton: {
    marginTop: 10,
    backgroundColor: "#3B82F6",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },'''
)

FILE.write_text(content)
print("Matched AR scanner cards to App Tour colors")
