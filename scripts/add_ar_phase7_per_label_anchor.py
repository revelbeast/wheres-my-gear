from pathlib import Path

FILE = Path("app/scan-item.tsx")
content = FILE.read_text()

content = content.replace(
'''          if (event?.bounds?.origin && event?.bounds?.size) {
            const screenWidth = Dimensions.get("window").width;
            const cardWidth = 285;
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
              top: Math.max(115, qrY - 185),
              left,
            });
          }''',
'''          let currentScanAnchor: { top: number; left: number } | null = null;

          if (event?.bounds?.origin && event?.bounds?.size) {
            const screenWidth = Dimensions.get("window").width;
            const cardWidth = 285;
            const margin = 16;
            const qrX = event.bounds.origin.x;
            const qrY = event.bounds.origin.y;
            const qrWidth = event.bounds.size.width;

            let left = qrX + qrWidth + 12;

            if (left + cardWidth > screenWidth - margin) {
              left = qrX - cardWidth - 12;
            }

            left = Math.max(margin, Math.min(left, screenWidth - cardWidth - margin));

            currentScanAnchor = {
              top: Math.max(115, qrY - 185),
              left,
            };

            setArAnchor(currentScanAnchor);
          }'''
)

content = content.replace(
'''                    anchor: arAnchor,''',
'''                    anchor: currentScanAnchor,'''
)

content = content.replace(
'''              setArOverlay(nextOverlay);''',
'''              setArOverlay({
                ...nextOverlay,
                anchor: currentScanAnchor,
              });'''
)

FILE.write_text(content)
print("AR Phase 7 per-label anchor patch applied")
