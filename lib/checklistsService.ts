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

function requireUserId(userId: string) {
  const trimmedUserId = userId?.trim();

  if (!trimmedUserId) {
    throw new Error("User is not authenticated.");
  }

  return trimmedUserId;
}

function requireDocumentId(value: string, label: string) {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    throw new Error(`${label} is required.`);
  }

  return trimmedValue;
}

function createSafeUnsubscribe(
  unsubscribe: (() => void) | null,
  deactivate: () => void
) {
  let hasUnsubscribed = false;

  return () => {
    if (hasUnsubscribed) {
      return;
    }

    hasUnsubscribed = true;
    deactivate();

    if (unsubscribe) {
      unsubscribe();
    }
  };
}

function templatesCol(userId: string) {
  return collection(db, "users", requireUserId(userId), "checklistTemplates");
}

function templateDoc(userId: string, templateId: string) {
  return doc(
    db,
    "users",
    requireUserId(userId),
    "checklistTemplates",
    requireDocumentId(templateId, "Template ID")
  );
}

function templateItemsCol(userId: string, templateId: string) {
  return collection(
    db,
    "users",
    requireUserId(userId),
    "checklistTemplates",
    requireDocumentId(templateId, "Template ID"),
    "items"
  );
}

function templateItemDoc(userId: string, templateId: string, itemId: string) {
  return doc(
    db,
    "users",
    requireUserId(userId),
    "checklistTemplates",
    requireDocumentId(templateId, "Template ID"),
    "items",
    requireDocumentId(itemId, "Template item ID")
  );
}

function checklistsCol(userId: string) {
  return collection(db, "users", requireUserId(userId), "checklists");
}

function checklistDoc(userId: string, checklistId: string) {
  return doc(
    db,
    "users",
    requireUserId(userId),
    "checklists",
    requireDocumentId(checklistId, "Checklist ID")
  );
}

function checklistItemsCol(userId: string, checklistId: string) {
  return collection(
    db,
    "users",
    requireUserId(userId),
    "checklists",
    requireDocumentId(checklistId, "Checklist ID"),
    "items"
  );
}

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase();
}

function normalizeChecklist(id: string, data: Record<string, any>): Checklist {
  return {
    id,
    name: String(data.name ?? "Untitled Checklist"),
    category: (data.category ?? "trip") as ChecklistCategory,
    customCategoryLabel: data.customCategoryLabel ?? "",
    templateId: data.templateId ?? null,
    status: data.status ?? "active",
    packedCount: Number(data.packedCount ?? 0),
    totalCount: Number(data.totalCount ?? 0),
    missingCount: Number(data.missingCount ?? 0),
    vehicleId: data.vehicleId ?? null,
    tripId: data.tripId ?? null,
    notes: data.notes ?? "",
    isArchived: Boolean(data.isArchived ?? false),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  } as Checklist;
}

function normalizeChecklistItem(
  id: string,
  data: Record<string, any>
): ChecklistItem {
  return {
    id,
    name: String(data.name ?? "Untitled Item"),
    notes: data.notes ?? "",
    quantity: Math.max(1, Number(data.quantity ?? 1)),
    packed: Boolean(data.packed ?? false),
    packedAt: data.packedAt ?? null,
    sortOrder: Number(data.sortOrder ?? 0),
    sourceTemplateItemId: data.sourceTemplateItemId ?? null,
    itemPhotoUri: data.itemPhotoUri ?? "",
    compartmentId: data.compartmentId ?? "",
    compartmentName: data.compartmentName ?? "",
    vehicleId: data.vehicleId ?? "",
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  } as ChecklistItem;
}

function normalizeTemplateItem(
  id: string,
  data: Record<string, any>
): ChecklistTemplateItem {
  return {
    id,
    name: String(data.name ?? "Untitled Item"),
    notes: data.notes ?? "",
    quantity: Math.max(1, Number(data.quantity ?? 1)),
    packed: Boolean(data.packed ?? false),
    sortOrder: Number(data.sortOrder ?? 0),
    itemPhotoUri: data.itemPhotoUri ?? "",
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  } as ChecklistTemplateItem;
}

function getPackedCountFromTemplateItems(items: ChecklistTemplateItem[]) {
  return items.filter((item) => Boolean(item.packed ?? false)).length;
}

