from pathlib import Path

FILE = Path("app/scan-item.tsx")
content = FILE.read_text()

# 1. Add imports
content = content.replace(
    'import { getRoomById } from "../lib/gearService";',
    'import { getCompartmentById, getItemsByCompartment, getRoomById } from "../lib/gearService";'
)

# 2. Replace compartment QR immediate navigation with AR inventory overlay
old = '''            if (scannedCompartmentId) {
              router.replace({
                pathname: "/vehicles/[vehicleId]/compartments/[compartmentId]",
                params: {
                  vehicleId: scannedStorageId,
                  compartmentId: scannedCompartmentId,
                },
              });
              return;
            }'''

new = '''            if (scannedCompartmentId) {
              const compartment = await getCompartmentById(scannedCompartmentId);
              const items = await getItemsByCompartment(scannedCompartmentId);

              const packedCount = items.filter((item: any) => item.status === "packed").length;
              const topItems = items
                .slice(0, 5)
                .map((item: any) => item.name)
                .filter(Boolean);

              setArOverlay({
                type: "compartment",
                code: value,
                found: !!compartment,
                compartmentId: scannedCompartmentId,
                vehicleId: compartment?.vehicleId || scannedStorageId,
                roomId: compartment?.roomId || "",
                suggestedName: compartment?.name || "Compartment",
                source: "QR Label",
                itemCount: items.length,
                packedCount,
                topItems,
                matchStatus: compartment ? "found" : "unknown",
              });

              return;
            }'''

content = content.replace(old, new)

# 3. Add inventory metrics to card after subtitle
old_metrics_anchor = '''          <View style={styles.arMetricRow}>
            <Text style={styles.arMetricLabel}>Source</Text>
            <Text style={styles.arMetricValue}>{arOverlay?.source || "Unknown"}</Text>
          </View>'''

new_metrics_anchor = '''          {arOverlay?.type === "compartment" ? (
            <>
              <View style={styles.arStatsRow}>
                <View style={styles.arStatBox}>
                  <Text style={styles.arStatNumber}>{arOverlay?.itemCount ?? 0}</Text>
                  <Text style={styles.arStatLabel}>Items</Text>
                </View>

                <View style={styles.arStatBox}>
                  <Text style={styles.arStatNumber}>{arOverlay?.packedCount ?? 0}</Text>
                  <Text style={styles.arStatLabel}>Packed</Text>
                </View>
              </View>

              {Array.isArray(arOverlay?.topItems) && arOverlay.topItems.length > 0 ? (
                <View style={styles.arTopItemsBox}>
                  <Text style={styles.arTopItemsTitle}>Top Items</Text>
                  <Text style={styles.arTopItemsText}>
                    {arOverlay.topItems.join(", ")}
                  </Text>
                </View>
              ) : null}
            </>
          ) : null}

          <View style={styles.arMetricRow}>
            <Text style={styles.arMetricLabel}>Source</Text>
            <Text style={styles.arMetricValue}>{arOverlay?.source || "Unknown"}</Text>
          </View>'''

content = content.replace(old_metrics_anchor, new_metrics_anchor)

# 4. Make Open Details route to compartment when available
old_route = '''              router.replace({
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
              });'''

new_route = '''              if (arOverlay?.type === "compartment" && arOverlay?.compartmentId) {
                router.replace({
                  pathname: "/vehicles/[vehicleId]/compartments/[compartmentId]",
                  params: {
                    vehicleId: arOverlay?.vehicleId ?? "unknown",
                    compartmentId: arOverlay.compartmentId,
                  },
                });
                return;
              }

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
              });'''

content = content.replace(old_route, new_route)

# 5. Add styles
style_anchor = '''  arMetricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 8,
  },'''

style_insert = '''  arStatsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
    marginBottom: 8,
  },
  arStatBox: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  arStatNumber: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "900",
  },
  arStatLabel: {
    color: "rgba(255,255,255,0.68)",
    fontSize: 12,
    marginTop: 2,
  },
  arTopItemsBox: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  arTopItemsTitle: {
    color: "rgba(255,255,255,0.68)",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
  },
  arTopItemsText: {
    color: "#fff",
    lineHeight: 18,
  },
  arMetricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 8,
  },'''

content = content.replace(style_anchor, style_insert)

FILE.write_text(content)
print("AR Phase 3 compartment inventory card patch applied")
