from pathlib import Path

FILE = Path("app/scan-item.tsx")
content = FILE.read_text()

# 1. Add AR card JSX between CameraView and footer
needle = '''      <View style={styles.footer}>'''

insert = '''      {arOverlay ? (
        <View style={styles.arCard}>
          <View style={styles.arCardHeader}>
            <Text style={styles.arCardTitle}>
              {arOverlay?.suggestedName || "Gear Scan Result"}
            </Text>

            <HapticPressable
              style={styles.arCloseButton}
              onPress={() => {
                setArOverlay(null);
                scanSessionRef.current.active = true;
                setCameraActive(true);
                setIsScanning(false);
              }}
            >
              <Text style={styles.arCloseText}>×</Text>
            </HapticPressable>
          </View>

          <Text style={styles.arCardSubtitle}>
            {arOverlay?.found ? "Recognized label or item" : "Unknown item"}
          </Text>

          <View style={styles.arMetricRow}>
            <Text style={styles.arMetricLabel}>Source</Text>
            <Text style={styles.arMetricValue}>{arOverlay?.source || "Unknown"}</Text>
          </View>

          <View style={styles.arMetricRow}>
            <Text style={styles.arMetricLabel}>Code</Text>
            <Text style={styles.arMetricValue} numberOfLines={1}>
              {arOverlay?.code || "N/A"}
            </Text>
          </View>

          {arOverlay?.brand ? (
            <View style={styles.arMetricRow}>
              <Text style={styles.arMetricLabel}>Brand</Text>
              <Text style={styles.arMetricValue}>{arOverlay.brand}</Text>
            </View>
          ) : null}

          {arOverlay?.matchConfidence ? (
            <View style={styles.arMetricRow}>
              <Text style={styles.arMetricLabel}>Confidence</Text>
              <Text style={styles.arMetricValue}>{arOverlay.matchConfidence}</Text>
            </View>
          ) : null}

          {arOverlay?.description ? (
            <Text style={styles.arDescription} numberOfLines={3}>
              {arOverlay.description}
            </Text>
          ) : null}

          <HapticPressable
            style={styles.arPrimaryButton}
            onPress={() => {
              setArOverlay(null);
              router.replace({
                pathname: "/scan-result",
                params: {
                  code: arOverlay?.code ?? "",
                  found: String(!!arOverlay?.found),
                  suggestedName: arOverlay?.suggestedName ?? "",
                  source: arOverlay?.source ?? "Unknown",
                  brand: arOverlay?.brand ?? "",
                  image: arOverlay?.image ?? "",
                  description: arOverlay?.description ?? "",
                  matchConfidence: arOverlay?.matchConfidence ?? "",
                  matchStatus: arOverlay?.matchStatus ?? "unknown",
                },
              });
            }}
          >
            <Text style={styles.arPrimaryButtonText}>Open Details</Text>
          </HapticPressable>
        </View>
      ) : null}

'''

if "styles.arCard" not in content:
    content = content.replace(needle, insert + needle)

# 2. Add AR card styles
style_needle = '''  aiButton: {
    marginBottom: 12,
    backgroundColor: "#2563EB",
  },
});'''

style_insert = '''  aiButton: {
    marginBottom: 12,
    backgroundColor: "#2563EB",
  },
  arCard: {
    position: "absolute",
    top: 145,
    left: 20,
    right: 20,
    zIndex: 20,
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  arCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  arCardTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    flex: 1,
    paddingRight: 12,
  },
  arCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  arCloseText: {
    color: "#fff",
    fontSize: 24,
    lineHeight: 26,
  },
  arCardSubtitle: {
    color: "rgba(255,255,255,0.75)",
    marginTop: 6,
    marginBottom: 12,
  },
  arMetricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 8,
  },
  arMetricLabel: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 13,
  },
  arMetricValue: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
    textAlign: "right",
  },
  arDescription: {
    color: "rgba(255,255,255,0.84)",
    marginTop: 12,
    lineHeight: 19,
  },
  arPrimaryButton: {
    marginTop: 14,
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  arPrimaryButtonText: {
    color: "#fff",
    fontWeight: "800",
  },
});'''

content = content.replace(style_needle, style_insert)

FILE.write_text(content)
print("AR Phase 2 floating card patch applied")
