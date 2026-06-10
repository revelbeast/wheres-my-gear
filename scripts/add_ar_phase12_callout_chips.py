from pathlib import Path

FILE = Path("app/scan-item.tsx")
content = FILE.read_text()

insert = '''          {arLabels.map((label) => {
            const notPacked = Math.max(0, (label.itemCount ?? 0) - (label.packedCount ?? 0));
            const isSelected = arOverlay?.compartmentId === label.compartmentId;

            if (!label.anchor) return null;

            return (
              <HapticPressable
                key={`callout-${label.compartmentId}`}
                style={[
                  styles.arCalloutChip,
                  {
                    top: Math.max(88, label.anchor.top + 165),
                    left: Math.max(12, Math.min(label.anchor.left, Dimensions.get("window").width - 150)),
                  },
                  isSelected ? styles.arCalloutChipSelected : null,
                ]}
                onPress={() => {
                  setArOverlay(label);
                  setArAnchor(label.anchor ?? null);
                }}
              >
                <Text style={styles.arCalloutName} numberOfLines={1}>
                  {label.suggestedName || "Compartment"}
                </Text>
                <Text style={styles.arCalloutMeta}>
                  {(label.itemCount ?? 0)} items · {notPacked === 0 ? "OK" : `${notPacked} missing`}
                </Text>
              </HapticPressable>
            );
          })}

'''

needle = '''          {arLabels.length > 1 ? ('''

if "styles.arCalloutChip" not in content:
    content = content.replace(needle, insert + needle)

style_insert = '''  arCalloutChip: {
    position: "absolute",
    width: 138,
    zIndex: 17,
    backgroundColor: "rgba(37, 99, 235, 0.92)",
    borderRadius: 11,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
  },
  arCalloutChipSelected: {
    backgroundColor: "rgba(37, 99, 235, 1)",
    borderColor: "rgba(255,255,255,0.65)",
  },
  arCalloutName: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900",
  },
  arCalloutMeta: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 10,
    marginTop: 2,
  },
'''

style_needle = '''  nearbyLabelsPanel: {'''

if "arCalloutChip:" not in content:
    content = content.replace(style_needle, style_insert + style_needle)

FILE.write_text(content)
print("AR Phase 12 callout chips applied")
