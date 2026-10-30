import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  IconSearch,
  IconUsersGroup,
  IconPencil,
  IconTrash,
  IconEye,
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
} from "@tabler/icons-react";
import { clsx } from "clsx";
import { toast } from "react-hot-toast";

import Page from "../../components/Page";
import DeleteModal from "../../components/DeleteModal";
import { iconStroke } from "../../config/config";
import { useTheme } from "../../contexts/ThemeContext";
import useDebounce from "../../utils/useDebounce";
import {
  getBusinessGroups,
  createBusinessGroup,
  updateBusinessGroup,
  deleteBusinessGroup,
} from "../../controllers/business_group.controller";

/**
 * Business Groups (Phase 1) — Super Admin only.
 * Lists groups with their member count; create/edit via modal, delete via the
 * shared DeleteModal. Group membership is managed on the details page.
 */
export default function SuperAdminBusinessGroupsPage() {
  const { t } = useTranslation();
  const { theme } = useTheme();

  // Create
  const nameRef = useRef();
  const descriptionRef = useRef();
  const maxBranchesRef = useRef();

  // Update
  const [groupIdForUpdate, setGroupIdForUpdate] = useState(null);
  const updateNameRef = useRef();
  const updateDescriptionRef = useRef();
  const updateMaxBranchesRef = useRef();

  // Delete
  const [groupForDelete, setGroupForDelete] = useState(null);

  const [state, setState] = useState({
    groups: [],
    search: "",
    page: 1,
    perPage: 10,
    totalPages: 1,
    total: 0,
    isLoading: true,
  });

  const fetchData = async () => {
    try {
      const { data } = await getBusinessGroups({
        page: state.page,
        perPage: state.perPage,
        search: state.search,
      });

      if (data) {
        setState((prevState) => ({
          ...prevState,
          groups: data.groups || [],
          page: data.currentPage,
          perPage: data.perPage,
          totalPages: data.totalPages,
          total: data.total,
          isLoading: false,
        }));
      }
    } catch (error) {
      console.error(error);
      setState((prevState) => ({ ...prevState, isLoading: false }));
      toast.dismiss();
      toast.error(
        error?.response?.data?.message ||
          t("superadmin_business_groups.error_loading_groups", "Error loading business groups"),
      );
    }
  };

  useEffect(() => {
    fetchData();
  }, [state.page, state.perPage]);

  useDebounce(
    () => {
      fetchData();
    },
    [state.search],
    800,
  );

  const handleSearchChange = (event) => {
    setState((prevState) => ({
      ...prevState,
      search: event.target.value,
      page: 1,
    }));
  };

  const btnPaginationFirstPage = () => {
    setState((prevState) => ({ ...prevState, page: 1 }));
  };

  const btnPaginationLastPage = () => {
    setState((prevState) => ({ ...prevState, page: prevState.totalPages || 1 }));
  };

  const btnPaginationNextPage = () => {
    setState((prevState) =>
      prevState.page < prevState.totalPages
        ? { ...prevState, page: prevState.page + 1 }
        : prevState,
    );
  };

  const btnPaginationPreviousPage = () => {
    setState((prevState) =>
      prevState.page > 1 ? { ...prevState, page: prevState.page - 1 } : prevState,
    );
  };

  const btnAdd = async () => {
    const name = nameRef.current.value?.trim();
    const description = descriptionRef.current.value?.trim();
    const maxBranches = parseInt(maxBranchesRef.current?.value, 10) || 5;

    if (!name) {
      toast.error(
        t("superadmin_business_groups.please_provide_name", "Please provide a business group name"),
      );
      return;
    }

    try {
      toast.loading(t("superadmin_business_groups.please_wait", "Please wait..."));
      const res = await createBusinessGroup(name, description, maxBranches);

      if (res.status == 200) {
        nameRef.current.value = null;
        descriptionRef.current.value = null;
        if (maxBranchesRef.current) maxBranchesRef.current.value = 5;

        document.getElementById("modal-add-business-group").close();
        await fetchData();

        toast.dismiss();
        toast.success(res.data.message);
      }
    } catch (error) {
      console.error(error);
      const message =
        error?.response?.data?.message ||
        t("superadmin_business_groups.something_went_wrong", "Something went wrong!");

      toast.dismiss();
      toast.error(message);
    }
  };

  const btnShowUpdate = (group) => {
    updateNameRef.current.value = group.name || "";
    updateDescriptionRef.current.value = group.description || "";
    if (updateMaxBranchesRef.current) {
      updateMaxBranchesRef.current.value = group.max_branches || 5;
    }

    setGroupIdForUpdate(group.id);

    document.getElementById("modal-update-business-group").showModal();
  };

  const btnUpdate = async () => {
    const name = updateNameRef.current.value?.trim();
    const description = updateDescriptionRef.current.value?.trim();
    const maxBranches = parseInt(updateMaxBranchesRef.current?.value, 10) || 5;

    if (!name) {
      toast.error(
        t("superadmin_business_groups.please_provide_name", "Please provide a business group name"),
      );
      return;
    }

    try {
      toast.loading(t("superadmin_business_groups.please_wait", "Please wait..."));
      const res = await updateBusinessGroup(groupIdForUpdate, name, description, maxBranches);

      if (res.status == 200) {
        document.getElementById("modal-update-business-group").close();
        setGroupIdForUpdate(null);
        await fetchData();

        toast.dismiss();
        toast.success(res.data.message);
      }
    } catch (error) {
      console.error(error);
      const message =
        error?.response?.data?.message ||
        t("superadmin_business_groups.something_went_wrong", "Something went wrong!");

      toast.dismiss();
      toast.error(message);
    }
  };

  const btnDelete = async (groupId) => {
    try {
      toast.loading(t("superadmin_business_groups.please_wait", "Please wait..."));
      const res = await deleteBusinessGroup(groupId);

      if (res.status == 200) {
        await fetchData();
        toast.dismiss();
        toast.success(res.data.message);
      }
    } catch (error) {
      console.error(error);
      const message =
        error?.response?.data?.message ||
        t("superadmin_business_groups.something_went_wrong", "Something went wrong!");

      toast.dismiss();
      toast.error(message);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
            <span>Dashboard</span>
            <span>/</span>
            <span>Business Management</span>
            <span>/</span>
            <span className="font-semibold text-gray-700 dark:text-gray-300">
              {t("superadmin_business_groups.title", "Business Groups")}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              {t("superadmin_business_groups.title", "Business Groups")}
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
              {state.total} Total
            </span>
          </div>
        </div>

        <button
          onClick={() =>
            document.getElementById("modal-add-business-group").showModal()
          }
          className="inline-flex items-center gap-2 bg-[#2CA01C] hover:bg-[#248417] text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-full shadow-sm hover:shadow transition active:scale-95"
        >
          <span>{t("superadmin_business_groups.create_group", "+ Create Group")}</span>
        </button>
      </div>

      <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-gray-800 rounded-xl shadow-xs overflow-hidden">
        <div className="p-3.5 sm:p-4 border-b border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#FAFBFD] dark:bg-[#161B22]">
          <div className="relative flex-1 max-w-sm">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              <IconSearch size={16} stroke={iconStroke} />
            </div>
            <input
              type="search"
              placeholder={t(
                "superadmin_business_groups.search_placeholder",
                "Search business groups...",
              )}
              value={state.search}
              onChange={handleSearchChange}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2CA01C] focus:border-[#2CA01C] transition"
            />
          </div>
        </div>

        {state.isLoading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2">
            <span className="w-8 h-8 animate-spin rounded-full border-2 border-gray-300 border-t-[#2CA01C]" />
            <p className="text-xs text-gray-500">Loading business groups...</p>
          </div>
        ) : state.groups.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center px-4">
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3 text-gray-400">
              <IconUsersGroup size={24} stroke={iconStroke} />
            </div>
            <p className="font-semibold text-sm text-gray-900 dark:text-white mb-1">
              {t("superadmin_business_groups.no_groups_found", "No business groups found")}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 bg-[#F8F9FA] dark:bg-[#161B22] text-gray-600 dark:text-gray-400 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4 min-w-[220px]">
                    {t("superadmin_business_groups.group_name", "Group Name")}
                  </th>
                  <th className="py-3 px-4 min-w-[140px]">
                    {t("superadmin_business_groups.branches_count", "Branches / Quota")}
                  </th>
                  <th className="py-3 px-4 min-w-[140px]">
                    {t("superadmin_business_groups.created_date", "Created Date")}
                  </th>
                  <th className="py-3 px-4 text-right min-w-[130px]">
                    {t("superadmin_business_groups.actions", "Actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {state.groups.map((group) => (
                  <tr
                    key={group.id}
                    className="hover:bg-[#F9FAFB] dark:hover:bg-[#1C2128] transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/60 dark:border-emerald-800/60 text-[#2CA01C] flex items-center justify-center shrink-0">
                          <IconUsersGroup size={18} stroke={iconStroke} />
                        </div>
                        <div className="truncate">
                          <div className="font-semibold text-gray-900 dark:text-white text-xs sm:text-sm truncate">
                            {group.name}
                          </div>
                          <div className="text-[11px] text-gray-500 font-normal truncate">
                            {group.description || "-"}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                        {group.businesses_count} / {group.max_branches || 5} Branches
                      </span>
                    </td>

                    <td className="py-3 px-4 text-gray-600 dark:text-gray-300 font-medium">
                      {group.created_at
                        ? new Date(group.created_at).toLocaleDateString()
                        : "-"}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1 justify-end">
                        <Link
                          to={`/superadmin/dashboard/business-groups/${group.id}`}
                          title={t("superadmin_business_groups.view_details", "View Details")}
                          className="h-7 px-2.5 rounded-md border border-emerald-200 dark:border-emerald-800 text-[#108000] dark:text-[#2CA01C] hover:bg-emerald-50 dark:hover:bg-emerald-950/50 font-semibold text-xs flex items-center gap-1 transition"
                        >
                          <IconEye size={13} stroke={iconStroke} />
                          <span>View</span>
                        </Link>
                        <button
                          onClick={() => btnShowUpdate(group)}
                          title={t("superadmin_business_groups.edit", "Edit")}
                          className="h-7 w-7 rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center transition"
                        >
                          <IconPencil size={14} stroke={iconStroke} />
                        </button>
                        <button
                          onClick={() => setGroupForDelete(group)}
                          title={t("superadmin_business_groups.delete", "Delete")}
                          className="h-7 w-7 rounded-md border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center justify-center transition"
                        >
                          <IconTrash size={14} stroke={iconStroke} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800 bg-[#FAFBFD] dark:bg-[#161B22] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600 dark:text-gray-400">
          <div>
            {t("superadmin_business_groups.showing", "Showing")} {state.groups.length}{" "}
            {t("superadmin_business_groups.of", "of")} {state.total}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={btnPaginationFirstPage}
              disabled={state.page <= 1}
              className="p-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <IconChevronsLeft size={14} stroke={iconStroke} />
            </button>
            <button
              onClick={btnPaginationPreviousPage}
              disabled={state.page <= 1}
              className="p-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <IconChevronLeft size={14} stroke={iconStroke} />
            </button>
            <span className="px-2.5 py-1 text-xs font-semibold rounded bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200">
              {state.page} / {state.totalPages}
            </span>
            <button
              onClick={btnPaginationNextPage}
              disabled={state.page >= state.totalPages}
              className="p-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <IconChevronRight size={14} stroke={iconStroke} />
            </button>
            <button
              onClick={btnPaginationLastPage}
              disabled={state.page >= state.totalPages}
              className="p-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <IconChevronsRight size={14} stroke={iconStroke} />
            </button>
          </div>
        </div>
      </div>

      {/* modal add */}
      <dialog
        id="modal-add-business-group"
        className="modal modal-bottom sm:modal-middle"
      >
        <div className="modal-box border border-restro-border-green dark:rounded-2xl">
          <h3 className="font-bold text-lg">
            {t("superadmin_business_groups.create_group", "Create Group")}
          </h3>

          <div className="mt-4">
            <label htmlFor="name" className="mb-1 block text-gray-500 text-sm">
              {t("superadmin_business_groups.group_name_label", "Business Group Name")}{" "}
              <span className="text-xs text-gray-400">
                {t("superadmin_business_groups.required", "Required")}
              </span>
            </label>
            <input
              ref={nameRef}
              type="text"
              name="name"
              maxLength={100}
              className="text-sm w-full rounded-lg px-4 py-2 border border-restro-border-green dark:bg-black focus:outline-restro-border-green"
              placeholder={t(
                "superadmin_business_groups.enter_group_name",
                "Enter business group name",
              )}
            />
          </div>

          <div className="mt-4">
            <label
              htmlFor="description"
              className="mb-1 block text-gray-500 text-sm"
            >
              {t("superadmin_business_groups.description", "Description")}
            </label>
            <textarea
              ref={descriptionRef}
              name="description"
              rows={3}
              maxLength={500}
              className="text-sm w-full rounded-lg px-4 py-2 border border-restro-border-green dark:bg-black focus:outline-restro-border-green"
              placeholder={t(
                "superadmin_business_groups.enter_description",
                "Enter description",
              )}
            />
          </div>

          <div className="mt-4">
            <label
              htmlFor="maxBranches"
              className="mb-1 block text-gray-500 text-sm"
            >
              {t("superadmin_business_groups.branch_limit", "Branch Limit (Max Outlets)")}
            </label>
            <input
              ref={maxBranchesRef}
              type="number"
              name="maxBranches"
              min={1}
              defaultValue={5}
              className="text-sm w-full rounded-lg px-4 py-2 border border-restro-border-green dark:bg-black focus:outline-restro-border-green"
              placeholder="5"
            />
          </div>

          <div className="modal-action mt-4">
            <form method="dialog">
              {/* if there is a button in form, it will close the modal */}
              <button className="btn transition active:scale-95 hover:shadow-lg px-4 py-3 rounded-xl border border-restro-border-green bg-restro-card-bg hover:bg-restro-button-hover text-restro-text">
                {t("superadmin_business_groups.close", "Close")}
              </button>
            </form>
            <button
              onClick={btnAdd}
              className="btn ml-2 rounded-xl transition active:scale-95 hover:shadow-lg px-4 py-3 text-white border border-restro-border-green bg-restro-green hover:bg-restro-green-button-hover"
            >
              {t("superadmin_business_groups.save", "Save")}
            </button>
          </div>
        </div>
      </dialog>
      {/* modal add */}

      {/* modal update */}
      <dialog
        id="modal-update-business-group"
        className="modal modal-bottom sm:modal-middle"
      >
        <div className="modal-box border border-restro-border-green dark:rounded-2xl">
          <h3 className="font-bold text-lg">
            {t("superadmin_business_groups.edit_group", "Edit Business Group")}
          </h3>

          <div className="mt-4">
            <label htmlFor="name" className="mb-1 block text-gray-500 text-sm">
              {t("superadmin_business_groups.group_name_label", "Business Group Name")}{" "}
              <span className="text-xs text-gray-400">
                {t("superadmin_business_groups.required", "Required")}
              </span>
            </label>
            <input
              ref={updateNameRef}
              type="text"
              name="name"
              maxLength={100}
              className="text-sm w-full rounded-lg px-4 py-2 border border-restro-border-green dark:bg-black focus:outline-restro-border-green"
              placeholder={t(
                "superadmin_business_groups.enter_group_name",
                "Enter business group name",
              )}
            />
          </div>

          <div className="mt-4">
            <label
              htmlFor="description"
              className="mb-1 block text-gray-500 text-sm"
            >
              {t("superadmin_business_groups.description", "Description")}
            </label>
            <textarea
              ref={updateDescriptionRef}
              name="description"
              rows={3}
              maxLength={500}
              className="text-sm w-full rounded-lg px-4 py-2 border border-restro-border-green dark:bg-black focus:outline-restro-border-green"
              placeholder={t(
                "superadmin_business_groups.enter_description",
                "Enter description",
              )}
            />
          </div>

          <div className="mt-4">
            <label
              htmlFor="updateMaxBranches"
              className="mb-1 block text-gray-500 text-sm"
            >
              {t("superadmin_business_groups.branch_limit", "Branch Limit (Max Outlets)")}
            </label>
            <input
              ref={updateMaxBranchesRef}
              type="number"
              name="updateMaxBranches"
              min={1}
              defaultValue={5}
              className="text-sm w-full rounded-lg px-4 py-2 border border-restro-border-green dark:bg-black focus:outline-restro-border-green"
              placeholder="5"
            />
          </div>

          <div className="modal-action mt-4">
            <form method="dialog">
              {/* if there is a button in form, it will close the modal */}
              <button className="btn transition active:scale-95 hover:shadow-lg px-4 py-3 rounded-xl border border-restro-border-green bg-restro-card-bg hover:bg-restro-button-hover text-restro-text">
                {t("superadmin_business_groups.close", "Close")}
              </button>
            </form>
            <button
              onClick={btnUpdate}
              className="btn ml-2 rounded-xl transition active:scale-95 hover:shadow-lg px-4 py-3 text-white border border-restro-border-green bg-restro-green hover:bg-restro-green-button-hover"
            >
              {t("superadmin_business_groups.save", "Save")}
            </button>
          </div>
        </div>
      </dialog>
      {/* modal update */}

      {/* Delete Confirmation Modal */}
      <DeleteModal
        isOpen={Boolean(groupForDelete)}
        onClose={() => setGroupForDelete(null)}
        onConfirm={async () => {
          const id = groupForDelete?.id;
          setGroupForDelete(null);
          await btnDelete(id);
        }}
        title={t("superadmin_business_groups.are_you_sure", "Are you sure?")}
        description={t(
          "superadmin_business_groups.delete_group_description",
          "This will delete the business group. The linked businesses themselves are NOT deleted — they are simply removed from this group.",
        )}
        itemName={groupForDelete?.name}
        confirmText={t("superadmin_business_groups.yes_delete", "Yes, Delete")}
        cancelText={t("superadmin_business_groups.cancel", "Cancel")}
      />
    </div>
  );
}
