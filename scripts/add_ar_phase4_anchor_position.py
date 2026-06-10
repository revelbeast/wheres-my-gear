from pathlib import Path

FILE = Path("app/scan-item.tsx")
content = FILE.read_text()

content = content.replace(
  'import { ActivityIndicator, StyleSheet, Text, View } from "react-native";',
  'import { ActivityIndicator, Dimensions, StyleSheet, Text, View } from "react-native";'
)

content = content.replace(
  '  const [arOverlay, setArOverlay] = useState<any>(null);',
  '  const [arOverlay, setArOverlay] = useState<any>(null);\n  const [arAnchor, setArAnchor] = useState<{ top: number; left: number } | null>(null);'
)

content = content.replace(
'''          console.log("AR BARCODE EVENT", JSON.stringify(event, null, 2));

          if (!value) return;''',
'''          if (event?.bounds?.origin && event?.bounds?.size) {
            const screenWidth = Dimensions.get("window").width;
            const cardWidth = 330;
            const margin = 16;
            const qrX = event.bounds.origin.x;
            const qrY = event.bounds.origin.y;
            const qrWidth = event.bounds.size.width;

            let left = qrX + qrWidth + 12;

            if (left + cardWidth > screenWidth - margin) {
              left = qrX - cardWidth - 12;
            }

            left = Math.max(margin, Math.min(left, screenWidth - cardWidth - margin));

            setArAnchor({
              top: Math.max(110, qrY - 220),
              left,
            });
          }

          if (!value) return;'''
)

content = content.replace(
  '<View style={styles.arCard}>',
  '<View style={[styles.arCard, arAnchor ? { top: arAnchor.top, left: arAnchor.left, right: undefined } : null]}>'
)

content = content.replace(
'''                setArOverlay(null);
                scanSessionRef.current.active = true;''',
'''                setArOverlay(null);
                setArAnchor(null);
                scanSessionRef.current.active = true;'''
)

content = content.replace(
'''              setArOverlay(null);
              if (arOverlay?.type === "compartment"''',
'''              setArOverlay(null);
              setArAnchor(null);
              if (arOverlay?.type === "compartment"'''
)

FILE.write_text(content)
print("AR Phase 4 anchor positioning applied")
