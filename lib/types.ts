export type PriceCell = { widthCm: number; depthCm: number; cents: number; special?: boolean };
export type Variant = { id: string; label: string; page: number; cells: PriceCell[] };
export type CatalogOption = { id: string; label: string; cents?: number; basisPoints?: number; unit: 'piece' | 'width-m' | 'percent'; group: string; requires?: string[]; page: number };
export type Product = {
  id: string; name: string; categoryId: string; type: 'grid' | 'sqm' | 'fixed';
  image: string; description: string; pages: number[]; technicalPage: number;
  review: 'checked' | 'pending'; reviewNote: string; variants: Variant[];
  fixed: { id: string; label: string; cents: number }[];
  sqmCents?: number; minSqm?: number; minHeightCm?: number; minWidthCm?: number;
  colors: { id: string; label: string; hex: string; basisPoints: number }[];
  options: CatalogOption[]; notes: string[]; minimumDifferenceCm?: number;
};
export type Catalog = { version: string; manufacturer: string; source: { name: string; sha256: string; pages: number; edition: string }; categories: { id: string; name: string; description: string; image: string; icon: string }[]; products: Product[] };
export type Selection = {
  productId: string; variantId: string; widthCm: number; depthCm: number;
  fixedId: string; colorId: string; optionIds: string[]; quantity: number;
  installationCents: number; deliveryCents: number; discountBasisPoints: number;
};
export type Company = { name: string; address: string; vatNumber: string; email: string; phone: string; validityDays: number; vatBasisPoints: number; terms: string };
export type ReviewOverride = { status: 'checked' | 'pending'; note: string; updatedAt: string };
export type Line = { label: string; quantity: number; unit: string; cents: number; page?: number };
export type Calculation = {
  available: boolean; issuable: boolean; errors: string[]; warnings: string[];
  lines: Line[]; productName: string; variantLabel: string; colorLabel: string;
  areaSqm: number; billedAreaSqm: number; baseCents: number; productCents: number;
  discountCents: number; subtotalCents: number; vatCents: number; totalCents: number;
  catalogVersion: string; pages: number[];
};
export type Client = { name: string; address: string; email: string; phone: string; notes: string };
export type QuoteStatus = 'draft' | 'review' | 'issued' | 'accepted' | 'cancelled';
export type QuoteSnapshot = { selection: Selection; calculation: Calculation; client: Client; company: Company; createdAt: string; validUntil: string; source: Catalog['source'] };
export type Quote = { id: number; number: string; status: QuoteStatus; snapshot: QuoteSnapshot; createdAt: string; updatedAt: string };
