import React from "react";
import clsx from "clsx";
import toast from "react-hot-toast";
import { IconCheck, IconLayoutSidebar, IconLayoutSidebarRight } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import Page from "../../components/Page";
import { iconStroke } from "../../config/config";
import { TICKET_SIDES, useTicketSide } from "../../helpers/POSLayoutPrefs";

function LayoutPreview({ ticketLeft }) {
  const ticket = (
    <div className="w-[32%] rounded-md bg-[#0D233A]/85 dark:bg-slate-500 flex flex-col gap-1 p-1.5">
      <div className="h-1.5 w-3/4 rounded bg-white/70" />
      <div className="h-1.5 w-1/2 rounded bg-white/50" />
      <div className="mt-auto h-3 rounded bg-[#2CA01C]" />
    </div>
  );
  const catalog = (
    <div className="flex-1 rounded-md bg-gray-100 dark:bg-slate-800 grid grid-cols-3 gap-1 p-1.5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded bg-gray-300 dark:bg-slate-600" />
      ))}
    </div>
  );
  return (
    <div className="h-28 w-full flex gap-1.5 rounded-lg border border-gray-200 dark:border-slate-700 p-1.5 bg-white dark:bg-slate-900">
      {ticketLeft ? ticket : catalog}
      {ticketLeft ? catalog : ticket}
    </div>
  );
}

export default function POSLayoutSettingsPage() {
  const { t } = useTranslation();
  const [ticketSide, setTicketSide] = useTicketSide();

  const options = [
    {
      value: TICKET_SIDES.RIGHT,
      label: t("pos_layout.ticket_right", "Ticket on right"),
      hint: t("pos_layout.ticket_right_hint", "Default. Best for right-handed staff."),
      icon: IconLayoutSidebarRight,
    },
    {
      value: TICKET_SIDES.LEFT,
      label: t("pos_layout.ticket_left", "Ticket on left"),
      hint: t("pos_layout.ticket_left_hint", "Left-handed staff, or when the customer stands on the left."),
      icon: IconLayoutSidebar,
    },
  ];

  const choose = (value) => {
    if (value === ticketSide) return;
    setTicketSide(value);
    toast.success(t("pos_layout.saved", "POS layout saved on this device"));
  };

  return (
    <Page className="px-4 py-3 md:p-8 max-w-4xl">
      <h3 className="text-lg font-bold">{t("pos_layout.title", "POS Layout")}</h3>
      <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
        {t(
          "pos_layout.description",
          "Choose which side of the POS screen shows the order ticket. This is saved on this device only, so each terminal can have its own layout."
        )}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
        {options.map(({ value, label, hint, icon: Icon }) => {
          const selected = ticketSide === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => choose(value)}
              aria-pressed={selected}
              className={clsx(
                "min-h-[42px] text-left rounded-2xl border-2 p-4 flex flex-col gap-3 transition active:scale-95 touch-manipulation cursor-pointer bg-white dark:bg-slate-900",
                selected
                  ? "border-[#2CA01C] shadow-sm"
                  : "border-gray-200 dark:border-slate-700 hover:border-gray-300"
              )}
            >
              <LayoutPreview ticketLeft={value === TICKET_SIDES.LEFT} />
              <div className="flex items-center gap-2">
                <Icon size={20} stroke={iconStroke} className="text-[#008489] shrink-0" />
                <span className="font-bold flex-1">{label}</span>
                {selected && (
                  <span className="w-6 h-6 rounded-full bg-[#2CA01C] text-white flex items-center justify-center shrink-0">
                    <IconCheck size={16} stroke={3} />
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-500 dark:text-slate-400">{hint}</span>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-gray-400 dark:text-slate-500 mt-4">
        {t("pos_layout.mobile_note", "On phones the ticket always opens as a bottom sheet.")}
      </p>
    </Page>
  );
}
