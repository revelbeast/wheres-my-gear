from pathlib import Path

FILE = Path("app/scan-item.tsx")
content = FILE.read_text()

# 1. Add multi-label state
content = content.replace(
  '  const [arOverlay, setArOverlay] = useState<any>(null);\n  const [arAnchor, setArAnchor] = useState<{ top: number; left: number } | null>(null);',
  '  const [arOverlay, setArOverlay] = useState<any>(null);\n  const [arAnchor, setArAnchor] = useState<{ top: number; left: number } | null>(null);\n  const [arLabels, setArLabels] = useState<any[]>([]);'
)

# 2. Do not freeze camera immediately during QR scans
content = content.replace(
'''          // HARD LOCK
          scanSessionRef.current.active = false;
          setCameraActive(false);
          setIsScanning(true);''',
'''          // SOFT LOCK
          // Keep camera active so multiple QR labels can be detected in one session.
          setIsScanning(true);'''
)

# 3. Fix duplicate return so scanner button state recovers
content = content.replace(
'''            console.log("DUPLICATE BLOCKED:", value);
            return;''',
'''            console.log("DUPLICATE BLOCKED:", value);
            setIsScanning(false);
            return;'''
)

# 4. Add each compartment QR as a mini AR label
content = content.replace(
'''              setArOverlay({
                type: "compartment",
                code: value,
                found: !!compartment,
                compartmentId: scannedCompartmentId,
                vehicleId: compartment?.vehicleId || scannedStorageId,
                roomId: compartment?.roomId || "",
                suggestedName: compartment?.name || "Compartment",
                source: "QR Label",
                roomName: compartment?.roomName || "No room assigned",
                storageSpaceName: storageSpace?.name || "Unknown storage",
                itemCount: items.length,
                packedCount,
                topItems,
                matchStatus: compartment ? "found" : "unknown",
              });

              return;''',
'''              const nextOverlay = {
                type: "compartment",
                code: value,
                found: !!compartment,
                compartmentId: scannedCompartmentId,
                vehicleId: compartment?.vehicleId || scannedStorageId,
                roomId: compartment?.roomId || "",
                suggestedName: compartment?.name || "Compartment",
                source: "QR Label",
                roomName: compartment?.roomName || "No room assigned",
                storageSpaceName: storageSpace?.name || "Unknown storage",
                itemCount: items.length,
                packedCount,
                topItems,
                matchStatus: compartment ? "found" : "unknown",
              };

              setArLabels((current) => {
                const withoutExisting = current.filter(
                  (label) => label.compartmentId !== scannedCompartmentId
                );

                return [
                  ...withoutExisting,
                  {
                    ...nextOverlay,
                    anchor: arAnchor,
                  },
                ].slice(-5);
              });

              setArOverlay(nextOverlay);
              setIsScanning(false);

              return;'''
)

# 5. Clear labels when closing details card only if user uses main Close button later, not X.
content = content.replace(
'''        <View style={[styles.arCard, arAnchor ? { top: arAnchor.top, left: arAnchor.left, right: undefined } : null]}>''',
'''        <>
          {arLabels.map((label) => (
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
)

content = content.replace(
'''        </View>
      ) : null}''',
'''          </View>
        </>
      ) : null}''',
1
)

# 6. Clear multi labels when user exits scanner
content = content.replace(
'''          onPress={() => router.back()}''',
'''          onPress={() => {
            setArLabels([]);
            router.back();
          }}'''
)

# 7. Add mini label styles before arCard style
content = content.replace(
'''  arCard: {
    position: "absolute",''',
'''  arMiniLabel: {
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
  },
  arCard: {
    position: "absolute",'''
)

FILE.write_text(content)
print("AR Phase 6 multi-label patch applied")
