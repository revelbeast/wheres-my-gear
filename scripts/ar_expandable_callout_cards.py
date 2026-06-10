from pathlib import Path

FILE = Path("app/scan-item.tsx")
content = FILE.read_text()

old = '''                <View style={styles.arCalloutBody}>
                  <Text style={styles.arCalloutMeta}>
                    {(label.itemCount ?? 0)} items
                  </Text>
                  <Text style={styles.arCalloutDate}>
                    {notPacked === 0 ? "All Present" : `${notPacked} Missing`}
                  </Text>
                </View>'''

new = '''                <View style={styles.arCalloutBody}>
                  <Text style={styles.arCalloutMeta}>
                    {(label.itemCount ?? 0)} items · {(label.packedCount ?? 0)} packed
                  </Text>
                  <Text style={styles.arCalloutDate}>
                    {notPacked === 0 ? "All Present" : `${notPacked} Missing`}
                  </Text>

                  {isSelected ? (
                    <View style={styles.arCalloutExpanded}>
                      <Text style={styles.arCalloutDetail} numberOfLines={1}>
                        Room: {label.roomName || "No room assigned"}
                      </Text>
                      <Text style={styles.arCalloutDetail} numberOfLines={1}>
                        Storage: {label.storageSpaceName || "Unknown storage"}
                      </Text>

                      {Array.isArray(label.topItems) && label.topItems.length > 0 ? (
                        <Text style={styles.arCalloutItems} numberOfLines={2}>
                          {label.topItems.slice(0, 3).join(", ")}
                          {label.topItems.length > 3 ? ` +${label.topItems.length - 3} more` : ""}
                        </Text>
                      ) : null}

                      <HapticPressable
                        style={styles.arCalloutOpenButton}
                        onPress={() => {
                          if (label?.compartmentId) {
                            router.replace({
                              pathname: "/vehicles/[vehicleId]/compartments/[compartmentId]",
                              params: {
                                vehicleId: label?.vehicleId ?? "unknown",
                                compartmentId: label.compartmentId,
                              },
                            });
                          }
                        }}
                      >
                        <Text style={styles.arCalloutOpenButtonText}>Open Details</Text>
                      </HapticPressable>
                    </View>
                  ) : null}
                </View>'''

if old not in content:
    raise SystemExit("Could not find callout body block")

content = content.replace(old, new)

content = content.replace(
'''  arCalloutChipSelected: {
    borderColor: "#93C5FD",
    borderWidth: 2,
    transform: [{ perspective: 900 }, { rotateY: "-4deg" }, { scale: 1.06 }],
  },''',
'''  arCalloutChipSelected: {
    width: 230,
    borderColor: "#93C5FD",
    borderWidth: 2,
    transform: [{ perspective: 900 }, { rotateY: "-4deg" }, { scale: 1.03 }],
  },'''
)

style_anchor = '''  arCalloutDate: {
    color: "#374151",
    fontSize: 14,
    marginTop: 2,
  },'''

style_add = '''  arCalloutDate: {
    color: "#374151",
    fontSize: 14,
    marginTop: 2,
  },
  arCalloutExpanded: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(15,23,42,0.12)",
    paddingTop: 8,
  },
  arCalloutDetail: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  arCalloutItems: {
    color: "#374151",
    fontSize: 12,
    marginTop: 6,
    lineHeight: 16,
  },
  arCalloutOpenButton: {
    marginTop: 8,
    backgroundColor: "#2563EB",
    borderRadius: 9,
    paddingVertical: 8,
    alignItems: "center",
  },
  arCalloutOpenButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900",
  },'''

content = content.replace(style_anchor, style_add)

FILE.write_text(content)
print("Applied expandable AR callout cards")
