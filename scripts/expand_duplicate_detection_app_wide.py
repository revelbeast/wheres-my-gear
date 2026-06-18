from pathlib import Path

path = Path("app/(tabs)/vehicles/[vehicleId]/compartments/[compartmentId].tsx")
text = path.read_text()

text = text.replace(
    "  getAllCompartments,\n",
    "  getAllCompartments,\n  getAllItems,\n",
)

old = '''  function findPossibleDuplicateItems(newName: string) {
    const normalizedNewName = normalizeDuplicateItemName(newName);

    if (!normalizedNewName) return [];

    return items
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

new = '''  async function findPossibleDuplicateItems(newName: string) {
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

old = '''    const possibleDuplicates = findPossibleDuplicateItems(trimmedName);

    if (possibleDuplicates.length > 0) {
'''

new = '''    let possibleDuplicates: Item[] = [];

    try {
      possibleDuplicates = await findPossibleDuplicateItems(trimmedName);
    } catch (err) {
      console.warn("Failed to check duplicate items:", err);
      possibleDuplicates = [];
    }

    if (possibleDuplicates.length > 0) {
'''

if old not in text:
    raise SystemExit("Could not find duplicate check call")

text = text.replace(old, new)

text = text.replace(
    "Possible duplicate found in this compartment:",
    "Possible duplicate found in your inventory:"
)

path.write_text(text)
print("Duplicate item detection now checks all inventory items")
