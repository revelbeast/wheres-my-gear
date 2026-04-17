export type ChecklistCategory =
  | "trip"
  | "water"
  | "electronics"
  | "clothing"
  | "weapons"
  | "custom";

export type ChecklistStatus = "active" | "completed" | "archived";

export type ChecklistTemplate = {
  id: string;
  name: string;
  category: ChecklistCategory;
  description?: string;
  isDefault: boolean;
  itemCount: number;
  createdAt?: any;
  updatedAt?: any;
};

export type ChecklistTemplateItem = {
  id: string;
  name: string;
  notes?: string;
  quantity: number;
  sortOrder: number;
  createdAt?: any;
};

export type Checklist = {
  id: string;
  name: string;
  templateId?: string | null;
  category: ChecklistCategory;
  status: ChecklistStatus;
  packedCount: number;
  totalCount: number;
  missingCount: number;
  vehicleId?: string | null;
  tripId?: string | null;
  isArchived: boolean;
  createdAt?: any;
  updatedAt?: any;
};

export type ChecklistItem = {
  id: string;
  name: string;
  notes?: string;
  quantity: number;
  packed: boolean;
  packedAt?: any | null;
  sortOrder: number;
  sourceTemplateItemId?: string | null;
  createdAt?: any;
  updatedAt?: any;
};
