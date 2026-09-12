export type Money = {
  amount: number;
  currency: "TRY";
};

export type ProductSummary = {
  id: string;
  sku: string;
  name: string;
  slug: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED" | string;
  description?: string;
  shortDescription?: string;
  brandId?: string;
  categoryId?: string;
  images?: Array<{ id: string; productId: string; url: string; alt?: string; sortOrder?: number }>;
  variants?: Array<{
    id: string;
    productId: string;
    sku: string;
    name: string;
    barcode?: string;
    weightGrams?: number;
  }>;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  userId?: string;
  email?: string;
  roles?: string[];
};

export type ApiError = {
  error: string;
  message: string;
  requestId?: string;
};
