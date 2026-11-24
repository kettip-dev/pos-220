/**
 * Allergen and dietary tags a menu item can carry. Stored on
 * menu_items.dietary_tags as a comma-separated list of these codes.
 * Keep in sync with restropro-saas-frontend-main/src/config/dietaryTags.js.
 */
const ALLERGEN_TAGS = ["peanuts", "tree_nuts", "gluten", "dairy", "egg", "soy", "fish", "shellfish", "sesame"];
const DIET_TAGS = ["vegetarian", "vegan", "halal", "gluten_free", "spicy"];
const ALL_TAGS = [...ALLERGEN_TAGS, ...DIET_TAGS];

/** Accepts an array or comma string; returns a clean, ordered, de-duplicated comma string or null. */
function normalizeDietaryTags(input) {
  const raw = Array.isArray(input) ? input : String(input || "").split(",");
  const wanted = new Set(raw.map((v) => String(v).trim().toLowerCase()).filter(Boolean));
  const clean = ALL_TAGS.filter((tag) => wanted.has(tag));
  return clean.length ? clean.join(",") : null;
}

module.exports = { ALLERGEN_TAGS, DIET_TAGS, ALL_TAGS, normalizeDietaryTags };
