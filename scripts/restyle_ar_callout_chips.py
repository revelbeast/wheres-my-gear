from pathlib import Path

FILE = Path("app/scan-item.tsx")
content = FILE.read_text()

content = content.replace(
'''                <Text style={styles.arCalloutName} numberOfLines={1}>
                  {label.suggestedName || "Compartment"}
                </Text>
                <Text style={styles.arCalloutMeta}>
                  {(label.itemCount ?? 0)} items · {notPacked === 0 ? "OK" : `${notPacked} missing`}
                </Text>''',
'''                <View style={styles.arCalloutHeader}>
                  <Text style={styles.arCalloutName} numberOfLines={1}>
                    {label.suggestedName || "Compartment"}
                  </Text>
                </View>
                <View style={styles.arCalloutBody}>
                  <Text style={styles.arCalloutMeta}>
                    {(label.itemCount ?? 0)} items
                  </Text>
                  <Text style={styles.arCalloutDate}>
                    {notPacked === 0 ? "All Present" : `${notPacked} Missing`}
                  </Text>
                </View>'''
)

content = content.replace(
'''  arCalloutChip: {
    position: "absolute",
    width: 138,
    zIndex: 50,
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
  },''',
'''  arCalloutChip: {
    position: "absolute",
    width: 116,
    zIndex: 50,
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.18)",
  },
  arCalloutChipSelected: {
    borderColor: "#2563EB",
    borderWidth: 2,
  },
  arCalloutHeader: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  arCalloutBody: {
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  arCalloutName: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "900",
  },
  arCalloutMeta: {
    color: "#111827",
    fontSize: 10,
    fontWeight: "800",
  },
  arCalloutDate: {
    color: "#374151",
    fontSize: 9,
    marginTop: 2,
  },'''
)

FILE.write_text(content)
print("Restyled AR callout chips to match mockup cards")
