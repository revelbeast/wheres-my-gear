import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "../firebaseConfig";

const DEMO_USER_ID = "demo-user-123";
const DEMO_VEHICLE_NAME = "My Sprinter Van";

export async function cleanupDuplicateDemoVehicles() {
  try {
    const vehiclesRef = collection(db, `users/${DEMO_USER_ID}/vehicles`);

    const existingVehicleQuery = query(
      vehiclesRef,
      where("userId", "==", DEMO_USER_ID),
      where("name", "==", DEMO_VEHICLE_NAME)
    );

    const snapshot = await getDocs(existingVehicleQuery);

    if (snapshot.docs.length <= 1) {
      console.log("No duplicate demo vehicles found.");
      return { cleaned: false, deletedCount: 0 };
    }

    const docsToDelete = snapshot.docs.slice(1);

    for (const vehicleDoc of docsToDelete) {
      await deleteDoc(doc(db, `users/${DEMO_USER_ID}/vehicles/${vehicleDoc.id}`));
    }

    console.log(`Deleted ${docsToDelete.length} duplicate demo vehicle(s).`);
    return { cleaned: true, deletedCount: docsToDelete.length };
  } catch (error) {
    console.error("Cleanup duplicate vehicles error:", error);
    return { cleaned: false, deletedCount: 0, error };
  }
}

export async function seedDemoData() {
  try {
    const vehiclesRef = collection(db, `users/${DEMO_USER_ID}/vehicles`);

    const existingVehicleQuery = query(
      vehiclesRef,
      where("userId", "==", DEMO_USER_ID),
      where("name", "==", DEMO_VEHICLE_NAME)
    );

    const snapshot = await getDocs(existingVehicleQuery);

    if (!snapshot.empty) {
      console.log("Demo data already exists. Skipping seed.");
      return { seeded: false };
    }

    const vehicleDoc = await addDoc(vehiclesRef, {
      userId: DEMO_USER_ID,
      name: DEMO_VEHICLE_NAME,
      make: "Mercedes-Benz",
      model: "Sprinter",
      year: 2023,
      plate: "VAN-001",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const vehicleId = vehicleDoc.id;

    const compartmentsRef = collection(
      db,
      `users/${DEMO_USER_ID}/vehicles/${vehicleId}/compartments`
    );

    const rearStorage = await addDoc(compartmentsRef, {
      userId: DEMO_USER_ID,
      vehicleId,
      name: "Rear Storage",
      type: "Storage",
      sortOrder: 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const kitchenDrawer = await addDoc(compartmentsRef, {
      userId: DEMO_USER_ID,
      vehicleId,
      name: "Kitchen Drawer",
      type: "Drawer",
      sortOrder: 2,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const roofBox = await addDoc(compartmentsRef, {
      userId: DEMO_USER_ID,
      vehicleId,
      name: "Roof Box",
      type: "Exterior",
      sortOrder: 3,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const addItem = async (
      compartmentId: string,
      compartmentName: string,
      item: any
    ) => {
      const itemsRef = collection(
        db,
        `users/${DEMO_USER_ID}/vehicles/${vehicleId}/compartments/${compartmentId}/items`
      );

      await addDoc(itemsRef, {
        userId: DEMO_USER_ID,
        vehicleId,
        vehicleName: DEMO_VEHICLE_NAME,
        compartmentId,
        compartmentName,
        name: item.name,
        nameLower: item.name.toLowerCase(),
        category: item.category,
        quantity: item.quantity ?? 1,
        packed: item.packed ?? true,
        missing: item.missing ?? false,
        notes: item.notes ?? "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    };

    await addItem(rearStorage.id, "Rear Storage", {
      name: "Flashlight",
      category: "Safety",
    });

    await addItem(rearStorage.id, "Rear Storage", {
      name: "First Aid Kit",
      category: "Safety",
      packed: false,
      missing: true,
    });

    await addItem(kitchenDrawer.id, "Kitchen Drawer", {
      name: "Camp Stove",
      category: "Cooking",
    });

    await addItem(kitchenDrawer.id, "Kitchen Drawer", {
      name: "Can Opener",
      category: "Cooking",
    });

    await addItem(roofBox.id, "Roof Box", {
      name: "Sleeping Bag",
      category: "Camping",
      quantity: 2,
    });

    console.log("Demo data seeded successfully");
    return { seeded: true };
  } catch (error) {
    console.error("Seed error:", error);
    return { seeded: false, error };
  }
}