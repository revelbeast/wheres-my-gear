from pathlib import Path

path = Path("app/(tabs)/vehicles/[vehicleId]/compartments/[compartmentId].tsx")
text = path.read_text()

old = '''  async function refreshItems() {
    if (!isMountedRef.current) return;

    const loadVersion = loadVersionRef.current + 1;
    loadVersionRef.current = loadVersion;

    await loadItems(loadVersion);
  }

  function handleToggleCreateBox() {
'''

new = '''  async function refreshItems() {
    if (!isMountedRef.current) return;

    const loadVersion = loadVersionRef.current + 1;
    loadVersionRef.current = loadVersion;

    await loadItems(loadVersion);
  }

  function normalizeDuplicateItemName(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\\s]/g, "")
      .replace(/\\s+/g, " ");
  }

  function findPossibleDuplicateItems(newName: string) {
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

  async function createItemAfterDuplicateCheck(
    trimmedName: string,
    parsedQty: number
  ) {
    await runWithLock(async () => {
      try {
        if (!isMountedRef.current) return;

        setSaving(true);

        await createItem({
          name: trimmedName,
          quantity: parsedQty,
          status: "missing",
          compartmentId: String(compartmentId),
          compartmentName: compartment?.name ?? "",
          vehicleId: String(vehicleId),
          notes: "",
          itemPhotoUri: "",
        });

        if (!isMountedRef.current) return;

        setItemName("");
        setQuantity("1");
        setShowCreateBox(false);

        await refreshItems();
      } catch (err) {
        if (!isMountedRef.current) return;

        console.error("Failed to create item:", err);
        Alert.alert("Error", "Failed to create item.");
      } finally {
        if (isMountedRef.current) {
          setSaving(false);
        }
      }
    });
  }

  function handleToggleCreateBox() {
'''

if old not in text:
    raise SystemExit("Could not find refreshItems anchor")

text = text.replace(old, new)

old_function = '''  async function handleCreateItem() {
    if (!compartmentId || !vehicleId || saving || interactionLocked) return;

    const trimmedName = itemName.trim();
    const parsedQty = Math.max(1, Number(quantity) || 1);

    if (!trimmedName) return;

    await runWithLock(async () => {
      try {
        if (!isMountedRef.current) return;

        setSaving(true);

        await createItem({
          name: trimmedName,
          quantity: parsedQty,
          status: "missing",
          compartmentId: String(compartmentId),
          compartmentName: compartment?.name ?? "",
          vehicleId: String(vehicleId),
          notes: "",
          itemPhotoUri: "",
        });

        if (!isMountedRef.current) return;

        setItemName("");
        setQuantity("1");
        setShowCreateBox(false);

        await refreshItems();
      } catch (err) {
        if (!isMountedRef.current) return;

        console.error("Failed to create item:", err);
        Alert.alert("Error", "Failed to create item.");
      } finally {
        if (isMountedRef.current) {
          setSaving(false);
        }
      }
    });
  }
'''

new_function = '''  async function handleCreateItem() {
    if (!compartmentId || !vehicleId || saving || interactionLocked) return;

    const trimmedName = itemName.trim();
    const parsedQty = Math.max(1, Number(quantity) || 1);

    if (!trimmedName) return;

    const possibleDuplicates = findPossibleDuplicateItems(trimmedName);

    if (possibleDuplicates.length > 0) {
      const duplicateText = possibleDuplicates
        .map((item) => `• ${item.name}`)
        .join("\\n");

      Alert.alert(
        "Do you already own this item?",
        `Possible duplicate found in this compartment:\\n\\n${duplicateText}\\n\\nAdd it anyway?`,
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

      return;
    }

    await createItemAfterDuplicateCheck(trimmedName, parsedQty);
  }
'''

if old_function not in text:
    raise SystemExit("Could not find handleCreateItem function")

text = text.replace(old_function, new_function)

path.write_text(text)
print("Duplicate item detection added to compartment Add Item flow")
