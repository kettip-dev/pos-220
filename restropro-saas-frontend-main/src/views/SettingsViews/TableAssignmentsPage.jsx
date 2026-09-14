import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Page from "../../components/Page";
import { IconArmchair2, IconUser, IconUserStar, IconX, IconPencil } from "@tabler/icons-react";
import { iconStroke } from "../../config/config";
import { useStoreTables } from "../../controllers/settings.controller";
import { useUsers } from "../../controllers/users.controller";
import {
  useTableAssignments,
  setTableAssignment,
} from "../../controllers/tableAssignments.controller";
import toast from "react-hot-toast";
import { mutate } from "swr";

const DIALOG_ID = "modal-table-assign";

export default function TableAssignmentsPage() {
  const { t } = useTranslation();

  const { data: storeTables, error: tablesError, isLoading: tablesLoading } = useStoreTables();
  const { data: users, isLoading: usersLoading } = useUsers();
  const { APIURL, data: assignmentsData, isLoading: assignmentsLoading } = useTableAssignments();

  const [activeTable, setActiveTable] = useState(null); // table object being edited
  const [busy, setBusy] = useState(false);

  const assignments = assignmentsData?.assignments ?? [];
  const staffList = users ?? [];

  // tableId -> { waiter?: {user_id,user_name}, captain?: {...} }
  const ownerByTable = useMemo(() => {
    const m = new Map();
    for (const a of assignments) {
      const e = m.get(a.table_id) ?? {};
      e[a.role] = { user_id: a.user_id, user_name: a.user_name };
      m.set(a.table_id, e);
    }
    return m;
  }, [assignments]);

  if (tablesLoading || usersLoading || assignmentsLoading) {
    return <Page className="px-8 py-6">{t("table_settings.please_wait") || "Please wait..."}</Page>;
  }
  if (tablesError) {
    return <Page className="px-8 py-6">{t("table_settings.error_loading_data") || "Error loading data."}</Page>;
  }

  const tables = storeTables ?? [];

  // Group tables by floor.
  const byFloor = [];
  const floorMap = new Map();
  for (const tbl of tables) {
    const f = tbl.floor || "—";
    if (!floorMap.has(f)) {
      floorMap.set(f, []);
      byFloor.push(f);
    }
    floorMap.get(f).push(tbl);
  }

  const openDialog = (table) => {
    setActiveTable(table);
    document.getElementById(DIALOG_ID)?.showModal();
  };

  // Assign or clear one role for the active table; refresh the list afterwards.
  const apply = async (role, userId) => {
    if (!activeTable) return;
    setBusy(true);
    try {
      toast.loading("Saving...");
      await setTableAssignment(activeTable.id, role, userId || null);
      await mutate(APIURL);
      toast.dismiss();
      toast.success(userId ? "Assigned" : "Removed");
    } catch (error) {
      toast.dismiss();
      toast.error(error?.response?.data?.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const activeOwners = activeTable ? ownerByTable.get(activeTable.id) ?? {} : {};

  return (
    <Page className="px-4 md:px-8 py-6">
      <div className="flex items-center gap-2 mb-1">
        <IconArmchair2 size={26} stroke={iconStroke} />
        <h3 className="text-2xl font-light">{t("settings.table_assignments")}</h3>
      </div>
      <p className="text-sm text-gray-500 mb-6 max-w-2xl leading-relaxed">
        Tap any table to assign dedicated waiters or captains. Assigned tables appear under "My Tables" in staff apps, while unassigned tables remain available for open service.
      </p>

      {tables.length === 0 ? (
        <p className="text-gray-500">No tables configured. Add tables in Table settings first.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {byFloor.map((f) => (
            <div key={f}>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">{f}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3">
                {floorMap.get(f).map((tbl) => {
                  const owners = ownerByTable.get(tbl.id) ?? {};
                  const hasAny = owners.waiter || owners.captain;
                  return (
                    <button
                      key={tbl.id}
                      onClick={() => openDialog(tbl)}
                      className="group text-left flex flex-col gap-2 p-3 rounded-2xl border border-restro-border-green bg-restro-card-bg hover:bg-restro-button-hover transition active:scale-95"
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 font-bold">
                          <IconArmchair2 size={18} stroke={iconStroke} /> {tbl.table_title}
                        </span>
                        <IconPencil size={15} stroke={iconStroke} className="opacity-0 group-hover:opacity-60" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <AssignLine icon={IconUser} label="Waiter" owner={owners.waiter} />
                        <AssignLine icon={IconUserStar} label="Captain" owner={owners.captain} />
                      </div>
                      {!hasAny && <span className="text-[11px] text-gray-400">Tap to assign</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Assign / edit / remove dialog ── */}
      <dialog id={DIALOG_ID} className="modal modal-bottom sm:modal-middle">
        <div className="modal-box border border-restro-border-green dark:rounded-2xl">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <IconArmchair2 size={20} stroke={iconStroke} />
            {activeTable ? activeTable.table_title : "Table"}
            {activeTable?.floor ? <span className="text-sm font-normal text-gray-400">· {activeTable.floor}</span> : null}
          </h3>

          <div className="mt-5 flex flex-col gap-5">
            <RolePicker
              label="Waiter"
              role="waiter"
              staffList={staffList}
              current={activeOwners.waiter}
              busy={busy}
              onApply={apply}
            />
            <RolePicker
              label="Captain"
              role="captain"
              staffList={staffList}
              current={activeOwners.captain}
              busy={busy}
              onApply={apply}
            />
          </div>

          <div className="modal-action">
            <form method="dialog">
              <button className="btn transition active:scale-95 hover:shadow-lg px-4 py-3 rounded-xl border border-restro-border-green bg-restro-card-bg hover:bg-restro-button-hover text-restro-text">
                {t("table_settings.close") || "Close"}
              </button>
            </form>
          </div>
        </div>
        {/* click-outside closes */}
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </Page>
  );
}

// A single "Waiter: <name>" line on a table card.
function AssignLine({ icon: Icon, label, owner }) {
  return (
    <span className="flex items-center gap-1.5 text-xs">
      <Icon size={14} stroke={iconStroke} className="text-gray-400 shrink-0" />
      <span className="text-gray-400">{label}:</span>
      <span className={owner ? "font-medium text-restro-green truncate" : "text-gray-400"}>
        {owner ? owner.user_name || owner.user_id : "—"}
      </span>
    </span>
  );
}

// Dropdown + assign + remove for one role inside the dialog.
function RolePicker({ label, role, staffList, current, busy, onApply }) {
  const Icon = role === "captain" ? IconUserStar : IconUser;
  const [pick, setPick] = useState("");

  // Reset the dropdown selection whenever the dialog shows a different owner.
  React.useEffect(() => {
    setPick(current?.user_id ?? "");
  }, [current?.user_id]);

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-300">
        <Icon size={16} stroke={iconStroke} /> {label}
      </label>
      <div className="flex items-center gap-2">
        <select
          value={pick}
          disabled={busy}
          onChange={(e) => setPick(e.target.value)}
          className="text-sm flex-1 border rounded-lg px-3 py-2 bg-restro-gray dark:bg-black border-restro-border-green focus:outline-restro-border-green"
        >
          <option value="">Unassigned</option>
          {staffList.map((u) => (
            <option key={u.username} value={u.username}>
              {u.name || u.username}
              {u.role ? ` (${u.role})` : ""}
            </option>
          ))}
        </select>
        <button
          onClick={() => onApply(role, pick)}
          disabled={busy || pick === (current?.user_id ?? "")}
          className="btn rounded-xl px-4 py-2 text-sm text-white border border-restro-border-green bg-restro-green hover:bg-restro-green-button-hover transition active:scale-95 disabled:opacity-40"
        >
          {pick ? "Assign" : "Save"}
        </button>
        {current ? (
          <button
            onClick={() => onApply(role, null)}
            disabled={busy}
            title="Remove"
            className="btn btn-circle btn-sm border border-restro-border-green bg-restro-card-bg hover:bg-restro-button-hover text-restro-red"
          >
            <IconX size={16} stroke={iconStroke} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
