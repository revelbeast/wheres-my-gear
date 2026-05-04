export type ChecklistCategory =
  | "trip"
  | "camping"
  | "hunting"
  | "fishing"
  | "boating"
  | "clothing"
  | "electronics"
  | "medical"
  | "tools"
  | "food"
  | "custom";

export type ChecklistStatus = "active" | "completed" | "archived";

export type ChecklistTemplate = {
  id: string;
  name: string;
  category: ChecklistCategory;
  description?: string;
  customCategoryLabel?: string;
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
  packed?: boolean;
  sortOrder: number;
  itemPhotoUri?: string;
  createdAt?: any;
  updatedAt?: any;
};

export type Checklist = {
  id: string;
  name: string;
  templateId?: string | null;
  category: ChecklistCategory;
  customCategoryLabel?: string;
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
  itemPhotoUri?: string;
  createdAt?: any;
  updatedAt?: any;
};