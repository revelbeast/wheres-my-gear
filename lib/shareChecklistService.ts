import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import {
  createChecklistTemplateWithItems,
  getChecklistTemplate,
  getChecklistTemplateItems,
} from "./checklistsService";
import type {
  ChecklistCategory,
  ChecklistTemplate,
  ChecklistTemplateItem,
} from "../types/checklists";

export type SharedChecklistTemplateFile = {
  app: "wheres-my-gear";
  feature: "share-checklist-template";
  version: 1;
  exportedAt: string;
  template: SharedChecklistTemplate;
  items: SharedChecklistTemplateItem[];
};

type SharedChecklistTemplate = Pick<
  ChecklistTemplate,
  "name" | "category" | "description" | "customCategoryLabel" | "itemCount"
> & {
  sourceId: string;
};

type SharedChecklistTemplateItem = Pick<
  ChecklistTemplateItem,
  "name" | "notes" | "quantity" | "packed" | "sortOrder" | "itemPhotoUri"
> & {
  sourceId: string;
};

export type ChecklistTemplateImportPreview = {
  templateName: string;
  itemCount: number;
  exportedAt: string;
};

export type ChecklistTemplateImportSummary = {
  templateId: string;
  templateName: string;
  itemsImported: number;
};

function safeFileName(value: string) {
  const cleaned = value
    .trim()
    .replace(/[^a-zA-Z0-9-_ ]+/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80);

  return cleaned || "checklist-template";
}

function withImportedName(name: string) {
  const trimmed = name.trim();

  if (!trimmed) {
    return "Imported Template";
  }

  return `${trimmed} (Imported)`;
}

function stripTemplate(template: ChecklistTemplate): SharedChecklistTemplate {
  return {
    sourceId: template.id,
    name: template.name,
    category: template.category,
    description: template.description ?? "",
    customCategoryLabel: template.customCategoryLabel ?? "",
    itemCount: template.itemCount ?? 0,
  };
}

function stripTemplateItem(
  item: ChecklistTemplateItem
): SharedChecklistTemplateItem {
  return {
    sourceId: item.id,
    name: item.name,
    notes: item.notes ?? "",
    quantity: item.quantity,
    packed: Boolean(item.packed ?? false),
    sortOrder: item.sortOrder,
    itemPhotoUri: item.itemPhotoUri ?? "",
  };
}

function validateTemplateShareFile(value: unknown): SharedChecklistTemplateFile {
  const file = value as Partial<SharedChecklistTemplateFile>;

  if (
    !file ||
    file.app !== "wheres-my-gear" ||
    file.feature !== "share-checklist-template" ||
    file.version !== 1 ||
    !file.template ||
    !Array.isArray(file.items)
  ) {
    throw new Error("This is not a valid Where's My Gear checklist template file.");
  }

  return file as SharedChecklistTemplateFile;
}

export async function buildChecklistTemplateShareFile(
  userId: string,
  templateId: string
): Promise<SharedChecklistTemplateFile> {
  const template = await getChecklistTemplate(userId, templateId);

  if (!template) {
    throw new Error("Template not found.");
  }

  const items = await getChecklistTemplateItems(userId, templateId);

  return {
    app: "wheres-my-gear",
    feature: "share-checklist-template",
    version: 1,
    exportedAt: new Date().toISOString(),
    template: stripTemplate(template),
    items: items.map(stripTemplateItem),
  };
}

export async function shareChecklistTemplate(
  userId: string,
  templateId: string
) {
  const shareFile = await buildChecklistTemplateShareFile(userId, templateId);

  if (!FileSystem.cacheDirectory) {
    throw new Error("File sharing is not available on this device.");
  }

  const fileName = `${safeFileName(shareFile.template.name)}.wmgtemplate`;
  const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

  await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(shareFile, null, 2), {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const canShare = await Sharing.isAvailableAsync();

  if (!canShare) {
    throw new Error("Sharing is not available on this device.");
  }

  await Sharing.shareAsync(fileUri, {
    mimeType: "application/json",
    dialogTitle: "Export Checklist Template",
    UTI: "public.json",
  });

  return fileUri;
}

export async function previewChecklistTemplateShareFileFromJson(
  jsonText: string
): Promise<ChecklistTemplateImportPreview> {
  const parsed = JSON.parse(jsonText);
  const file = validateTemplateShareFile(parsed);

  return {
    templateName: file.template.name,
    itemCount: file.items.length,
    exportedAt: file.exportedAt,
  };
}

export async function importChecklistTemplateShareFileFromJson(
  userId: string,
  jsonText: string
): Promise<ChecklistTemplateImportSummary> {
  const parsed = JSON.parse(jsonText);
  const file = validateTemplateShareFile(parsed);

  const templateName = withImportedName(file.template.name ?? "Imported Template");
  const category = (file.template.category || "custom") as ChecklistCategory;
  const customCategoryLabel =
    category === "custom"
      ? file.template.customCategoryLabel || "Imported"
      : "";

  const sortedItems = [...file.items].sort(
    (a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0)
  );

  const templateId = await createChecklistTemplateWithItems(userId, {
    name: templateName,
    category,
    customCategoryLabel,
    items: sortedItems.map((item) => ({
      name: item.name,
      notes: item.notes ?? "",
      quantity: item.quantity,
      packed: Boolean(item.packed ?? false),
      itemPhotoUri: item.itemPhotoUri ?? "",
    })),
  });

  return {
    templateId,
    templateName,
    itemsImported: sortedItems.length,
  };
}
