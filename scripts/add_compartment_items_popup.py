from pathlib import Path

path = Path("app/(tabs)/vehicles/[vehicleId]/compartments/index.tsx")
text = path.read_text()

old_type = '''type CompartmentRow = Compartment & {
  itemCount: number;
};
'''

new_type = '''type CompartmentRow = Compartment & {
  itemCount: number;
  itemNames: string[];
};
'''

if old_type not in text:
    raise SystemExit("Could not find CompartmentRow type")

text = text.replace(old_type, new_type)

old_return = '''          return {
            ...compartment,
            itemCount,
          };
'''

new_return = '''          const itemNames = items
            .map((item) => item.name?.trim())
            .filter((name): name is string => !!name)
            .sort((a, b) =>
              a.localeCompare(b, undefined, {
                numeric: true,
                sensitivity: "base",
              })
            );

          return {
            ...compartment,
            itemCount,
            itemNames,
          };
'''

if old_return not in text:
    raise SystemExit("Could not find enriched return block")

text = text.replace(old_return, new_return)

anchor = '''  function handleOpenCompartment(compartmentId: string) {
'''

insert = '''  function showCompartmentItems(compartment: CompartmentRow) {
    if (compartment.itemNames.length === 0) {
      Alert.alert(compartment.name, "No items added.");
      return;
    }

    Alert.alert(
      compartment.name,
      compartment.itemNames
        .map((name, index) => `${index + 1}. ${name}`)
        .join("\\n")
    );
  }

  function handleOpenCompartment(compartmentId: string) {
'''

if anchor not in text:
    raise SystemExit("Could not find handleOpenCompartment anchor")

text = text.replace(anchor, insert)

old_render = '''                              <ThemedText color="secondary" style={styles.meta}>
                                {compartment.itemCount}{" "}
                                {compartment.itemCount === 1 ? "item" : "items"}
                              </ThemedText>
'''

new_render = '''                              <ThemedText color="secondary" style={styles.meta}>
                                {compartment.itemCount}{" "}
                                {compartment.itemCount === 1 ? "item" : "items"}
                              </ThemedText>

                              <HapticPressable
                                onPress={() => showCompartmentItems(compartment)}
                                disabled={rowDisabled}
                              >
                                <ThemedText style={styles.viewItemsText}>
                                  {`View Items (${compartment.itemNames.length})`}
                                </ThemedText>
                              </HapticPressable>
'''

if old_render not in text:
    raise SystemExit("Could not find item count render block")

text = text.replace(old_render, new_render)

style_anchor = '''  meta: {
'''

style_insert = '''  viewItemsText: {
    marginTop: 6,
    color: "#3B82F6",
    fontSize: 14,
    fontWeight: "800",
  },
  meta: {
'''

if style_anchor not in text:
    raise SystemExit("Could not find meta style anchor")

text = text.replace(style_anchor, style_insert)

path.write_text(text)
print("Added compartment item popup preview")
