export type Money = {
  amount: number;
  currency: "TRY";
};

export type ProductFeature = {
  title: string;
  subtitle?: string;
  body: string;
  icon?: string;
};

export type ProductSpecGroup = {
  title: string;
  rows: Array<{ label: string; value: string }>;
};

export type ProductDocument = {
  title: string;
  lang?: string;
  url: string;
  kind?: string;
};

export type ProductDetail = {
  energyClass?: string;
  dimensions?: { width?: string; height?: string; depth?: string };
  features?: ProductFeature[];
  specGroups?: ProductSpecGroup[];
  documents?: ProductDocument[];
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
  detail?: ProductDetail;
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
