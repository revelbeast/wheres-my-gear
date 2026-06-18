from pathlib import Path

path = Path("app/(tabs)/vehicles/[vehicleId]/compartments/[compartmentId].tsx")
text = path.read_text()

old = '''  function formatDuplicateItemLocation(item: Item) {
    const locationParts = [
      item.vehicleName?.trim(),
      item.compartmentName?.trim(),
    ].filter(Boolean);

    return locationParts.length > 0
      ? locationParts.join(" > ")
      : "Location not available";
  }
'''

new = '''  function formatDuplicateItemLocation(item: Item) {
    const locationParts = [
      item.vehicleName?.trim(),
      item.compartmentName?.trim(),
    ].filter(Boolean);

    return locationParts.length > 0
      ? `Location: ${locationParts.join(" > ")}`
      : "Location: Not available";
  }
'''

if old not in text:
    raise SystemExit("Could not find formatDuplicateItemLocation block")

text = text.replace(old, new)

old = '''      Alert.alert(
        "Do you already own this item?",
        `Possible duplicate found in your inventory:\\n\\n${duplicateText}\\n\\nAdd it anyway?`,
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Add Anyway",
            onPress: () => {
              void createItemAfterDuplicateCheck(trimmedName, parsedQty);
            },
          },
        ]
      );
'''

new = '''      Alert.alert(
        "Do you already own this item?",
        `Possible duplicate found in your inventory:\\n\\n${duplicateText}\\n\\nAdd it anyway?`,
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => {
              setItemName("");
              setQuantity("1");
            },
          },
          {
            text: "Add Anyway",
            onPress: () => {
              void createItemAfterDuplicateCheck(trimmedName, parsedQty);
            },
          },
        ]
      );
'''

if old not in text:
    raise SystemExit("Could not find duplicate Alert block")

text = text.replace(old, new)

path.write_text(text)
print("Duplicate item alert polished and Cancel now clears pending item")
