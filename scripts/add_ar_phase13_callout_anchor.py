from pathlib import Path

FILE = Path("app/scan-item.tsx")
content = FILE.read_text()

# 1. Add callout anchor calculation beside the existing detail anchor.
content = content.replace(
'''          let currentScanAnchor: { top: number; left: number } | null = null;''',
'''          let currentScanAnchor: { top: number; left: number } | null = null;
          let currentCalloutAnchor: { top: number; left: number } | null = null;'''
)

content = content.replace(
'''            currentScanAnchor = {
              top: Math.max(115, qrY - 185),
              left,
            };

            setArAnchor(currentScanAnchor);''',
'''            currentScanAnchor = {
              top: Math.max(115, qrY - 185),
              left,
            };

            currentCalloutAnchor = {
              top: Math.max(84, qrY - 38),
              left: Math.max(12, Math.min(qrX + qrWidth + 8, screenWidth - 150)),
            };

            setArAnchor(currentScanAnchor);'''
)

# 2. Store callout anchor with visible overlay.
content = content.replace(
'''                anchor: currentScanAnchor,
                lastSeenAt: Date.now(),''',
'''                anchor: currentScanAnchor,
                calloutAnchor: currentCalloutAnchor,
                lastSeenAt: Date.now(),'''
)

# 3. Use calloutAnchor for chips instead of detail anchor.
content = content.replace(
'''            if (!label.anchor) return null;''',
'''            if (!label.calloutAnchor) return null;'''
)

content = content.replace(
'''                    top: Math.max(88, label.anchor.top + 165),
                    left: Math.max(12, Math.min(label.anchor.left, Dimensions.get("window").width - 150)),''',
'''                    top: label.calloutAnchor.top,
                    left: label.calloutAnchor.left,'''
)

FILE.write_text(content)
print("AR Phase 13 callout-specific anchor patch applied")
