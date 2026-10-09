export const VEHICLE_SUBTYPES = [
  "ATV / UTV",
  "Boat",
  "Car",
  "Class A",
  "Class B",
  "Class C",
  "Fifth Wheel",
  "Motorcycle",
  "Other",
  "SUV",
  "Toy Hauler",
  "Trailer",
  "Truck",
  "Van",
] as const;

export const STORAGE_SUBTYPES = [
  "Backpack",
  "Bag",
  "Bin",
  "Cabinet",
  "Cargo Box",
  "Cooler",
  "Drawer",
  "Garage",
  "Luggage",
  "Overhead",
  "Other",
  "Roof Box",
  "Shed",
  "Shelf",
  "Storage Unit",
  "Toolbox",
  "Tote",
  "Trailer Storage",
  "Trunk",
  "Under Seat",
  "Warehouse",
] as const;

export const OFFICE_SUBTYPES = [
  "Home Office",
  "Corporate Office",
  "Desk",
  "Filing Cabinet",
  "Storage Closet",
  "Supply Room",
  "Warehouse Office",
  "Server Room / IT Closet",
  "Tool Room",
  "Classroom / Training Room",
  "Break Room",
  "Other",
] as const;

export type StorageCategory = "storage" | "office" | "vehicle";


export const STORAGE_CATEGORIES = [{ value: "storage", label: "Storage" }, { value: "office", label: "Office" }, { value: "vehicle", label: "Vehicle" }] as const;
export function isStorageCategory(value: unknown): value is StorageCategory {
  return STORAGE_CATEGORIES.some(option => option.value === value);
}
export function storageSubtypes(category: StorageCategory): readonly string[] {
  return category === "vehicle" ? VEHICLE_SUBTYPES : category === "office" ? OFFICE_SUBTYPES : STORAGE_SUBTYPES;
}
