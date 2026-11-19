import React from "react";
import clsx from "clsx";
import toast from "react-hot-toast";
import {
  IconAdjustmentsHorizontal,
  IconCheck,
  IconLayoutSidebar,
  IconLayoutSidebarRight,
  IconPhoto,
  IconRotate,
  IconTag,
  IconCurrencyDollar,
  IconCoffee,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import Page from "../../components/Page";
import { iconStroke } from "../../config/config";
import {
  DEFAULT_DISPLAY_PREFS,
  TICKET_SIDES,
  TILE_SIZES,
  useDisplayPrefs,
  useTicketSide,
} from "../../helpers/POSLayoutPrefs";
import { toneForIndex } from "../../helpers/CategoryTones";

// ─── Small building blocks ────────────────────────────────

function Section({ title, description, children }) {
  return (
    <section className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 sm:p-5">
      <h4 className="text-base font-bold text-gray-900 dark:text-white">{title}</h4>
      {description && <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ToggleRow({ icon: Icon, label, hint, checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="w-full min-h-[56px] flex items-center gap-3 py-2 text-left active:scale-[0.99] transition touch-manipulation"
    >
      <span className="w-10 h-10 rounded-xl bg-[#F4F5F8] dark:bg-slate-800 flex items-center justify-center text-[#008489] shrink-0">
        <Icon size={20} stroke={iconStroke} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold text-gray-900 dark:text-white">{label}</span>
        {hint && <span className="block text-xs text-gray-500 dark:text-slate-400">{hint}</span>}
      </span>
      <span
        className={clsx(
          "relative w-[52px] h-[30px] rounded-full transition-colors shrink-0",
          checked ? "bg-[#2CA01C]" : "bg-gray-300 dark:bg-slate-600"
        )}
      >
        <span
          className={clsx(
            "absolute top-[3px] w-6 h-6 rounded-full bg-white shadow transition-all",
            checked ? "left-[25px]" : "left-[3px]"
          )}
        />
      </span>
    </button>
  );
}

function Segmented({ options, value, onChange }) {
  return (
    <div className="grid gap-1 p-1 rounded-xl bg-[#F4F5F8] dark:bg-slate-800" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            "min-h-[44px] rounded-lg text-sm font-bold transition active:scale-95 touch-manipulation",
            value === o.value
              ? "bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-sm"
              : "text-gray-500 dark:text-slate-400 hover:text-gray-800"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Live preview of menu tiles ───────────────────────────

const PREVIEW_ITEMS = [
  { name: "Caffè Americano", price: "$3.25", category: "Hot Coffees", tone: 0, hasOptions: true },
  { name: "Iced Caramel Macchiato", price: "$5.15", category: "Cold Coffees", tone: 1, hasOptions: true },
  { name: "Butter Croissant", price: "$2.95", category: "Bakery", tone: 4, hasOptions: false },
];

const PREVIEW_SIZE = {
  small: { cols: "grid-cols-3", price: "text-[13px]", name: "text-[11px]", textName: "text-[12px]" },
  medium: { cols: "grid-cols-3", price: "text-[15px]", name: "text-[12px]", textName: "text-[14px]" },
  large: { cols: "grid-cols-2", price: "text-[17px]", name: "text-[14px]", textName: "text-[16px]" },
};

function TilePreview({ prefs }) {
  const size = PREVIEW_SIZE[prefs.tileSize] || PREVIEW_SIZE.medium;
  const items = prefs.tileSize === "large" ? PREVIEW_ITEMS.slice(0, 2) : PREVIEW_ITEMS;
  return (
    <div className={clsx("grid gap-2", size.cols)}>
      {items.map((item) => {
        const tone = toneForIndex(item.tone).solid;
        return (
          <div
            key={item.name}
            className={clsx(
              "relative overflow-hidden rounded-xl text-white",
              prefs.showImages ? "aspect-[6/5] bg-gradient-to-br from-[#6b4f3a] via-[#3b2a20] to-[#1c1410]" : clsx("aspect-[3/2]", tone)
            )}
          >
            {prefs.showImages && (
              <>
                <IconCoffee size={44} stroke={1.3} className="absolute top-3 right-3 text-white/25" />
                <div className="absolute inset-x-0 bottom-0 h-[70%] bg-gradient-to-t from-black/85 to-transparent" />
              </>
            )}
            {!prefs.showImages && <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-black/20" />}
            {item.hasOptions && (
              <span className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-black/40 flex items-center justify-center">
                <IconAdjustmentsHorizontal size={11} />
              </span>
            )}
            <div className="absolute inset-x-0 bottom-0 p-2">
              {prefs.showImages && prefs.showPrice && <p className={clsx("font-extrabold leading-tight", size.price)}>{item.price}</p>}
              <p className={clsx("font-bold leading-tight line-clamp-2", prefs.showImages ? size.name : size.textName)}>{item.name}</p>
              {prefs.showCategory && <p className="text-[10px] text-white/70 truncate">{item.category}</p>}
              {!prefs.showImages && prefs.showPrice && <p className={clsx("mt-0.5 font-extrabold leading-tight", size.price)}>{item.price}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────

export default function POSLayoutSettingsPage() {
  const { t } = useTranslation();
  const [ticketSide, setTicketSide] = useTicketSide();
  const [prefs, setPrefs] = useDisplayPrefs();

  const saved = () => toast.success(t("pos_layout.saved", "Saved on this device"), { id: "pos-layout-saved" });
  const update = (patch) => {
    setPrefs(patch);
    saved();
  };

  const isDefault =
    ticketSide === TICKET_SIDES.RIGHT &&
    Object.keys(DEFAULT_DISPLAY_PREFS).every((k) => prefs[k] === DEFAULT_DISPLAY_PREFS[k]);

  const sideOptions = [
    { value: TICKET_SIDES.RIGHT, label: t("pos_layout.ticket_right", "Ticket on right"), hint: t("pos_layout.ticket_right_hint", "Default. Best for right-handed staff."), icon: IconLayoutSidebarRight },
    { value: TICKET_SIDES.LEFT, label: t("pos_layout.ticket_left", "Ticket on left"), hint: t("pos_layout.ticket_left_hint", "Left-handed staff, or when the customer stands on the left."), icon: IconLayoutSidebar },
  ];

  return (
    <Page className="px-4 py-3 md:p-8 max-w-5xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">{t("pos_layout.title", "POS Layout")}</h3>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 max-w-2xl">
            {t("pos_layout.description", "Set up how the POS screen looks on this device. Each terminal keeps its own layout, so a small counter tablet and a large bar screen can each be set up for their staff.")}
          </p>
        </div>
        <button
          type="button"
          disabled={isDefault}
          onClick={() => {
            setTicketSide(TICKET_SIDES.RIGHT);
            setPrefs(null);
            toast.success(t("pos_layout.reset_done", "Layout reset to defaults"), { id: "pos-layout-saved" });
          }}
          className="shrink-0 min-h-[42px] px-3.5 rounded-xl border border-gray-200 dark:border-slate-700 text-sm font-bold text-gray-700 dark:text-slate-200 flex items-center gap-1.5 active:scale-95 transition disabled:opacity-40 disabled:pointer-events-none"
        >
          <IconRotate size={16} stroke={iconStroke} />
          {t("pos_layout.reset", "Reset")}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 mt-6 items-start">
        <div className="space-y-4 min-w-0">
          {/* Menu tiles */}
          <Section
            title={t("pos_layout.menu_tiles", "Menu item tiles")}
            description={t("pos_layout.menu_tiles_desc", "Bigger tiles are faster to hit. Text-only tiles fit more items and are quickest to scan once staff know the menu.")}
          >
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">{t("pos_layout.tile_size", "Tile size")}</p>
            <Segmented
              value={prefs.tileSize}
              onChange={(v) => update({ tileSize: v })}
              options={[
                { value: TILE_SIZES.SMALL, label: t("pos_layout.size_small", "Small") },
                { value: TILE_SIZES.MEDIUM, label: t("pos_layout.size_medium", "Medium") },
                { value: TILE_SIZES.LARGE, label: t("pos_layout.size_large", "Large") },
              ]}
            />
            <div className="mt-3 divide-y divide-gray-100 dark:divide-slate-800">
              <ToggleRow
                icon={IconPhoto}
                label={t("pos_layout.show_images", "Show item photos")}
                hint={t("pos_layout.show_images_hint", "Off: plain tiles coloured by category, more items per screen.")}
                checked={prefs.showImages}
                onChange={(v) => update({ showImages: v })}
              />
              <ToggleRow
                icon={IconCurrencyDollar}
                label={t("pos_layout.show_price", "Show price")}
                hint={t("pos_layout.show_price_hint", "Hide it if staff know prices and you want cleaner tiles.")}
                checked={prefs.showPrice}
                onChange={(v) => update({ showPrice: v })}
              />
              <ToggleRow
                icon={IconTag}
                label={t("pos_layout.show_category", "Show category name")}
                hint={t("pos_layout.show_category_hint", "Shown under the item name in All and Favorites.")}
                checked={prefs.showCategory}
                onChange={(v) => update({ showCategory: v })}
              />
            </div>
          </Section>

          {/* Ticket side */}
          <Section
            title={t("pos_layout.ticket_side", "Order ticket position")}
            description={t("pos_layout.mobile_note", "On phones the ticket always opens as a bottom sheet.")}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sideOptions.map(({ value, label, hint, icon: Icon }) => {
                const selected = ticketSide === value;
                const ticketLeft = value === TICKET_SIDES.LEFT;
                const ticket = <div className="w-[32%] rounded-md bg-[#0D233A]/85 dark:bg-slate-500 flex flex-col gap-1 p-1.5"><div className="h-1.5 w-3/4 rounded bg-white/70" /><div className="mt-auto h-3 rounded bg-[#2CA01C]" /></div>;
                const menu = <div className="flex-1 rounded-md bg-gray-100 dark:bg-slate-800 grid grid-cols-3 gap-1 p-1.5">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="rounded bg-gray-300 dark:bg-slate-600" />)}</div>;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      if (selected) return;
                      setTicketSide(value);
                      saved();
                    }}
                    className={clsx(
                      "text-left rounded-2xl border-2 p-3 flex flex-col gap-2.5 transition active:scale-95 touch-manipulation",
                      selected ? "border-[#2CA01C]" : "border-gray-200 dark:border-slate-700 hover:border-gray-300"
                    )}
                  >
                    <div className="h-20 flex gap-1.5">{ticketLeft ? ticket : menu}{ticketLeft ? menu : ticket}</div>
                    <div className="flex items-center gap-2">
                      <Icon size={18} stroke={iconStroke} className="text-[#008489] shrink-0" />
                      <span className="text-sm font-bold flex-1">{label}</span>
                      {selected && (
                        <span className="w-6 h-6 rounded-full bg-[#2CA01C] text-white flex items-center justify-center shrink-0">
                          <IconCheck size={15} stroke={3} />
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 dark:text-slate-400">{hint}</span>
                  </button>
                );
              })}
            </div>
          </Section>
        </div>

        {/* Live preview (sticky on large screens) */}
        <div className="lg:sticky lg:top-4">
          <Section title={t("pos_layout.preview", "Preview")} description={t("pos_layout.preview_desc", "How menu tiles will look on the POS.")}>
            <TilePreview prefs={prefs} />
          </Section>
        </div>
      </div>
    </Page>
  );
}