export type AssignedChecklistItemSummary = ChecklistItem & {
  checklistId: string;
  checklistName: string;
  vehicleId?: string;
  compartmentId?: string;
  compartmentName?: string;
};

export type ChecklistSearchResult = {
  id: string;
  name: string;
  packedCount?: number;
  totalCount?: number;
  missingCount?: number;
  isArchived?: boolean;
};

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

export async function getChecklistTemplate(
  userId: string,
  templateId: string
): Promise<ChecklistTemplate | null> {
  const snapshot = await getDoc(templateDoc(userId, templateId));

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  } as ChecklistTemplate;
}

export async function getChecklistTemplateItems(
  userId: string,
  templateId: string
): Promise<ChecklistTemplateItem[]> {
  const q = query(templateItemsCol(userId, templateId), orderBy("sortOrder"));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => normalizeTemplateItem(d.id, d.data()));
}

export async function createChecklistTemplateWithItems(
  userId: string,
  data: {
    name: string;
    category: ChecklistCategory;
    customCategoryLabel?: string | null;
    items: {
      name: string;
      notes?: string;
      quantity?: number;
      packed?: boolean;
      itemPhotoUri?: string;
    }[];
  }
) {
  const trimmedName = data.name.trim();

  if (!trimmedName) {
    throw new Error("Template name is required.");
  }

  const trimmedCustomCategoryLabel = data.customCategoryLabel?.trim() ?? "";

  if (data.category === "custom" && !trimmedCustomCategoryLabel) {
    throw new Error("Custom category is required.");
  }

  const safeItems = data.items
    .map((item) => ({
      name: String(item.name ?? "").trim(),
      notes: item.notes ?? "",
      quantity: Math.max(1, Number(item.quantity ?? 1) || 1),
      packed: Boolean(item.packed ?? false),
      itemPhotoUri: item.itemPhotoUri ?? "",
    }))
    .filter((item) => item.name.length > 0);

  if (safeItems.length === 0) {
    throw new Error("At least one template item is required.");
  }

  const templateRef = await addDoc(templatesCol(userId), {
    name: trimmedName,
    category: data.category,
    customCategoryLabel:
      data.category === "custom" ? trimmedCustomCategoryLabel : "",
    description: "",
    isDefault: false,
    itemCount: safeItems.length,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const batch = writeBatch(db);

  safeItems.forEach((item, index) => {
    const itemRef = doc(templateItemsCol(userId, templateRef.id));

    batch.set(itemRef, {
      name: item.name,
      notes: item.notes,
      quantity: item.quantity,
      packed: item.packed,
      sortOrder: index + 1,
      itemPhotoUri: item.itemPhotoUri,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  try {
    await batch.commit();
  } catch (err) {
    await deleteDoc(templateRef);
    throw err;
  }

  return templateRef.id;
}

export async function addChecklistTemplateItem(
  userId: string,
  templateId: string,
  name: string
) {
  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new Error("Template item name is required.");
  }

  const itemsSnapshot = await getDocs(templateItemsCol(userId, templateId));
  const existingItems = itemsSnapshot.docs.map((d) =>
    normalizeTemplateItem(d.id, d.data())
  );

  const nextSortOrder =
    existingItems.length > 0
      ? Math.max(...existingItems.map((item) => item.sortOrder ?? 0)) + 1
      : 1;

  await addDoc(templateItemsCol(userId, templateId), {
    name: trimmedName,
    notes: "",
    quantity: 1,
    packed: false,
    sortOrder: nextSortOrder,
    itemPhotoUri: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await recomputeChecklistTemplateItemCount(userId, templateId);
}

export async function updateChecklistTemplateItemName(
  userId: string,
  templateId: string,
  itemId: string,
  name: string
) {
  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new Error("Template item name is required.");
  }

  await updateDoc(templateItemDoc(userId, templateId, itemId), {
    name: trimmedName,
    updatedAt: serverTimestamp(),
  });
}

export async function updateChecklistTemplateItemQuantity(
  userId: string,
  templateId: string,
  itemId: string,
  quantity: number
) {
  const safeQuantity = Math.max(1, Number(quantity) || 1);

  await updateDoc(templateItemDoc(userId, templateId, itemId), {
    quantity: safeQuantity,
    updatedAt: serverTimestamp(),
  });
}

export async function updateChecklistTemplateItemPacked(
  userId: string,
  templateId: string,
  itemId: string,
  packed: boolean
) {
  await updateDoc(templateItemDoc(userId, templateId, itemId), {
    packed: Boolean(packed),
    updatedAt: serverTimestamp(),
  });
}

export async function updateChecklistTemplateItemPhoto(
  userId: string,
  templateId: string,
  itemId: string,
  itemPhotoUri: string
) {
  await updateDoc(templateItemDoc(userId, templateId, itemId), {
    itemPhotoUri: itemPhotoUri ?? "",
    updatedAt: serverTimestamp(),
  });
}

export async function deleteChecklistTemplateItem(
  userId: string,
  templateId: string,
  itemId: string
) {
  await deleteDoc(templateItemDoc(userId, templateId, itemId));
  await recomputeChecklistTemplateItemCount(userId, templateId);
}

export async function recomputeChecklistTemplateItemCount(
  userId: string,
  templateId: string
) {
  const snapshot = await getDocs(templateItemsCol(userId, templateId));

  await updateDoc(templateDoc(userId, templateId), {
    itemCount: snapshot.docs.length,
    updatedAt: serverTimestamp(),
  });
}

export async function getChecklist(
  userId: string,
  checklistId: string
): Promise<Checklist | null> {
  const snapshot = await getDoc(checklistDoc(userId, checklistId));

  if (!snapshot.exists()) {
    return null;
  }

  return normalizeChecklist(snapshot.id, snapshot.data());
}

export async function createChecklist(
  userId: string,
  data: {
    name: string;
    category: ChecklistCategory;
    customCategoryLabel?: string | null;
    templateId?: string | null;
    vehicleId?: string | null;
    tripId?: string | null;
  }
) {
  const trimmedName = data.name.trim();

  if (!trimmedName) {
    throw new Error("Checklist name is required.");
  }

  const checklistRef = await addDoc(checklistsCol(userId), {
    name: trimmedName,
    category: data.category,
    customCategoryLabel: data.customCategoryLabel ?? "",
    templateId: data.templateId ?? null,
    status: "active",
    packedCount: 0,
    totalCount: 0,
    missingCount: 0,
    vehicleId: data.vehicleId ?? null,
    tripId: data.tripId ?? null,
    notes: "",
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
  const packedCount = getPackedCountFromTemplateItems(templateItems);
  const totalCount = templateItems.length;
  const missingCount = totalCount - packedCount;

  const checklistRef = await addDoc(checklistsCol(userId), {
    name: template.name,
    category: template.category,
    customCategoryLabel: template.customCategoryLabel ?? "",
    templateId: template.id,
    status: "active",
    packedCount,
    totalCount,
    missingCount,
    vehicleId: null,
    tripId: null,
    notes: "",
    isArchived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const batch = writeBatch(db);

  templateItems.forEach((item) => {
    const isPacked = Boolean(item.packed ?? false);
    const itemRef = doc(checklistItemsCol(userId, checklistRef.id));

    batch.set(itemRef, {
      name: item.name,
      notes: item.notes ?? "",
      quantity: item.quantity ?? 1,
      packed: isPacked,
      packedAt: isPacked ? serverTimestamp() : null,
      sortOrder: item.sortOrder ?? 0,
      sourceTemplateItemId: item.id,
      itemPhotoUri: item.itemPhotoUri ?? "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  try {
    await batch.commit();
  } catch (err) {
    await deleteDoc(checklistRef);
    throw err;
  }

  return checklistRef.id;
}

export async function createChecklistFromSelectedTemplateItems(
  userId: string,
  template: ChecklistTemplate,
  selectedItems: ChecklistTemplateItem[]
) {
  if (!template?.id) {
    throw new Error("Template is required.");
  }

  const safeSelectedItems = selectedItems.filter((item) => {
    return String(item?.name ?? "").trim().length > 0;
  });

  const packedCount = getPackedCountFromTemplateItems(safeSelectedItems);
  const totalCount = safeSelectedItems.length;
  const missingCount = totalCount - packedCount;

  const checklistRef = await addDoc(checklistsCol(userId), {
    name: template.name,
    category: template.category,
    customCategoryLabel: template.customCategoryLabel ?? "",
    templateId: template.id,
    status: "active",
    packedCount,
    totalCount,
    missingCount,
    vehicleId: null,
    tripId: null,
    notes: "",
    isArchived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (safeSelectedItems.length === 0) {
    return checklistRef.id;
  }

  const batch = writeBatch(db);

  safeSelectedItems.forEach((item, index) => {
    const isPacked = Boolean(item.packed ?? false);
    const itemRef = doc(checklistItemsCol(userId, checklistRef.id));

    batch.set(itemRef, {
      name: String(item.name ?? "").trim(),
      notes: item.notes ?? "",
      quantity: Math.max(1, Number(item.quantity ?? 1)),
      packed: isPacked,
      packedAt: isPacked ? serverTimestamp() : null,
      sortOrder: index + 1,
      sourceTemplateItemId: item.id ?? null,
      itemPhotoUri: item.itemPhotoUri ?? "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  try {
    await batch.commit();
  } catch (err) {
    await deleteDoc(checklistRef);
    throw err;
  }

  return checklistRef.id;
}

export async function addChecklistItem(
  userId: string,
  checklistId: string,
  name: string
) {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("Item name is required.");
  }

  const itemsSnapshot = await getDocs(checklistItemsCol(userId, checklistId));
  const existingItems = itemsSnapshot.docs.map((d) =>
    normalizeChecklistItem(d.id, d.data())
  );

  const nextSortOrder =
    existingItems.length > 0
      ? Math.max(...existingItems.map((item) => item.sortOrder ?? 0)) + 1
      : 1;

  await addDoc(checklistItemsCol(userId, checklistId), {
    name: trimmedName,
    notes: "",
    quantity: 1,
    packed: false,
    packedAt: null,
    sortOrder: nextSortOrder,
    sourceTemplateItemId: null,
    itemPhotoUri: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await recomputeChecklistCounts(userId, checklistId);
}

export function subscribeToChecklists(
  userId: string,
  callback: (items: Checklist[]) => void
) {
  let isActive = true;
  let unsubscribe: (() => void) | null = null;

  try {
    const safeUserId = requireUserId(userId);
    const q = query(checklistsCol(safeUserId), orderBy("createdAt", "desc"));

    unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!isActive) {
          return;
        }

        const data = snapshot.docs.map((d) =>
          normalizeChecklist(d.id, d.data())
        );

        callback(data);
      },
      (error) => {
        if (!isActive) {
          return;
        }

        console.error("Failed to subscribe to checklists:", error);
        callback([]);
      }
    );

    return createSafeUnsubscribe(unsubscribe, () => {
      isActive = false;
    });
  } catch (error) {
    console.error("Failed to start checklist subscription:", error);

    if (isActive) {
      callback([]);
    }

    return createSafeUnsubscribe(unsubscribe, () => {
      isActive = false;
    });
  }
}

export function subscribeToChecklistItems(
  userId: string,
  checklistId: string,
  callback: (items: ChecklistItem[]) => void
) {
  let isActive = true;
  let unsubscribe: (() => void) | null = null;

  try {
    const safeUserId = requireUserId(userId);
    const safeChecklistId = requireDocumentId(checklistId, "Checklist ID");

    const q = query(
      checklistItemsCol(safeUserId, safeChecklistId),
      orderBy("sortOrder")
    );

    unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!isActive) {
          return;
        }

        const data = snapshot.docs.map((d) =>
          normalizeChecklistItem(d.id, d.data())
        );

        callback(data);
      },
      (error) => {
        if (!isActive) {
          return;
        }

        console.error("Failed to subscribe to checklist items:", error);
        callback([]);
      }
    );

    return createSafeUnsubscribe(unsubscribe, () => {
      isActive = false;
    });
  } catch (error) {
    console.error("Failed to start checklist item subscription:", error);

    if (isActive) {
      callback([]);
    }

    return createSafeUnsubscribe(unsubscribe, () => {
      isActive = false;
    });
  }
}

export async function toggleChecklistItemPacked(
  userId: string,
  checklistId: string,
  item: ChecklistItem
) {
  const itemRef = doc(
    db,
    "users",
    requireUserId(userId),
    "checklists",
    requireDocumentId(checklistId, "Checklist ID"),
    "items",
    requireDocumentId(item.id, "Checklist item ID")
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
    requireUserId(userId),
    "checklists",
    requireDocumentId(checklistId, "Checklist ID"),
    "items",
    requireDocumentId(itemId, "Checklist item ID")
  );

  await updateDoc(itemRef, {
    quantity: safeQuantity,
    updatedAt: serverTimestamp(),
  });

  await recomputeChecklistCounts(userId, checklistId);
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
    requireUserId(userId),
    "checklists",
    requireDocumentId(checklistId, "Checklist ID"),
    "items",
    requireDocumentId(itemId, "Checklist item ID")
  );

  await updateDoc(itemRef, {
    name: trimmed,
    updatedAt: serverTimestamp(),
  });
}

export async function updateChecklistItemPhoto(
  userId: string,
  checklistId: string,
  itemId: string,
  itemPhotoUri: string
) {
  const itemRef = doc(
    db,
    "users",
    requireUserId(userId),
    "checklists",
    requireDocumentId(checklistId, "Checklist ID"),
    "items",
    requireDocumentId(itemId, "Checklist item ID")
  );

  await updateDoc(itemRef, {
    itemPhotoUri: itemPhotoUri ?? "",
    updatedAt: serverTimestamp(),
  });
}

export async function updateChecklistItemCompartment(
  userId: string,
  checklistId: string,
  itemId: string,
  compartmentId: string,
  compartmentName: string,
  vehicleId?: string
) {
  const itemRef = doc(
    db,
    "users",
    requireUserId(userId),
    "checklists",
    requireDocumentId(checklistId, "Checklist ID"),
    "items",
    requireDocumentId(itemId, "Checklist item ID")
  );

  await updateDoc(itemRef, {
    compartmentId,
    compartmentName,
    vehicleId: vehicleId ?? "",
    updatedAt: serverTimestamp(),
  });
}

export async function updateChecklistName(
  userId: string,
  checklistId: string,
  name: string
) {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Checklist name is required.");
  }

  await updateDoc(checklistDoc(userId, checklistId), {
    name: trimmed,
    updatedAt: serverTimestamp(),
  });
}

export async function archiveChecklist(userId: string, checklistId: string) {
  await updateDoc(checklistDoc(userId, checklistId), {
    isArchived: true,
    updatedAt: serverTimestamp(),
  });
}

export async function updateChecklistNotes(
  userId: string,
  checklistId: string,
  notes: string
) {
  await updateDoc(checklistDoc(userId, checklistId), {
    notes: notes ?? "",
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
    requireUserId(userId),
    "checklists",
    requireDocumentId(checklistId, "Checklist ID"),
    "items",
    requireDocumentId(itemId, "Checklist item ID")
  );

  await deleteDoc(itemRef);
  await recomputeChecklistCounts(userId, checklistId);
}

export async function recomputeChecklistCounts(
  userId: string,
  checklistId: string
) {
  const snapshot = await getDocs(checklistItemsCol(userId, checklistId));
  const items = snapshot.docs.map((d) => normalizeChecklistItem(d.id, d.data()));

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
  const safeChecklistId = requireDocumentId(checklistId, "Checklist ID");
  const itemsSnapshot = await getDocs(checklistItemsCol(userId, safeChecklistId));
  const batch = writeBatch(db);

  itemsSnapshot.forEach((itemDoc) => {
    batch.delete(itemDoc.ref);
  });

  batch.delete(checklistDoc(userId, safeChecklistId));

  await batch.commit();
}

export async function getAssignedChecklistItems(
  userId: string,
  options?: {
    vehicleId?: string;
    packed?: boolean;
  }
): Promise<AssignedChecklistItemSummary[]> {
  const checklistSnapshot = await getDocs(checklistsCol(userId));
  const checklistDocs = checklistSnapshot.docs.map((d) =>
    normalizeChecklist(d.id, d.data())
  );

  const compartmentSnapshot = await getDocs(
    collection(db, "users", requireUserId(userId), "compartments")
  );

  const compartmentVehicleMap = new Map<string, string>();
  compartmentSnapshot.docs.forEach((docSnap) => {
    const data = docSnap.data() as { vehicleId?: string };
    compartmentVehicleMap.set(docSnap.id, data.vehicleId ?? "");
  });

  const results: AssignedChecklistItemSummary[] = [];

  for (const checklist of checklistDocs) {
    if (checklist.isArchived) continue;

    const itemsSnapshot = await getDocs(checklistItemsCol(userId, checklist.id));
    const checklistItems = itemsSnapshot.docs.map((d) =>
      normalizeChecklistItem(d.id, d.data())
    );

    for (const item of checklistItems) {
      const compartmentId =
        (item as ChecklistItem & { compartmentId?: string }).compartmentId ?? "";
      const compartmentName =
        (item as ChecklistItem & { compartmentName?: string }).compartmentName ??
        "";
      const storedVehicleId =
        (item as ChecklistItem & { vehicleId?: string }).vehicleId ?? "";
      const resolvedVehicleId =
        storedVehicleId || compartmentVehicleMap.get(compartmentId) || "";

      if (options?.vehicleId && resolvedVehicleId !== options.vehicleId) {
        continue;
      }

      if (
        typeof options?.packed === "boolean" &&
        !!item.packed !== options.packed
      ) {
        continue;
      }

      results.push({
        ...item,
        checklistId: checklist.id,
        checklistName: checklist.name,
        compartmentId,
        compartmentName,
        vehicleId: resolvedVehicleId,
      });
    }
  }

  return results;
}

export async function searchChecklistsForUser(
  userId: string,
  searchTerm: string
): Promise<ChecklistSearchResult[]> {
  const term = normalizeSearchValue(searchTerm);
  if (!term) {
    return [];
  }

  const snapshot = await getDocs(checklistsCol(userId));
  const checklists = snapshot.docs.map((d) =>
    normalizeChecklist(d.id, d.data())
  );

  return checklists
    .filter(
      (checklist) =>
        !checklist.isArchived &&
        normalizeSearchValue(checklist.name ?? "").includes(term)
    )
    .map((checklist) => ({
      id: checklist.id,
      name: checklist.name,
      packedCount: checklist.packedCount ?? 0,
      totalCount: checklist.totalCount ?? 0,
      missingCount: checklist.missingCount ?? 0,
      isArchived: checklist.isArchived ?? false,
    }));
}

export async function saveChecklistAsTemplate(
  userId: string,
  checklistId: string
) {
  const checklist = await getChecklist(userId, checklistId);
  if (!checklist) {
    throw new Error("Checklist not found");
  }

  const itemsSnapshot = await getDocs(checklistItemsCol(userId, checklistId));

  const templateRef = await addDoc(templatesCol(userId), {
    name: checklist.name,
    category: checklist.category ?? "trip",
    customCategoryLabel: checklist.customCategoryLabel ?? "",
    description: "",
    isDefault: false,
    itemCount: itemsSnapshot.docs.length,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const batch = writeBatch(db);

  itemsSnapshot.docs.forEach((docSnap, index) => {
    const item = normalizeChecklistItem(docSnap.id, docSnap.data());
    const itemRef = doc(templateItemsCol(userId, templateRef.id));

    batch.set(itemRef, {
      name: item.name,
      quantity: item.quantity ?? 1,
      packed: Boolean(item.packed ?? false),
      notes: item.notes ?? "",
      sortOrder: item.sortOrder ?? index,
      itemPhotoUri: item.itemPhotoUri ?? "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  try {
    await batch.commit();
  } catch (err) {
    await deleteDoc(templateRef);
    throw err;
  }

  return templateRef.id;
}

export async function archiveChecklistTemplate(
  userId: string,
  templateId: string
) {
  const safeTemplateId = requireDocumentId(templateId, "Template ID");

  await updateDoc(templateDoc(userId, safeTemplateId), {
    isArchived: true,
    updatedAt: serverTimestamp(),
  });
}

export async function restoreChecklistTemplate(
  userId: string,
  templateId: string
) {
  const safeTemplateId = requireDocumentId(templateId, "Template ID");

  await updateDoc(templateDoc(userId, safeTemplateId), {
    isArchived: false,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteChecklistTemplate(
  userId: string,
  templateId: string
) {
  const safeTemplateId = requireDocumentId(templateId, "Template ID");
  const itemsSnapshot = await getDocs(templateItemsCol(userId, safeTemplateId));
  const batch = writeBatch(db);

  itemsSnapshot.forEach((itemDoc) => {
    batch.delete(itemDoc.ref);
  });

  batch.delete(templateDoc(userId, safeTemplateId));

  await batch.commit();
}

export async function updateChecklistTemplateName(
  userId: string,
  templateId: string,
  name: string
) {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Template name is required.");
  }

  await updateDoc(templateDoc(userId, templateId), {
    name: trimmed,
    updatedAt: serverTimestamp(),
  });
}