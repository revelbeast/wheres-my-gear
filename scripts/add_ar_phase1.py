import re
from pathlib import Path

FILE = Path("app/scan-item.tsx")

content = FILE.read_text()

# 1. Add AR state
if "arOverlay" not in content:
    content = re.sub(
        r"(const \[isScanning, setIsScanning\] = useState\\(false\\);)",
        r"\1\n  const [arOverlay, setArOverlay] = useState<any>(null);",
        content
    )

# 2. Replace AI navigation
content = re.sub(
    r"router\.replace\\(\\{[^}]*scan-result[^}]*\\}\\);",
    r"setArOverlay({ type: \"ai\", result });",
    content,
    flags=re.DOTALL
)

# 3. Replace QR navigation (safe minimal match)
content = re.sub(
    r"router\.push\\(\\{\\s*pathname: \"/scan-result\"[^}]*\\}\\);",
    r"setArOverlay(scanContext);",
    content,
    flags=re.DOTALL
)

FILE.write_text(content)

print("AR Phase 1 patch applied to scan-item.tsx")
