---
name: table-design-system
description: >-
  Use this skill when designing, building, or refactoring high-density, compact data tables,
  toolbars, search/filter bars, row selection, badges, action menus, and pagination across Bong POS.
---

# Bong POS — Table Design System & Compact Table Standards

This skill defines the official standard for data tables across the Bong POS SaaS platform, matching the high-density, QuickBooks/Toast-inspired compact table design (`PromotionsPage`, `InventoryPage`, `StockAdjustmentsListPage`, `StockTransfersListPage`).

---

## 1. Visual & Anatomical Blueprint

Every standard Bong POS list view consists of 4 distinct sections:

```
┌────────────────────────────────────────────────────────────────────────────┐
│ 1. Page Header: Title + Subtitle + Primary Action Buttons                  │
├────────────────────────────────────────────────────────────────────────────┤
│ 2. KPI / Summary Metric Cards (Optional 4-column responsive grid)          │
├────────────────────────────────────────────────────────────────────────────┤
│ 3. Filter & Action Toolbar:                                                │
│    [🔍 Search Input] [Filter 1 ▼] [Filter 2 ▼] ... [🖨️] [📥] [⚙️] [< 1-10 of 25 >] │
├────────────────────────────────────────────────────────────────────────────┤
│ 4. Compact Data Table (Flat, full-bleed container):                        │
│    [☐] Header 1      Header 2      Header 3      Header 4      Action     │
│    ─────────────────────────────────────────────────────────────────────── │
│    [☐] Row 1         Data          Badge         Data          [👁️][🖨️][🗑️] │
│    [☑] Row 2 (active) Data         Badge         Data          [👁️][🖨️][🗑️] │
├────────────────────────────────────────────────────────────────────────────┤
│ 5. Bottom Pagination Bar:                                                  │
│    Showing 1 to 10 of 25 entries                    < Previous Page 1 of 3 Next > │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Table Specifications & Tailwind Classes

### A. Flat Table Container (No Heavy Box Outer Card)
Never wrap standard list tables in thick rounded card wrappers with heavy padding. Use the flat full-width border container:

```jsx
<div className="w-full overflow-x-auto border-t border-b border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#18181b]">
  <table className="w-full text-left border-collapse">
    ...
  </table>
