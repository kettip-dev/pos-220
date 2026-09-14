import React, { useState, useEffect, useContext, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import Page from "../components/Page";
import { SocketContext } from "../contexts/SocketContext";
import { getUserDetailsInLocalStorage } from "../helpers/UserDetails";
import {
  useStoreTablesLiveStatus,
  saveStoreTablesLayout,
  uploadFloorPlanImage,
  deleteFloorPlanImage,
  addNewStoreTable,
  updateStoreTable,
  deleteTable,
  useStoreSettings,
} from "../controllers/settings.controller";
import { useReservations } from "../controllers/reservations.controller";
import FloorPlanCanvas from "../components/tables/FloorPlanCanvas";
import TableDetailsModal from "../components/tables/TableDetailsModal";
import AddEditTableModal from "../components/tables/AddEditTableModal";
import BindoTopBar from "../components/tables/BindoTopBar";
import BindoBottomBar from "../components/tables/BindoBottomBar";
import BindoActionDrawer from "../components/tables/BindoActionDrawer";
import { getTableBindoStatus } from "../components/tables/BindoTableNode";
import { generateDuplicateTableTitle } from "../helpers/TableHelper";

export default function TablesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = getUserDetailsInLocalStorage();
  const { socket, isSocketConnected } = useContext(SocketContext);

  // Live tables data
  const { data: storeData, isLoading, mutate } = useStoreTablesLiveStatus();
  const { data: storeSettings } = useStoreSettings();
  const { data: reservationsData } = useReservations({ type: "today" });

  const currency = storeSettings?.currency || "$";
  const rawTables = storeData?.tables || [];
  const rawLayouts = storeData?.layouts || [];
  const todayReservations = reservationsData?.reservations || [];

  // Floors / Zones derived strictly from existing tables and layouts
  const zones = useMemo(() => {
    const set = new Set();
    rawTables.forEach((tbl) => {
      if (tbl.floor !== undefined && tbl.floor !== null && String(tbl.floor).trim() !== "") {
        set.add(String(tbl.floor));
      }
    });
    rawLayouts.forEach((lay) => {
      if (lay.floor !== undefined && lay.floor !== null && String(lay.floor).trim() !== "") {
        set.add(String(lay.floor));
      }
    });
    if (set.size === 0) set.add("0");
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [rawTables, rawLayouts]);

  const [currentFloor, setCurrentFloor] = useState("0");

  useEffect(() => {
    if (zones.length > 0 && !zones.includes(currentFloor)) {
      setCurrentFloor(zones[0]);
    }
  }, [zones, currentFloor]);

  // Edit Mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editableTables, setEditableTables] = useState([]);
  const [floorSettings, setFloorSettings] = useState({
    show_cashier: true,
    cashier_x: 60,
    cashier_y: 260,
    floor_plan_image: null,
    floor_plan_opacity: 0.8,
    floor_plan_fit: "contain",
    walls: null,
  });

  // Drawer and Selection State
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [drawerMode, setDrawerMode] = useState("list"); // 'actions' | 'list'
  const [selectedTableId, setSelectedTableId] = useState(null);
  const [activeFilter, setActiveFilter] = useState(null); // Bindo status filter key

  // Merged tables state (pairs of table IDs: [[id1, id2], [id2, id3]])
  const [mergedPairs, setMergedPairs] = useState(() => {
    try {
      const saved = localStorage.getItem(`bindo_merged_pairs_${currentFloor}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isMergeMode, setIsMergeMode] = useState(false);
  const [mergeSourceId, setMergeSourceId] = useState(null);

  // Modals state
  const [activeDetailsTable, setActiveDetailsTable] = useState(null);
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingTableData, setEditingTableData] = useState(null);

  // Sync state when floor changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`bindo_merged_pairs_${currentFloor}`);
      setMergedPairs(saved ? JSON.parse(saved) : []);
    } catch {
      setMergedPairs([]);
    }
  }, [currentFloor]);

  useEffect(() => {
    if (!isEditMode) {
      setEditableTables(rawTables);
      const currentLayout = rawLayouts.find((l) => String(l.floor) === String(currentFloor));
      setFloorSettings({
        show_cashier: currentLayout?.show_cashier !== 0,
        cashier_x: currentLayout?.cashier_x ?? 60,
        cashier_y: currentLayout?.cashier_y ?? 260,
        cashier_w: currentLayout?.cashier_w ?? 80,
        cashier_h: currentLayout?.cashier_h ?? 180,
        floor_plan_image: currentLayout?.floor_plan_image ?? null,
        floor_plan_opacity: currentLayout?.floor_plan_opacity ?? 0.8,
        floor_plan_fit: currentLayout?.floor_plan_fit ?? "contain",
        walls: currentLayout?.walls || null,
      });
    }
  }, [rawTables, rawLayouts, currentFloor, isEditMode]);

  // Real-time socket listener
  useEffect(() => {
    if (!socket) return;
    const handleTableStatusUpdate = () => mutate();
    const handleNewOrder = () => mutate();
    const handleOrderUpdate = () => mutate();

    socket.on("table_status_update", handleTableStatusUpdate);
    socket.on("new_order", handleNewOrder);
    socket.on("order_update", handleOrderUpdate);

    return () => {
      socket.off("table_status_update", handleTableStatusUpdate);
      socket.off("new_order", handleNewOrder);
      socket.off("order_update", handleOrderUpdate);
    };
  }, [socket, mutate]);

  // Tables on current floor
  const tablesOnFloor = useMemo(() => {
    const list = isEditMode ? editableTables : rawTables;
    return list.filter((tbl) => String(tbl.floor) === String(currentFloor));
  }, [isEditMode, editableTables, rawTables, currentFloor]);

  // Selected table object
  const selectedTable = useMemo(() => {
    if (!selectedTableId) return null;
    return tablesOnFloor.find((t) => String(t.id) === String(selectedTableId)) || null;
  }, [tablesOnFloor, selectedTableId]);

  // Live order counters for Top Bar
  const { dineInCount, pickUpCount } = useMemo(() => {
    let dineIn = 0;
    let pickUp = 0;
    rawTables.forEach((t) => {
      if (t.active_order_id) {
        if (t.delivery_type === "takeaway") pickUp++;
        else dineIn++;
      }
    });
    return { dineInCount: dineIn, pickUpCount: pickUp };
  }, [rawTables]);

  // Live Metrics for Bottom Status Bar
  const bindoMetrics = useMemo(() => {
    const counts = {
      seated: 0,
      ordered: 0,
      ck_dropped: 0,
      paid: 0,
      unsent: 0,
      alert: 0,
      over_time: 0,
      reserved: 0,
      multiple: 0,
      available: 0,
      blocked: 0,
      total_pax: 0,
    };

    tablesOnFloor.forEach((tbl) => {
      const statusKey = getTableBindoStatus(tbl);
      if (counts[statusKey] !== undefined) {
        counts[statusKey]++;
      }
      if (tbl.active_order_id) {
        counts.total_pax += Number(tbl.seating_capacity || 2);
      }
    });

    return counts;
  }, [tablesOnFloor]);

  // Seated tables list for Drawer
  const seatedTablesList = useMemo(() => {
    return tablesOnFloor.filter((t) => Boolean(t.active_order_id));
  }, [tablesOnFloor]);

  // Table click handler
  const handleTableClick = useCallback(
    (table) => {
      if (isMergeMode) {
        if (!mergeSourceId) {
          setMergeSourceId(table.id);
          toast(t("tables.merge_select_second", "Select a second table to link/merge"), { icon: "🔗" });
        } else if (mergeSourceId === table.id) {
          setMergeSourceId(null);
        } else {
          // Toggle connection between mergeSourceId and table.id
          setMergedPairs((prev) => {
            const pairExists = prev.some(
              ([a, b]) =>
                (String(a) === String(mergeSourceId) && String(b) === String(table.id)) ||
                (String(a) === String(table.id) && String(b) === String(mergeSourceId))
            );
            const updated = pairExists
              ? prev.filter(
                  ([a, b]) =>
                    !(
                      (String(a) === String(mergeSourceId) && String(b) === String(table.id)) ||
                      (String(a) === String(table.id) && String(b) === String(mergeSourceId))
                    )
                )
              : [...prev, [mergeSourceId, table.id]];

            try {
              localStorage.setItem(`bindo_merged_pairs_${currentFloor}`, JSON.stringify(updated));
            } catch (err) {
              console.error(err);
            }
            return updated;
          });

          toast.success(t("tables.merge_updated", "Tables merged successfully!"));
          setMergeSourceId(null);
        }
        return;
      }

      // Normal click: select table and show actions in drawer
      setSelectedTableId(table.id);
      setIsDrawerOpen(true);
      setDrawerMode("actions");
    },
    [isMergeMode, mergeSourceId, currentFloor, t]
  );

  // Edit Mode Actions
  const handleEnterEditMode = () => {
    setEditableTables([...rawTables]);
    setIsEditMode(true);
    setSelectedTableId(null);
    setIsMergeMode(false);
  };

  const handleCancelEditMode = () => {
    setEditableTables([...rawTables]);
    setIsEditMode(false);
    setSelectedTableId(null);
  };

  const handleSaveLayout = async () => {
    try {
      setIsSaving(true);
      toast.loading(t("common.saving", "Saving layout..."));
      const tablesToSave = editableTables
        .filter((tbl) => String(tbl.floor) === String(currentFloor))
        .map((tbl) => ({
          id: tbl.id,
          pos_x: tbl.pos_x,
          pos_y: tbl.pos_y,
          shape: tbl.shape,
          rotation: tbl.rotation,
        }));

      await saveStoreTablesLayout(currentFloor, tablesToSave, floorSettings);
      await mutate();
      toast.dismiss();
      toast.success(t("tables.layout_saved", "Floor layout saved successfully!"));
      setIsEditMode(false);
    } catch (err) {
      toast.dismiss();
      toast.error(err?.response?.data?.message || t("common.error", "Failed to save layout"));
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTableUpdate = (id, updates) => {
    setEditableTables((prev) =>
      prev.map((tbl) => (tbl.id === id ? { ...tbl, ...updates } : tbl))
    );
  };

  const handleTableDelete = async (table) => {
    const isConfirm = window.confirm(
      t("table_settings.are_you_sure", "Are you sure you want to delete this table?")
    );
    if (!isConfirm) return;

    try {
      toast.loading(t("table_settings.please_wait", "Please wait..."));
      await deleteTable(table.id);
      await mutate();
      setEditableTables((prev) => prev.filter((t) => t.id !== table.id));
      setSelectedTableId(null);
      toast.dismiss();
      toast.success(t("table_settings.store_table_details_deleted", "Table deleted successfully"));
    } catch (err) {
      toast.dismiss();
      toast.error(err?.response?.data?.message || t("table_settings.something_went_wrong"));
    }
  };

  const handleFloorPlanUpload = async (file) => {
    try {
      toast.loading(t("common.uploading", "Uploading floor plan..."));
      const res = await uploadFloorPlanImage(currentFloor, file);
      toast.dismiss();
      if (res?.data?.success) {
        toast.success(t("tables.floor_plan_uploaded", "Floor plan uploaded successfully!"));
        setFloorSettings((prev) => ({
          ...prev,
          floor_plan_image: res.data.imageURL,
        }));
        await mutate();
      }
    } catch (err) {
      toast.dismiss();
      toast.error(err?.response?.data?.message || t("common.error", "Failed to upload floor plan"));
      console.error(err);
    }
  };

  const handleFloorPlanDelete = async () => {
    const isConfirm = window.confirm(
      t("tables.confirm_delete_floor_plan", "Are you sure you want to remove the floor plan image for this floor?")
    );
    if (!isConfirm) return;

    try {
      toast.loading(t("common.deleting", "Removing floor plan..."));
      const res = await deleteFloorPlanImage(currentFloor);
      toast.dismiss();
      if (res?.data?.success) {
        toast.success(t("tables.floor_plan_deleted", "Floor plan removed successfully!"));
        setFloorSettings((prev) => ({
          ...prev,
          floor_plan_image: null,
        }));
        await mutate();
      }
    } catch (err) {
      toast.dismiss();
      toast.error(err?.response?.data?.message || t("common.error", "Failed to remove floor plan"));
      console.error(err);
    }
  };

  // Quick Order Action -> Direct POS Launch
  const handleNewOrder = (orderType, table) => {
    if (orderType === "dine_in" && table) {
      navigate("/dashboard/pos", {
        state: {
          selectedTableId: table.id,
          selectedTableTitle: table.table_title,
          deliveryType: "dinein",
        },
      });
    } else if (orderType === "take_away") {
      navigate("/dashboard/pos", { state: { deliveryType: "takeaway" } });
    } else if (orderType === "delivery") {
      navigate("/dashboard/pos", { state: { deliveryType: "delivery" } });
    } else {
      navigate("/dashboard/pos");
    }
  };

  const handleMoveTable = (table) => {
    if (!table || !table.active_order_id) {
      toast.error(t("tables.select_active_table_to_move", "Please select an active table with an open order to move"));
      return;
    }
    toast(t("tables.select_dest_table", "Tap the empty destination table to transfer order"), { icon: "➡️" });
  };

  const handleSplitChecks = (table) => {
    if (table && table.active_order_id) {
      setActiveDetailsTable(table);
    } else {
      navigate("/dashboard/orders");
    }
  };

  const handleSeatReservation = (res) => {
    if (selectedTable) {
      toast.success(
        t("tables.reservation_seated_at_table", `Seated ${res.customer_name || "Guest"} at Table ${selectedTable.table_title}`)
      );
      handleNewOrder("dine_in", selectedTable);
    } else {
      toast(t("tables.select_table_first_to_seat", "Select a table on the floor plan first, then click Seat"), {
        icon: "🪑",
      });
    }
  };

  return (
    <Page className="h-[calc(100vh-65px)] max-h-[calc(100vh-65px)] flex flex-col p-0 overflow-hidden w-full bg-[#f8fafc] dark:bg-zinc-950">
      {/* 1. Top Zone & Order Counters Bar */}
      <BindoTopBar
        zones={zones}
        currentZone={currentFloor}
        onSelectZone={(zone) => {
          if (isEditMode) {
            const confirmChange = window.confirm(
              t("tables.switch_floor_warning", "You have unsaved changes. Switch floor anyway?")
            );
            if (!confirmChange) return;
          }
          setCurrentFloor(zone);
          setSelectedTableId(null);
        }}
        onAddZone={() => {
          const nextZone = prompt(t("tables.enter_zone_name", "Enter new Zone / Floor:"));
          if (nextZone && nextZone.trim()) {
            setCurrentFloor(nextZone.trim());
          }
        }}
        isEditMode={isEditMode}
        onEnterEditMode={handleEnterEditMode}
        onSaveEditMode={handleSaveLayout}
        onCancelEditMode={handleCancelEditMode}
        dineInCount={dineInCount}
        pickUpCount={pickUpCount}
        isSocketConnected={isSocketConnected}
        isSaving={isSaving}
        isDrawerOpen={isDrawerOpen}
        onToggleDrawer={() => setIsDrawerOpen((prev) => !prev)}
      />

      {/* 2. Main Floor Plan Canvas & Right Drawer */}
      <div className="relative flex-1 flex overflow-hidden w-full">
        {/* Floor Plan Canvas */}
        <div className="flex-1 h-full relative overflow-hidden">
          <FloorPlanCanvas
            tables={tablesOnFloor}
            floorSettings={floorSettings}
            mergedPairs={mergedPairs}
            isMergeMode={isMergeMode}
            mergeSourceId={mergeSourceId}
            isEditMode={isEditMode}
            selectedTableId={selectedTableId}
            activeFilter={activeFilter}
            onSelectTable={(id) => setSelectedTableId(id)}
            onTableClick={handleTableClick}
            onTableUpdate={handleTableUpdate}
            onTableDelete={handleTableDelete}
            onOpenEditModal={(table) => {
              setEditingTableData(table);
              setIsAddEditModalOpen(true);
            }}
            onFloorSettingsChange={setFloorSettings}
            onFloorPlanUpload={handleFloorPlanUpload}
            onFloorPlanDelete={handleFloorPlanDelete}
            canvasHeight="100%"
          />
        </div>

        {/* Right Sliding Drawer */}
        {isDrawerOpen && (
          <BindoActionDrawer
            isOpen={isDrawerOpen}
            onClose={() => setIsDrawerOpen(false)}
            activeTab={drawerMode}
            onTabChange={(tab) => setDrawerMode(tab)}
            selectedTable={selectedTable}
            isMergeMode={isMergeMode}
            onToggleMergeMode={() => {
              setIsMergeMode((prev) => !prev);
              setMergeSourceId(null);
            }}
            onMoveTable={handleMoveTable}
            onSplitChecks={handleSplitChecks}
            onMoveLineItem={() => toast(t("tables.move_line_item_hint", "Select item in order modal to transfer"))}
            onNewOrder={handleNewOrder}
            onReservationOverview={() => navigate("/dashboard/reservation")}
            onPrintReservation={() => window.print()}
            reservations={todayReservations}
            queueList={[]}
            seatedTables={seatedTablesList}
            pendingOrders={[]}
            onSeatReservation={handleSeatReservation}
            currency={currency}
          />
        )}
      </div>

      {/* 3. Bottom Status Bar & Live KPI Counters */}
      <BindoBottomBar
        metrics={bindoMetrics}
        activeFilter={activeFilter}
        onSelectFilter={(key) => setActiveFilter(key)}
        onRefresh={() => mutate()}
        isRefreshing={isLoading}
        isDrawerOpen={isDrawerOpen}
        onToggleDrawer={() => setIsDrawerOpen((prev) => !prev)}
        onOpenOptionsMenu={() => {
          setEditingTableData(null);
          setIsAddEditModalOpen(true);
        }}
      />

      {/* Add / Edit Table Modal */}
      <AddEditTableModal
        isOpen={isAddEditModalOpen}
        onClose={() => {
          setIsAddEditModalOpen(false);
          setEditingTableData(null);
        }}
        tableData={editingTableData}
        currentFloor={currentFloor}
        onSave={async (formData) => {
          try {
            if (formData.id) {
              await updateStoreTable(
                formData.id,
                formData.table_title,
                formData.floor,
                formData.seating_capacity,
                formData.shape,
                formData.rotation
              );
              toast.success(t("table_settings.store_table_details_updated"));
            } else {
              await addNewStoreTable(
                formData.table_title,
                formData.floor,
                formData.seating_capacity,
                formData.shape,
                formData.rotation,
                240,
                160
              );
              toast.success(t("table_settings.store_table_added"));
            }
            await mutate();
          } catch (err) {
            toast.error(err?.response?.data?.message || t("common.error"));
          }
        }}
      />

      {/* Active Table Order Details Modal */}
      {activeDetailsTable && (
        <TableDetailsModal
          table={activeDetailsTable}
          currency={currency}
          onClose={() => setActiveDetailsTable(null)}
          onUpdate={() => mutate()}
        />
      )}
    </Page>
  );
}
