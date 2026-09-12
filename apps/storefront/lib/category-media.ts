/** Shared storefront category imagery (Beko-style photo tiles). */
export const CATEGORY_IMAGES: Record<string, string> = {
  buzdolaplari: "https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=1200&q=80",
  "camasir-makineleri": "https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&w=1200&q=80",
  "bulasik-makineleri": "https://images.unsplash.com/photo-1585659722983-3a675dabf8ff?auto=format&fit=crop&w=1200&q=80",
  klimalar: "https://images.unsplash.com/photo-1631545806609-3c9f7b0e0c1f?auto=format&fit=crop&w=1200&q=80",
  "ankastre-setler": "https://images.unsplash.com/photo-1556912173-46c336c7fd55?auto=format&fit=crop&w=1200&q=80",
  "kucuk-ev-robot": "https://images.unsplash.com/photo-1558317374-067fb5f30001?auto=format&fit=crop&w=1200&q=80",
  "beyaz-esya": "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=1200&q=80",
};

export function categoryImage(slug: string) {
  return CATEGORY_IMAGES[slug] || CATEGORY_IMAGES.buzdolaplari!;
}