</div>
```

### B. Table Header (`thead > tr`)
- Font size: `text-[13px] font-semibold text-slate-900 dark:text-slate-100`
- Padding: `px-3 py-2.5` or `px-4 py-3`
- Background: Matches page background or white/neutral-900 (`bg-white dark:bg-[#18181b]`)
- Border: `border-b border-slate-200 dark:border-neutral-800`

```jsx
<thead>
  <tr className="border-b border-slate-200 dark:border-neutral-800 text-[13px] font-semibold text-slate-900 dark:text-slate-100 bg-white dark:bg-[#18181b]">
    <th className="w-10 px-3 py-2.5 text-center">
      <input
        type="checkbox"
        checked={isAllSelected}
        onChange={toggleSelectAll}
        className="w-4 h-4 rounded border-slate-300 dark:border-neutral-600 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
      />
    </th>
    <th className="px-3 py-2.5">Status</th>
    <th className="px-3 py-2.5">Reference No</th>
    <th className="px-3 py-2.5">Date</th>
    <th className="px-3 py-2.5 text-right">Action</th>
  </tr>
</thead>
```

### C. Compact Table Rows (`tbody > tr`)
- Density: `py-2` to `py-2.5` (compact "small table" density)
- Typography: `text-xs sm:text-[13px] text-slate-700 dark:text-slate-200`
- Hover state: `hover:bg-slate-50/70 dark:hover:bg-neutral-800/40 transition`
- Selected state: `bg-emerald-50/40 dark:bg-emerald-950/20`
- Row divider: `divide-y divide-slate-100 dark:divide-neutral-800/80` or `border-b border-slate-100 dark:border-neutral-800/80`

```jsx
<tbody className="divide-y divide-slate-100 dark:divide-neutral-800/80">
  {items.map((item) => {
    const isSelected = selectedIds.has(item.id);
    return (
      <tr
        key={item.id}
        className={clsx(
          "hover:bg-slate-50/70 dark:hover:bg-neutral-800/40 transition text-xs sm:text-[13px]",
          isSelected && "bg-emerald-50/40 dark:bg-emerald-950/20"
        )}
      >
        <td className="w-10 px-3 py-2.5 text-center">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleSelect(item.id)}
            className="w-4 h-4 rounded border-slate-300 dark:border-neutral-600 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
          />
        </td>
        <td className="px-3 py-2.5 whitespace-nowrap">...</td>
      </tr>
    );
  })}
</tbody>
```

---

## 3. Toolbar Standards

The toolbar sits directly above the table. It provides real-time search, quick dropdown filters, action utility icons (Print, Export, Settings), and compact inline pagination.

```jsx
<div className="flex flex-col md:flex-row items-center justify-between gap-3 py-2">
  {/* Left: Search Bar & Filters */}
  <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto flex-1">
    <div className="relative flex-1 sm:max-w-xs w-full">
      <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("common.search", "Search...")}
        className="w-full min-h-[38px] pl-9 pr-3 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
      />
    </div>

    <select
      value={statusFilter}
      onChange={(e) => setStatusFilter(e.target.value)}
      className="min-h-[38px] px-3 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
    >
      <option value="all">All Statuses</option>
      <option value="completed">Completed</option>
      <option value="draft">Draft</option>
    </select>
  </div>

  {/* Right: Print, Export, Settings & Inline Pagination */}
  <div className="flex items-center gap-2 w-full md:w-auto justify-end">
    <button
      type="button"
      onClick={handlePrint}
      className="w-9 h-9 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-neutral-800 flex items-center justify-center transition active:scale-95 shadow-xs"
      title="Print Table"
    >
      <IconPrinter size={16} stroke={iconStroke} />
    </button>

    <button
      type="button"
      onClick={handleExportCSV}
      className="w-9 h-9 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-neutral-800 flex items-center justify-center transition active:scale-95 shadow-xs"
      title="Export CSV"
    >
      <IconDownload size={16} stroke={iconStroke} />
    </button>

    <button
      type="button"
      onClick={toggleGearSettings}
      className="w-9 h-9 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-neutral-800 flex items-center justify-center transition active:scale-95 shadow-xs"
      title="Table Settings"
    >
      <IconSettings size={16} stroke={iconStroke} />
    </button>

    {/* Inline Compact Pagination */}
    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-neutral-400 pl-2 border-l border-slate-200 dark:border-neutral-700">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => setPage(p => Math.max(1, p - 1))}
        className={clsx(
          "flex items-center gap-0.5 hover:text-slate-900 dark:hover:text-white transition",
          page <= 1 && "opacity-40 cursor-not-allowed hover:text-slate-600"
        )}
      >
        <IconChevronLeft size={14} stroke={iconStroke} />
        <span>Previous</span>
      </button>

      <span className="font-medium text-slate-800 dark:text-slate-200 tabular-nums">
        {totalItems > 0 ? `${startIndex + 1} - ${endIndex}` : "0 - 0"}
        <span className="text-slate-400 font-normal"> of {totalItems}</span>
      </span>

      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
        className={clsx(
          "flex items-center gap-0.5 hover:text-slate-900 dark:hover:text-white transition",
          page >= totalPages && "opacity-40 cursor-not-allowed hover:text-slate-600"
        )}
      >
        <span>Next</span>
        <IconChevronRight size={14} stroke={iconStroke} />
      </button>
    </div>
  </div>
</div>
```

---

## 4. Status Badges & Pill Styling

Use pastel badges with dot status indicators:

### Completed / Active (Green)
```jsx
<span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800/60">
  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
  {t("status.completed", "Completed")}
</span>
```

### Pending / Draft / In Transit (Amber / Blue)
```jsx
{/* Draft (Amber) */}
<span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/60 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800/60">
  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
  {t("status.draft", "Draft")}
</span>

{/* In Transit (Blue) */}
<span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/60 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800/60">
  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
  {t("status.in_transit", "In Transit")}
</span>
```

### Cancelled / Expired (Rose / Red)
```jsx
<span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/60 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-800/60">
  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
  {t("status.cancelled", "Cancelled")}
</span>
```

---

## 5. Action Icons & Bottom Pagination

### Action Cell
```jsx
<td className="px-3 py-2.5 text-right whitespace-nowrap">
  <div className="flex items-center justify-end gap-1">
    <button
      type="button"
      onClick={() => handleView(item)}
      className="w-8 h-8 rounded-md text-slate-500 hover:text-emerald-700 hover:bg-slate-100 dark:hover:bg-neutral-800 flex items-center justify-center transition active:scale-95"
      title="View Details"
    >
      <IconEye size={15} />
    </button>
    <button
      type="button"
      onClick={() => handlePrint(item)}
      className="w-8 h-8 rounded-md text-slate-500 hover:text-emerald-700 hover:bg-slate-100 dark:hover:bg-neutral-800 flex items-center justify-center transition active:scale-95"
      title="Print Voucher"
    >
      <IconPrinter size={15} />
    </button>
    {item.status === "draft" && (
      <button
        type="button"
        onClick={() => handleDelete(item.id)}
        className="w-8 h-8 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition active:scale-95"
        title="Delete"
      >
        <IconTrash size={15} />
      </button>
    )}
  </div>
</td>
```

### Bottom Pagination Bar
```jsx
<div className="flex items-center justify-between py-3 px-1 text-xs text-slate-600 dark:text-neutral-400">
  <div className="text-slate-500">
    {t("common.showing", "Showing")} {totalItems > 0 ? startIndex + 1 : 0} {t("common.to", "to")} {endIndex} {t("common.of", "of")}{" "}
    {totalItems} {t("common.entries", "entries")}
  </div>

  <div className="flex items-center gap-3">
    <button
      type="button"
      disabled={page <= 1}
      onClick={() => setPage(p => Math.max(1, p - 1))}
      className={clsx(
        "flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition",
        page <= 1 && "opacity-40 cursor-not-allowed hover:text-slate-600"
      )}
    >
      <IconChevronLeft size={14} stroke={iconStroke} />
      <span>{t("common.previous", "Previous")}</span>
    </button>

    <span className="tabular-nums font-medium text-slate-800 dark:text-slate-200">
      Page {page} of {totalPages}
    </span>

    <button
      type="button"
      disabled={page >= totalPages}
      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
      className={clsx(
        "flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition",
        page >= totalPages && "opacity-40 cursor-not-allowed hover:text-slate-600"
      )}
    >
      <span>{t("common.next", "Next")}</span>
      <IconChevronRight size={14} stroke={iconStroke} />
    </button>
  </div>
</div>
```

---

## 6. Summary KPI Stat Cards (Image 2 Style)

Match the 4-card metric display:
```jsx
<div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
  <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs">
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{title}</span>
      <span className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
        <IconChecklist size={16} />
      </span>
    </div>
    <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2 tabular-nums">
      {value}
    </div>
  </div>
</div>
```
