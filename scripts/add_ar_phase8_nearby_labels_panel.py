from pathlib import Path
import re

FILE = Path("app/scan-item.tsx")
content = FILE.read_text()

old_block = '''          {arLabels.map((label) => (
            <HapticPressable
              key={label.compartmentId}
              style={[
                styles.arMiniLabel,
                label.anchor
                  ? {
                      top: Math.max(96, label.anchor.top + 10),
                      left: Math.max(14, Math.min(label.anchor.left, Dimensions.get("window").width - 176)),
                    }
                  : null,
              ]}
              onPress={() => {
                setArOverlay(label);
                setArAnchor(label.anchor ?? null);
              }}
            >
              <Text style={styles.arMiniLabelTitle} numberOfLines={1}>
                {label.suggestedName || "Compartment"}
              </Text>
              <Text style={styles.arMiniLabelMeta}>
                {label.itemCount ?? 0} items
              </Text>
            </HapticPressable>
          ))}

          <View style={[styles.arCard, arAnchor ? { top: arAnchor.top, left: arAnchor.left, right: undefined } : null]}>'''

new_block = '''          {arLabels.length > 1 ? (
            <View style={styles.nearbyLabelsPanel}>
              <Text style={styles.nearbyLabelsTitle}>
                Nearby Labels ({arLabels.length})
              </Text>

              {arLabels.map((label) => {
                const isSelected = arOverlay?.compartmentId === label.compartmentId;

                return (
                  <HapticPressable
                    key={label.compartmentId}
                    style={[
                      styles.nearbyLabelRow,
                      isSelected ? styles.nearbyLabelRowSelected : null,
                    ]}
                    onPress={() => {
                      setArOverlay(label);
                      setArAnchor(label.anchor ?? null);
                    }}
                  >
                    <View style={styles.nearbyLabelTextBox}>
                      <Text style={styles.nearbyLabelName} numberOfLines={1}>
                        {label.suggestedName || "Compartment"}
                      </Text>
                      <Text style={styles.nearbyLabelMeta}>
                        {(label.itemCount ?? 0)} items · {label.roomName || "No room"}
                      </Text>
                    </View>

                    <Text style={styles.nearbyLabelChevron}>›</Text>
                  </HapticPressable>
                );
              })}
            </View>
          ) : null}

          <View style={styles.arCard}>'''

if old_block not in content:
    raise SystemExit("Could not find mini label block")

content = content.replace(old_block, new_block)

# Replace old mini label styles with Nearby Labels styles
old_styles = '''  arMiniLabel: {
    position: "absolute",
    width: 160,
    zIndex: 18,
    backgroundColor: "rgba(37, 99, 235, 0.92)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  arMiniLabelTitle: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900",
  },
  arMiniLabelMeta: {
    color: "#fff",
    fontSize: 11,
    marginTop: 2,
  },'''

new_styles = '''  nearbyLabelsPanel: {
    position: "absolute",
    top: 92,
    left: 16,
    right: 16,
    zIndex: 18,
    backgroundColor: "rgba(15, 23, 42, 0.78)",
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  nearbyLabelsTitle: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: 8,
    letterSpacing: 0.6,
  },
  nearbyLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 10,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: "rgba(37, 99, 235, 0.95)",
  },
  nearbyLabelRowSelected: {
    backgroundColor: "rgba(37, 99, 235, 0.22)",
  },
  nearbyLabelTextBox: {
    flex: 1,
    paddingRight: 10,
  },
  nearbyLabelName: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900",
  },
  nearbyLabelMeta: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    marginTop: 2,
  },
  nearbyLabelChevron: {
    color: "#fff",
    fontSize: 28,
    lineHeight: 28,
    opacity: 0.85,
  },'''

if old_styles not in content:
    raise SystemExit("Could not find mini label styles")

content = content.replace(old_styles, new_styles)

# Move main detail card lower when nearby labels panel is present
content = content.replace("top: 118,", "top: 315,")

FILE.write_text(content)
print("AR Phase 8 Nearby Labels panel applied")
