// Category colours used across the POS (category rail, phone picker, text-only
// menu tiles). soft = resting tint, solid = selected fill / stripe / tile colour.
// Full class names are written out so Tailwind keeps them in the build.
export const CATEGORY_ALL_TONE = { soft: 'bg-slate-100 dark:bg-slate-800', solid: 'bg-[#0D233A]' };
export const CATEGORY_FAVORITES_TONE = { soft: 'bg-amber-50 dark:bg-amber-950/40', solid: 'bg-amber-500' };
export const CATEGORY_TONES = [
  { soft: 'bg-amber-50 dark:bg-amber-950/40', solid: 'bg-amber-600' },
  { soft: 'bg-sky-50 dark:bg-sky-950/40', solid: 'bg-sky-600' },
  { soft: 'bg-violet-50 dark:bg-violet-950/40', solid: 'bg-violet-600' },
  { soft: 'bg-emerald-50 dark:bg-emerald-950/40', solid: 'bg-emerald-600' },
  { soft: 'bg-orange-50 dark:bg-orange-950/40', solid: 'bg-orange-600' },
  { soft: 'bg-rose-50 dark:bg-rose-950/40', solid: 'bg-rose-600' },
  { soft: 'bg-teal-50 dark:bg-teal-950/40', solid: 'bg-teal-600' },
  { soft: 'bg-indigo-50 dark:bg-indigo-950/40', solid: 'bg-indigo-600' },
  { soft: 'bg-lime-50 dark:bg-lime-950/40', solid: 'bg-lime-700' },
  { soft: 'bg-fuchsia-50 dark:bg-fuchsia-950/40', solid: 'bg-fuchsia-600' },
];

/** Tone for the n-th enabled category (stable while the category order is unchanged). */
export const toneForIndex = (index) => CATEGORY_TONES[index % CATEGORY_TONES.length];
