from pathlib import Path

FILE = Path("app/scan-item.tsx")
content = FILE.read_text()

content = content.replace(
  'import { getCompartmentById, getItemsByCompartment, getRoomById } from "../lib/gearService";',
  'import { getCompartmentById, getItemsByCompartment, getRoomById, getStorageSpaceById } from "../lib/gearService";'
)

content = content.replace(
'''              const compartment = await getCompartmentById(scannedCompartmentId);
              const items = await getItemsByCompartment(scannedCompartmentId);''',
'''              const compartment = await getCompartmentById(scannedCompartmentId);
              const storageSpace = compartment?.vehicleId
                ? await getStorageSpaceById(compartment.vehicleId)
                : null;
              const items = await getItemsByCompartment(scannedCompartmentId);'''
)

content = content.replace(
'''                source: "QR Label",
                itemCount: items.length,''',
'''                source: "QR Label",
                roomName: compartment?.roomName || "No room assigned",
                storageSpaceName: storageSpace?.name || "Unknown storage",
                itemCount: items.length,'''
)

content = content.replace(
'''          <View style={styles.arMetricRow}>
            <Text style={styles.arMetricLabel}>Source</Text>
            <Text style={styles.arMetricValue}>{arOverlay?.source || "Unknown"}</Text>
          </View>

          <View style={styles.arMetricRow}>
            <Text style={styles.arMetricLabel}>Code</Text>
            <Text style={styles.arMetricValue} numberOfLines={1}>
              {arOverlay?.code || "N/A"}
            </Text>
          </View>''',
'''          {arOverlay?.type === "compartment" ? (
            <>
              <View style={styles.arMetricRow}>
                <Text style={styles.arMetricLabel}>Room</Text>
                <Text style={styles.arMetricValue} numberOfLines={1}>
                  {arOverlay?.roomName || "No room assigned"}
                </Text>
              </View>

              <View style={styles.arMetricRow}>
                <Text style={styles.arMetricLabel}>Storage</Text>
                <Text style={styles.arMetricValue} numberOfLines={1}>
                  {arOverlay?.storageSpaceName || "Unknown storage"}
                </Text>
              </View>
            </>
          ) : (
            <>
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
            </>
          )}'''
)

FILE.write_text(content)
print("AR Phase 5 room and storage labels applied")
