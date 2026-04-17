import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import type {
  Checklist,
  ChecklistCategory,
  ChecklistItem,
  ChecklistTemplate,
  ChecklistTemplateItem,
} from "../types/checklists";

function templatesCol(userId: string) {
  return collection(db, "users", userId, "checklistTemplates");
}

function templateItemsCol(userId: string, templateId: string) {
  return collection(
    db,
    "users",
    userId,
    "checklistTemplates",
    templateId,
    "items"
  );
}

function checklistsCol(userId: string) {
  return collection(db, "users", userId, "checklists");
}

function checklistDoc(userId: string, checklistId: string) {
  return doc(db, "users", userId, "checklists", checklistId);
}

function checklistItemsCol(userId: string, checklistId: string) {
  return collection(db, "users", userId, "checklists", checklistId, "items");
}

export async function getChecklistTemplates(
  userId: string
): Promise<ChecklistTemplate[]> {
  const q = query(templatesCol(userId), orderBy("name"));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as ChecklistTemplate[];
}

export async function getChecklistTemplateItems(
  userId: string,
  templateId: string
): Promise<ChecklistTemplateItem[]> {
  const q = query(templateItemsCol(userId, templateId), orderBy("sortOrder"));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as ChecklistTemplateItem[];
}

export async function getChecklist(
  userId: string,
  checklistId: string
): Promise<Checklist | null> {
  const snapshot = await getDoc(checklistDoc(userId, checklistId));

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  } as Checklist;
}

export async function createChecklist(
  userId: string,
  data: {
    name: string;
    category: ChecklistCategory;
    templateId?: string | null;
    vehicleId?: string | null;
    tripId?: string | null;
  }
) {
  const checklistRef = await addDoc(checklistsCol(userId), {
    name: data.name,
    category: data.category,
    templateId: data.templateId ?? null,
    status: "active",
    packedCount: 0,
    totalCount: 0,
    missingCount: 0,
    vehicleId: data.vehicleId ?? null,
    tripId: data.tripId ?? null,
    isArchived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return checklistRef.id;
}

export async function createChecklistFromTemplate(
  userId: string,
  template: ChecklistTemplate
) {
  const templateItems = await getChecklistTemplateItems(userId, template.id);

  const checklistRef = await addDoc(checklistsCol(userId), {
    name: template.name,
    category: template.category,
    templateId: template.id,
    status: "active",
    packedCount: 0,
    totalCount: templateItems.length,
    missingCount: templateItems.length,
    vehicleId: null,
    tripId: null,
    isArchived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const batch = writeBatch(db);

  templateItems.forEach((item) => {
    const itemRef = doc(checklistItemsCol(userId, checklistRef.id));
    batch.set(itemRef, {
      name: item.name,
      notes: item.notes ?? "",
      quantity: item.quantity ?? 1,
      packed: false,
      packedAt: null,
      sortOrder: item.sortOrder ?? 0,
      sourceTemplateItemId: item.id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();

  return checklistRef.id;
}

export async function addChecklistItem(
  userId: string,
  checklistId: string,
  name: string
) {
  const itemsSnapshot = await getDocs(checklistItemsCol(userId, checklistId));
  const existingItems = itemsSnapshot.docs.map((d) => d.data()) as ChecklistItem[];

  const nextSortOrder =
    existingItems.length > 0
      ? Math.max(...existingItems.map((item) => item.sortOrder ?? 0)) + 1
      : 1;

  await addDoc(checklistItemsCol(userId, checklistId), {
    name: name.trim(),
    notes: "",
    quantity: 1,
    packed: false,
    packedAt: null,
    sortOrder: nextSortOrder,
    sourceTemplateItemId: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await recomputeChecklistCounts(userId, checklistId);
}

export function subscribeToChecklists(
  userId: string,
  callback: (items: Checklist[]) => void
) {
  const q = query(checklistsCol(userId), orderBy("createdAt", "desc"));

  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Checklist[];

    callback(data);
  });
}

export function subscribeToChecklistItems(
  userId: string,
  checklistId: string,
  callback: (items: ChecklistItem[]) => void
) {
  const q = query(checklistItemsCol(userId, checklistId), orderBy("sortOrder"));

  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as ChecklistItem[];

    callback(data);
  });
}

export async function toggleChecklistItemPacked(
  userId: string,
  checklistId: string,
  item: ChecklistItem
) {
  const itemRef = doc(
    db,
    "users",
    userId,
    "checklists",
    checklistId,
    "items",
    item.id
  );

  await updateDoc(itemRef, {
    packed: !item.packed,
    packedAt: !item.packed ? serverTimestamp() : null,
    updatedAt: serverTimestamp(),
  });

  await recomputeChecklistCounts(userId, checklistId);
}

export async function updateChecklistItemQuantity(
  userId: string,
  checklistId: string,
  itemId: string,
  quantity: number
) {
  const safeQuantity = Math.max(1, Number(quantity) || 1);

  const itemRef = doc(
    db,
    "users",
    userId,
    "checklists",
    checklistId,
    "items",
    itemId
  );

  await updateDoc(itemRef, {
    quantity: safeQuantity,
    updatedAt: serverTimestamp(),
  });
}

export async function updateChecklistItemName(
  userId: string,
  checklistId: string,
  itemId: string,
  name: string
) {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Item name is required.");
  }

  const itemRef = doc(
    db,
    "users",
    userId,
    "checklists",
    checklistId,
    "items",
    itemId
  );

  await updateDoc(itemRef, {
    name: trimmed,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteChecklistItem(
  userId: string,
  checklistId: string,
  itemId: string
) {
  const itemRef = doc(
    db,
    "users",
    userId,
    "checklists",
    checklistId,
    "items",
    itemId
  );

  await deleteDoc(itemRef);
  await recomputeChecklistCounts(userId, checklistId);
}

export async function recomputeChecklistCounts(
  userId: string,
  checklistId: string
) {
  const snapshot = await getDocs(checklistItemsCol(userId, checklistId));
  const items = snapshot.docs.map((d) => d.data()) as ChecklistItem[];

  const totalCount = items.length;
  const packedCount = items.filter((i) => i.packed).length;
  const missingCount = totalCount - packedCount;

  await updateDoc(checklistDoc(userId, checklistId), {
    totalCount,
    packedCount,
    missingCount,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteChecklist(userId: string, checklistId: string) {
  const itemsSnapshot = await getDocs(checklistItemsCol(userId, checklistId));
  const batch = writeBatch(db);

  itemsSnapshot.forEach((itemDoc) => {
    batch.delete(itemDoc.ref);
  });

  await batch.commit();
  await deleteDoc(checklistDoc(userId, checklistId));
}