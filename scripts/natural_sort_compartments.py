from pathlib import Path

path = Path("lib/gearService.ts")
text = path.read_text()

anchor = '''function inventoryDoc(itemId: string) {
  return doc(db, "users", getCurrentUserId(), "inventoryItems", itemId);
}
'''

insert = '''function inventoryDoc(itemId: string) {
  return doc(db, "users", getCurrentUserId(), "inventoryItems", itemId);
}

function compareNaturalNames(a: string, b: string) {
  return a.localeCompare(b, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function sortCompartmentsByName(compartments: Compartment[]) {
  return [...compartments].sort((a, b) =>
    compareNaturalNames(a.name ?? "", b.name ?? "")
  );
}
'''

if anchor not in text:
    raise SystemExit("Could not find inventoryDoc anchor")

text = text.replace(anchor, insert)

text = text.replace(
    '''  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as Compartment[];
''',
    '''  const compartments = snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as Compartment[];

  return sortCompartmentsByName(compartments);
''',
    1
)

text = text.replace(
    '''  return [...offlineCompartments, ...remoteCompartments];
}
''',
    '''  return sortCompartmentsByName([...offlineCompartments, ...remoteCompartments]);
}
''',
)

path.write_text(text)

room_path = Path("app/(tabs)/vehicles/[vehicleId]/rooms/[roomId].tsx")
room_text = room_path.read_text()

room_text = room_text.replace(
    '''        allCompartments
          .filter((compartment) => compartment.roomId === String(roomId))
          .sort((a, b) => a.name.localeCompare(b.name))
''',
    '''        allCompartments.filter(
          (compartment) => compartment.roomId === String(roomId)
        )
'''
)

room_path.write_text(room_text)

print("Added natural compartment sorting")
