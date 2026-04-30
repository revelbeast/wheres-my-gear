import { addDoc, collection, doc, getDocs, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "../firebaseConfig";

function templatesCol(userId: string) {
  return collection(db, "users", userId, "checklistTemplates");
}

function templateItemsCol(userId: string, templateId: string) {
  return collection(db, "users", userId, "checklistTemplates", templateId, "items");
}

export async function seedChecklistTemplates(userId: string) {
  // Check if templates already exist (prevents duplicates)
  const existing = await getDocs(templatesCol(userId));
  if (!existing.empty) {
    return;
  }

  const templates = [
    {
      name: "Weekend Trip",
      category: "trip",
      items: [
        "Clothes",
        "Toiletries",
        "Phone Charger",
        "Snacks",
        "Water",
      ],
    },
    {
      name: "Camping Gear",
      category: "camping",
      items: [
        "Tent",
        "Sleeping Bag",
        "Camping Stove",
        "Lantern",
        "Cooler",
      ],
    },
    {
      name: "Fishing Gear",
      category: "fishing",
      items: [
        "Fishing Rod",
        "Tackle Box",
        "Bait",
        "Cooler",
        "Knife",
      ],
    },
    {
      name: "Clothing (5 Day Trip)",
      category: "clothing",
      items: [
        "Shirts",
        "Pants",
        "Socks",
        "Underwear",
        "Jacket",
      ],
    },
  ];

  for (const template of templates) {
    const templateRef = await addDoc(templatesCol(userId), {
      name: template.name,
      category: template.category,
      customCategoryLabel: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const batch = writeBatch(db);

    template.items.forEach((itemName, index) => {
      const itemRef = doc(templateItemsCol(userId, templateRef.id));

      batch.set(itemRef, {
        name: itemName,
        quantity: 1,
        notes: "",
        sortOrder: index,
        itemPhotoUri: "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    await batch.commit();
  }
}