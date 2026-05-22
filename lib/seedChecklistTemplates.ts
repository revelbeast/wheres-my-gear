import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import {
  checklistTemplateItemsCol as workspaceChecklistTemplateItemsCol,
  checklistTemplatesCol as workspaceChecklistTemplatesCol,
} from "./workspacePaths";

type SeedTemplate = {
  id: string;
  name: string;
  category: "trip" | "water" | "electronics" | "clothing" | "weapons";
  description: string;
  items: string[];
};

const defaultTemplates: SeedTemplate[] = [
  {
    id: "upcoming-trip",
    name: "Upcoming Trip Checklist",
    category: "trip",
    description: "General pre-trip essentials",
    items: [
      "Wallet",
      "Driver license",
      "Insurance card",
      "Phone",
      "Phone charger",
      "Medications",
      "Snacks",
      "Water bottles",
      "Trip documents",
    ],
  },
  {
    id: "weekend-trip",
    name: "Weekend Trip",
    category: "trip",
    description: "Weekend essentials",
    items: [
      "Toothbrush",
      "Toothpaste",
      "Shirt",
      "Pants",
      "Underwear",
      "Socks",
      "Jacket",
      "Phone charger",
      "Toiletry bag",
    ],
  },
  {
    id: "water-equipment",
    name: "Water Equipment Checklist",
    category: "water",
    description: "Water and utility gear",
    items: [
      "Fresh water hose",
      "Water pressure regulator",
      "Water filter",
      "Black tank hose",
      "Gloves",
      "Bucket",
      "Funnel",
    ],
  },
  {
    id: "cable-checklist",
    name: "Cable Checklist",
    category: "electronics",
    description: "Electronics and charging",
    items: [
      "USB-C cable",
      "Lightning cable",
      "Laptop charger",
      "Phone charger",
      "Battery bank",
      "Extension cord",
      "12V adapter",
    ],
  },
  {
    id: "clothing-3-day",
    name: "Clothing Checklist, 3 Day",
    category: "clothing",
    description: "3 day clothing pack",
    items: [
      "3 shirts",
      "3 underwear",
      "3 socks",
      "1 pants",
      "1 shorts",
      "Sleepwear",
      "Light jacket",
    ],
  },
  {
    id: "clothing-5-day",
    name: "Clothing Checklist, 5 Day",
    category: "clothing",
    description: "5 day clothing pack",
    items: [
      "5 shirts",
      "5 underwear",
      "5 socks",
      "2 pants",
      "2 shorts",
      "Sleepwear",
      "Jacket",
    ],
  },
  {
    id: "clothing-14-day",
    name: "Clothing Checklist, 14 Day",
    category: "clothing",
    description: "14 day clothing pack",
    items: [
      "14 shirts",
      "14 underwear",
      "14 socks",
      "4 pants",
      "4 shorts",
      "Sleepwear",
      "Jacket",
    ],
  },
  {
    id: "clothing-21-day",
    name: "Clothing Checklist, 21 Day",
    category: "clothing",
    description: "21 day clothing pack",
    items: [
      "21 shirts",
      "21 underwear",
      "21 socks",
      "5 pants",
      "5 shorts",
      "Sleepwear",
      "Jacket",
    ],
  },
  {
    id: "weapons-checklist",
    name: "Weapons Checklist",
    category: "weapons",
    description: "Weapons and range prep",
    items: [
      "Weapon",
      "Magazine(s)",
      "Ammunition",
      "Eye protection",
      "Ear protection",
      "Cleaning kit",
      "Range bag",
    ],
  },
];

export async function seedChecklistTemplates(userId: string) {
  const templatesRef = workspaceChecklistTemplatesCol(userId);

  for (const template of defaultTemplates) {
    const existing = await getDocs(
      query(templatesRef, where("name", "==", template.name))
    );

    if (!existing.empty) {
      continue;
    }

    const templateRef = await addDoc(templatesRef, {
      name: template.name,
      category: template.category,
      description: template.description,
      isDefault: true,
      itemCount: template.items.length,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const batch = writeBatch(db);

    template.items.forEach((itemName, index) => {
      const itemRef = doc(
        workspaceChecklistTemplateItemsCol(userId, templateRef.id),
        `${index + 1}`
      );

      batch.set(itemRef, {
        name: itemName,
        notes: "",
        quantity: 1,
        sortOrder: index + 1,
        createdAt: serverTimestamp(),
      });
    });

    await batch.commit();
  }
}