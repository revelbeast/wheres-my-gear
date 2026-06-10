from pathlib import Path

FILE = Path("app/scan-item.tsx")
content = FILE.read_text()

# Remove duplicated timestamp assignment
content = content.replace(
'''          scanSessionRef.current.timestamp = now;
          scanSessionRef.current.timestamp = now;
          scanHistoryRef.current.push(value);''',
'''          scanSessionRef.current.timestamp = now;
          scanHistoryRef.current.push(value);'''
)

# Stop console spam for duplicate frames
content = content.replace(
'''            console.log("DUPLICATE BLOCKED:", value);
            setIsScanning(false);
            return;''',
'''            setIsScanning(false);
            return;'''
)

FILE.write_text(content)
print("AR Phase 12 scanner noise cleanup applied")
