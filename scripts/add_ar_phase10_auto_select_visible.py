from pathlib import Path

FILE = Path("app/scan-item.tsx")
content = FILE.read_text()

content = content.replace(
'''              setArLabels((current) => {
                const withoutExisting = current.filter(
                  (label) => label.compartmentId !== scannedCompartmentId
                );

                return [
                  ...withoutExisting,
                  {
                    ...nextOverlay,
                    anchor: currentScanAnchor,
                  },
                ]
                  .sort((a, b) => {
                    const aTop = a?.anchor?.top ?? 9999;
                    const bTop = b?.anchor?.top ?? 9999;
                    return aTop - bTop;
                  })
                  .slice(0, 5);
              });

              setArOverlay({
                ...nextOverlay,
                anchor: currentScanAnchor,
              });''',
'''              const visibleOverlay = {
                ...nextOverlay,
                anchor: currentScanAnchor,
                lastSeenAt: Date.now(),
              };

              setArLabels((current) => {
                const withoutExisting = current.filter(
                  (label) => label.compartmentId !== scannedCompartmentId
                );

                return [
                  ...withoutExisting,
                  visibleOverlay,
                ]
                  .sort((a, b) => {
                    const aTop = a?.anchor?.top ?? 9999;
                    const bTop = b?.anchor?.top ?? 9999;
                    return aTop - bTop;
                  })
                  .slice(0, 5);
              });

              setArOverlay(visibleOverlay);'''
)

content = content.replace(
'''                const isSelected = arOverlay?.compartmentId === label.compartmentId;''',
'''                const isSelected = arOverlay?.compartmentId === label.compartmentId;
                const notPacked = Math.max(0, (label.itemCount ?? 0) - (label.packedCount ?? 0));'''
)

content = content.replace(
'''                      <Text style={styles.nearbyLabelMeta}>
                        {(label.itemCount ?? 0)} items · {label.roomName || "No room"}
                      </Text>''',
'''                      <Text style={styles.nearbyLabelMeta}>
                        {(label.itemCount ?? 0)} items · {notPacked === 0 ? "All Present" : `${notPacked} not packed`}
                      </Text>'''
)

content = content.replace(
'''          <Text style={styles.arCardSubtitle}>
            {arOverlay?.found ? "Recognized label or item" : "Unknown item"}
          </Text>''',
'''          <Text style={styles.arCardSubtitle}>
            {arOverlay?.type === "compartment"
              ? "Compartment Inventory"
              : arOverlay?.found
                ? "Recognized label or item"
                : "Unknown item"}
          </Text>'''
)

FILE.write_text(content)
print("AR Phase 10 auto-select visible label patch applied")
