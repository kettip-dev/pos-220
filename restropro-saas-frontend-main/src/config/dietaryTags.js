/**
 * Allergen and dietary tags for menu items. Codes must match
 * restropro-saas-backend-main/src/utils/dietaryTags.js.
 *
 * `mark` is what a compact badge shows: an emoji where one is unambiguous,
 * otherwise a short letter code.
 */
export const DIETARY_TAGS = [
  { code: "peanuts", kind: "allergen", mark: "🥜", label: "Peanuts" },
  { code: "tree_nuts", kind: "allergen", mark: "🌰", label: "Tree nuts" },
  { code: "gluten", kind: "allergen", mark: "🌾", label: "Gluten" },
  { code: "dairy", kind: "allergen", mark: "🥛", label: "Dairy" },
  { code: "egg", kind: "allergen", mark: "🥚", label: "Egg" },
  { code: "soy", kind: "allergen", mark: "🫘", label: "Soy" },
  { code: "fish", kind: "allergen", mark: "🐟", label: "Fish" },
  { code: "shellfish", kind: "allergen", mark: "🦐", label: "Shellfish" },
  { code: "sesame", kind: "allergen", mark: "Se", label: "Sesame" },
  { code: "vegetarian", kind: "diet", mark: "V", label: "Vegetarian" },
  { code: "vegan", kind: "diet", mark: "VG", label: "Vegan" },
  { code: "halal", kind: "diet", mark: "H", label: "Halal" },
  { code: "gluten_free", kind: "diet", mark: "GF", label: "Gluten-free" },
  { code: "spicy", kind: "diet", mark: "🌶️", label: "Spicy" },
];

const BY_CODE = Object.fromEntries(DIETARY_TAGS.map((tag) => [tag.code, tag]));

/** "peanuts,vegan" | ["peanuts"] | null → tag definitions in canonical order. */
export function parseDietaryTags(value) {
  const list = Array.isArray(value) ? value : String(value || "").split(",");
  const wanted = new Set(list.map((v) => String(v).trim()).filter(Boolean));
  return DIETARY_TAGS.filter((tag) => wanted.has(tag.code));
}

export const getDietaryTag = (code) => BY_CODE[code] || null;

export const dietaryTagLabel = (t, tag) => t(`dietary.${tag.code}`, tag.label);

/** Allergens contained across several items, de-duplicated, canonical order. */
export function collectAllergens(items, field = "dietary_tags") {
  const found = new Set();
  (items || []).forEach((item) => parseDietaryTags(item?.[field]).forEach((tag) => {
    if (tag.kind === "allergen") found.add(tag.code);
  }));
  return DIETARY_TAGS.filter((tag) => found.has(tag.code));
}
