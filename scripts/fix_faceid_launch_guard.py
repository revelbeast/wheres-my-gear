from pathlib import Path
import re

path = Path("app/_layout.tsx")
text = path.read_text()

# 1. Ensure refs exist
if "authLaunchGuardRef" not in text:
    text = re.sub(
        r"(function RootLayoutInner\(\) \{)",
        r"\1\n  const authLaunchGuardRef = React.useRef(false);\n  const authReadyRef = React.useRef(false);",
        text,
        1
    )

# 2. Patch checkAppLock to prevent early / duplicate Face ID triggers
pattern = r"async function checkAppLock\(\) \{"
replacement = """async function checkAppLock() {
  if (authLaunchGuardRef.current) return;
  authLaunchGuardRef.current = true;

  if (!authReadyRef.current) {
    authLaunchGuardRef.current = false;
    return;
  }
"""

text = re.sub(pattern, replacement, text, 1)

# 3. Mark app ready AFTER mount (delayed Face ID trigger)
if "authReadyRef.current = true" not in text:
    text = re.sub(
        r"(useEffect\(\s*\(\) => \{)",
        r"\1\n    const t = setTimeout(() => {\n      authReadyRef.current = true;\n      void checkAppLock();\n    }, 700);\n    return () => clearTimeout(t);",
        text,
        1
    )

path.write_text(text)
print("Face ID launch guard applied")
