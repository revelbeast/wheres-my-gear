from pathlib import Path

path = Path("app/(tabs)/vehicles/[vehicleId]/compartments/[compartmentId].tsx")
text = path.read_text()

old = '''  async function findPossibleDuplicateItems(newName: string) {
    const normalizedNewName = normalizeDuplicateItemName(newName);

    if (!normalizedNewName) return [];

    const allItems = await getAllItems();

    return allItems
      .filter((item) => {
        const existingName = normalizeDuplicateItemName(item.name || "");

        if (!existingName) return false;

        return (
          existingName === normalizedNewName ||
          existingName.includes(normalizedNewName) ||
          normalizedNewName.includes(existingName)
        );
      })
      .slice(0, 3);
  }
'''

new = '''  function formatDuplicateItemLocation(item: Item) {
    const locationParts = [
      item.vehicleName?.trim(),
      item.compartmentName?.trim(),
    ].filter(Boolean);

    return locationParts.length > 0
      ? locationParts.join(" > ")
      : "Location not available";
  }

  async function findPossibleDuplicateItems(newName: string) {
    const normalizedNewName = normalizeDuplicateItemName(newName);

    if (!normalizedNewName) return [];

    const allItems = await getAllItems();

    return allItems
      .filter((item) => {
        const existingName = normalizeDuplicateItemName(item.name || "");

        if (!existingName) return false;

        return (
          existingName === normalizedNewName ||
          existingName.includes(normalizedNewName) ||
          normalizedNewName.includes(existingName)
        );
      })
      .slice(0, 3);
  }
'''

if old not in text:
    raise SystemExit("Could not find duplicate finder block")

text = text.replace(old, new)

old = '''      const duplicateText = possibleDuplicates
        .map((item) => `• ${item.name}`)
        .join("\\n");
'''

new = '''      const duplicateText = possibleDuplicates
        .map(
          (item) =>
            `• ${item.name}\\n  ${formatDuplicateItemLocation(item)}`
        )
        .join("\\n\\n");
'''

if old not in text:
    raise SystemExit("Could not find duplicate text block")

text = text.replace(old, new)

path.write_text(text)
print("Duplicate item alert now shows item locations")
