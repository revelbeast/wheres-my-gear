import {
  addDoc,
  collection,
  doc,
  getDocs,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";

import { db } from "../firebaseConfig";
import {
  checklistTemplateItemsCol as workspaceChecklistTemplateItemsCol,
  checklistTemplatesCol as workspaceChecklistTemplatesCol,
} from "./workspacePaths";

function templatesCol(userId: string) {
  return workspaceChecklistTemplatesCol(userId);
}

function templateItemsCol(userId: string, templateId: string) {
  return workspaceChecklistTemplateItemsCol(userId, templateId);
}

const DEFAULT_TEMPLATES = [
  {
    name: "Trip Essentials",
    category: "trip",
    items: [
      { name: "Driver’s license", quantity: 1 },
      { name: "Wallet", quantity: 1 },
      { name: "Phone charger", quantity: 1 },
      { name: "Sunglasses", quantity: 1 },
      { name: "Water bottle", quantity: 1 },
      { name: "First aid kit", quantity: 1 },
      { name: "Flashlight", quantity: 1 },
      { name: "Snacks", quantity: 1 },
      { name: "Jacket", quantity: 1 },
      { name: "Toiletries", quantity: 1 },
    ],
  },
  {
    name: "Camping Gear",
    category: "camping",
    items: [
      { name: "Tent", quantity: 1 },
      { name: "Sleeping bag", quantity: 1 },
      { name: "Sleeping pad", quantity: 1 },
      { name: "Camp stove", quantity: 1 },
      { name: "Fuel", quantity: 1 },
      { name: "Cookware", quantity: 1 },
      { name: "Headlamp", quantity: 1 },
      { name: "Camp chair", quantity: 1 },
      { name: "Fire starter", quantity: 1 },
      { name: "Cooler", quantity: 1 },
    ],
  },
  {
    name: "Hunting Gear",
    category: "hunting",
    items: [
      { name: "Hunting license", quantity: 1 },
      { name: "Tags", quantity: 1 },
      { name: "Binoculars", quantity: 1 },
      { name: "Rangefinder", quantity: 1 },
      { name: "Knife", quantity: 1 },
      { name: "Game bags", quantity: 1 },
      { name: "Headlamp", quantity: 1 },
      { name: "Gloves", quantity: 1 },
      { name: "Weather layers", quantity: 1 },
      { name: "First aid kit", quantity: 1 },
    ],
  },
  {
    name: "Fishing Gear",
    category: "fishing",
    items: [
      { name: "Fishing license", quantity: 1 },
      { name: "Rod", quantity: 1 },
      { name: "Reel", quantity: 1 },
      { name: "Tackle box", quantity: 1 },
      { name: "Bait", quantity: 1 },
      { name: "Pliers", quantity: 1 },
      { name: "Net", quantity: 1 },
      { name: "Cooler", quantity: 1 },
      { name: "Sunscreen", quantity: 1 },
      { name: "Rain jacket", quantity: 1 },
    ],
  },
  {
    name: "Boating Gear",
    category: "boating",
    items: [
      { name: "Life jackets", quantity: 1 },
      { name: "Boat registration", quantity: 1 },
      { name: "Whistle", quantity: 1 },
      { name: "Throwable flotation device", quantity: 1 },
      { name: "Anchor", quantity: 1 },
      { name: "Dock lines", quantity: 1 },
      { name: "Dry bag", quantity: 1 },
      { name: "Sunscreen", quantity: 1 },
      { name: "Towels", quantity: 2 },
      { name: "First aid kit", quantity: 1 },
    ],
  },
  {
    name: "Clothing - 3 Day Trip",
    category: "clothing",
    items: [
      { name: "Shirts", quantity: 3 },
      { name: "Pants/Shorts", quantity: 2 },
      { name: "Underwear", quantity: 3 },
      { name: "Socks", quantity: 3 },
      { name: "Sleepwear", quantity: 1 },
      { name: "Light jacket", quantity: 1 },
      { name: "Rain jacket", quantity: 1 },
      { name: "Shoes", quantity: 1 },
      { name: "Hat", quantity: 1 },
      { name: "Belt", quantity: 1 },
    ],
  },
  {
    name: "Clothing - 7 Day Trip",
    category: "clothing",
    items: [
      { name: "Shirts", quantity: 7 },
      { name: "Pants/Shorts", quantity: 4 },
      { name: "Underwear", quantity: 7 },
      { name: "Socks", quantity: 7 },
      { name: "Sleepwear", quantity: 2 },
      { name: "Light jacket", quantity: 1 },
      { name: "Rain jacket", quantity: 1 },
      { name: "Shoes", quantity: 2 },
      { name: "Hat", quantity: 1 },
      { name: "Belt", quantity: 1 },
    ],
  },
  {
    name: "Electronics",
    category: "electronics",
    items: [
      { name: "Phone charger", quantity: 1 },
      { name: "Power bank", quantity: 1 },
      { name: "Camera", quantity: 1 },
      { name: "Camera batteries", quantity: 2 },
      { name: "Memory cards", quantity: 2 },
      { name: "Headphones", quantity: 1 },
      { name: "Tablet", quantity: 1 },
      { name: "Laptop", quantity: 1 },
      { name: "Charging cables", quantity: 2 },
      { name: "Adapter", quantity: 1 },
    ],
  },
  {
    name: "Medical",
    category: "medical",
    items: [
      { name: "First aid kit", quantity: 1 },
      { name: "Prescription medication", quantity: 1 },
      { name: "Pain reliever", quantity: 1 },
      { name: "Allergy medication", quantity: 1 },
      { name: "Bandages", quantity: 1 },
      { name: "Antiseptic wipes", quantity: 1 },
      { name: "Tweezers", quantity: 1 },
      { name: "Medical tape", quantity: 1 },
      { name: "Sunscreen", quantity: 1 },
      { name: "Insect repellent", quantity: 1 },
    ],
  },
  {
    name: "Tools",
    category: "tools",
    items: [
      { name: "Multi-tool", quantity: 1 },
      { name: "Screwdriver", quantity: 1 },
      { name: "Wrench", quantity: 1 },
      { name: "Pliers", quantity: 1 },
      { name: "Duct tape", quantity: 1 },
      { name: "Zip ties", quantity: 1 },
      { name: "Work gloves", quantity: 1 },
      { name: "Flashlight", quantity: 1 },
      { name: "Batteries", quantity: 1 },
      { name: "Tire pressure gauge", quantity: 1 },
    ],
  },
  {
    name: "Food",
    category: "food",
    items: [
      { name: "Water", quantity: 1 },
      { name: "Snacks", quantity: 1 },
      { name: "Breakfast items", quantity: 1 },
      { name: "Lunch items", quantity: 1 },
      { name: "Dinner items", quantity: 1 },
      { name: "Coffee", quantity: 1 },
      { name: "Cooking oil", quantity: 1 },
      { name: "Seasoning", quantity: 1 },
      { name: "Utensils", quantity: 1 },
      { name: "Trash bags", quantity: 1 },
    ],
  },
];

export async function seedChecklistTemplates(userId: string) {
  const existing = await getDocs(templatesCol(userId));

  if (!existing.empty) {
    return;
  }

  for (const template of DEFAULT_TEMPLATES) {
    const templateRef = await addDoc(templatesCol(userId), {
      name: template.name,
      category: template.category,
      customCategoryLabel: "",
      description: "",
      isDefault: true,
      itemCount: template.items.length,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const batch = writeBatch(db);

    template.items.forEach((item, index) => {
      const itemRef = doc(templateItemsCol(userId, templateRef.id));

      batch.set(itemRef, {
        name: item.name,
        quantity: item.quantity,
        notes: "",
        sortOrder: index + 1,
        itemPhotoUri: "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    await batch.commit();
  }
}