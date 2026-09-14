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

  // Update
  const [groupIdForUpdate, setGroupIdForUpdate] = useState(null);
  const updateNameRef = useRef();
  const updateDescriptionRef = useRef();

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

    if (!name) {
      toast.error(
        t("superadmin_business_groups.please_provide_name", "Please provide a business group name"),
      );
      return;
    }

    try {
      toast.loading(t("superadmin_business_groups.please_wait", "Please wait..."));
      const res = await createBusinessGroup(name, description);

      if (res.status == 200) {
        nameRef.current.value = null;
        descriptionRef.current.value = null;

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

    setGroupIdForUpdate(group.id);

    document.getElementById("modal-update-business-group").showModal();
  };

  const btnUpdate = async () => {
    const name = updateNameRef.current.value?.trim();
    const description = updateDescriptionRef.current.value?.trim();

    if (!name) {
      toast.error(
        t("superadmin_business_groups.please_provide_name", "Please provide a business group name"),
      );
      return;
    }

    try {
      toast.loading(t("superadmin_business_groups.please_wait", "Please wait..."));
      const res = await updateBusinessGroup(groupIdForUpdate, name, description);

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
    <Page className="px-4 py-3 overflow-x-hidden h-full">
      <div className="flex gap-6 items-center mb-6 mt-6">
        <h1 className="text-2xl font-semibold">
          {t("superadmin_business_groups.title", "Business Groups")}
        </h1>
        <button
          onClick={() =>
            document.getElementById("modal-add-business-group").showModal()
          }
          className="bg-restro-green text-white text-sm px-6 py-2 rounded-[42px] hover:bg-restro-green/80"
        >
          {t("superadmin_business_groups.create_group", "Create Group")}
        </button>
      </div>

      <div className="flex flex-col px-6 py-6 border border-restro-border-green rounded-3xl">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-2">
          <label className="flex-grow bg-restro-gray rounded-[42px] px-3 py-2 text-gray-500 flex items-center gap-2 w-full sm:w-80">
            <IconSearch size={16} stroke={iconStroke} />
            <input
              type="search"
              placeholder={t(
                "superadmin_business_groups.search_placeholder",
                "Search business groups...",
              )}
              value={state.search}
              onChange={handleSearchChange}
              className="w-full bg-transparent outline-none text-sm"
            />
          </label>
        </div>

        {state.isLoading ? (
          <div className="text-center w-full h-[50vh] flex flex-col items-center justify-center text-gray-500">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-primary" />
          </div>
        ) : state.groups.length === 0 ? (
          <div className="text-center w-full h-[50vh] flex flex-col items-center justify-center text-gray-500">
            <p>
              {t("superadmin_business_groups.no_groups_found", "No business groups found")}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-auto w-full border-separate border-spacing-y-1">
              <thead className="bg-transparent">
                <tr>
                  <th className="rounded-[42px] px-3 flex items-center justify-between">
                    <div className="text-start px-0 py-1 w-1/3 min-w-[250px] max-w-[320px] text-sm md:text-sm lg:text-base">
                      {t("superadmin_business_groups.group_name", "Name")}
                    </div>
                    <div className="px-2 py-1 w-1/4 min-w-[140px] max-w-[180px] text-sm md:text-sm lg:text-base">
                      {t("superadmin_business_groups.businesses_count", "Businesses")}
                    </div>
                    <div className="px-2 py-1 w-1/4 min-w-[150px] max-w-[200px] text-sm md:text-sm lg:text-base">
                      {t("superadmin_business_groups.created_date", "Created Date")}
                    </div>
                    <div className="px-2 py-1 w-1/4 min-w-[150px] max-w-[200px] text-sm md:text-sm lg:text-base mr-8">
                      {t("superadmin_business_groups.actions", "Actions")}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {state.groups.map((group) => (
                  <tr key={group.id}>
                    <td className="py-1">
                      <div className="bg-gray-100 dark:bg-restro-card-bg rounded-[42px] px-3 flex items-center justify-between">
                        <div className="flex items-center py-2 w-1/3 min-w-[250px] max-w-[320px]">
                          <div className="bg-gray-50 dark:bg-restro-bg-gray rounded-[42px] p-6 mr-4">
                            <IconUsersGroup size={18} stroke={iconStroke} />
                          </div>
                          <div>
                            <div className="font-bold text-sm">{group.name}</div>
                            <div className="text-xs font-semibold text-gray-500">
                              {group.description || "-"}
                            </div>
                          </div>
                        </div>
                        <div className="w-1/4 min-w-[140px] max-w-[180px] flex items-center justify-center">
                          <span className="px-4 py-2 text-sm rounded-[42px] bg-white dark:bg-restro-gray font-bold">
                            {group.businesses_count}
                          </span>
                        </div>
                        <div className="w-1/4 min-w-[150px] max-w-[200px] text-center text-sm font-bold">
                          {group.created_at
                            ? new Date(group.created_at).toLocaleDateString()
                            : "-"}
                        </div>
                        <div className="w-1/4 min-w-[150px] max-w-[200px] text-right">
                          <div className="flex gap-3">
                            <Link
                              to={`/superadmin/dashboard/business-groups/${group.id}`}
                              title={t("superadmin_business_groups.view_details", "View Details")}
                              className="rounded-[42px] flex items-center justify-center bg-white dark:bg-restro-bg-gray p-3 text-restro-text"
                            >
                              <IconEye size={24} stroke={iconStroke} />
                            </Link>
                            <button
                              onClick={() => btnShowUpdate(group)}
                              title={t("superadmin_business_groups.edit", "Edit")}
                              className="rounded-[42px] bg-white dark:bg-restro-bg-gray p-3 text-restro-text"
                            >
                              <IconPencil size={24} stroke={iconStroke} />
                            </button>
                            <button
                              onClick={() => setGroupForDelete(group)}
                              title={t("superadmin_business_groups.delete", "Delete")}
                              className="rounded-[42px] bg-white p-3 text-red-500 dark:bg-restro-gray"
                            >
                              <IconTrash size={24} stroke={iconStroke} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* pagination */}
        <div className="flex justify-end mt-8">
          <div className="join">
            <button
              onClick={btnPaginationFirstPage}
              disabled={state.page <= 1}
              className={clsx("join-item btn btn-sm", {
                "bg-restro-bg-card-dark-mode text-gray-200": theme === "black" && state.page > 1,
                "bg-white text-gray-800": theme !== "black" && state.page > 1,
                "bg-restro-bg-card-dark-mode text-gray-400 cursor-not-allowed":
                  theme === "black" && state.page <= 1,
                "bg-gray-100 text-gray-400 cursor-not-allowed":
                  theme !== "black" && state.page <= 1,
              })}
            >
              <IconChevronsLeft stroke={iconStroke} />
            </button>
            <button
              onClick={btnPaginationPreviousPage}
              disabled={state.page <= 1}
              className={clsx("join-item btn btn-sm", {
                "bg-restro-bg-card-dark-mode text-gray-200": theme === "black" && state.page > 1,
                "bg-white text-gray-800": theme !== "black" && state.page > 1,
                "bg-restro-bg-card-dark-mode text-gray-400 cursor-not-allowed":
                  theme === "black" && state.page <= 1,
                "bg-gray-100 text-gray-400 cursor-not-allowed":
                  theme !== "black" && state.page <= 1,
              })}
            >
              <IconChevronLeft stroke={iconStroke} />
            </button>
            <button
              className={clsx("join-item btn btn-sm", {
                "bg-restro-bg-card-dark-mode text-gray-200": theme === "black",
                "bg-white text-gray-800": theme !== "black",
              })}
            >
              {t("superadmin_business_groups.showing", "Showing")} {state.groups.length}{" "}
              {t("superadmin_business_groups.of", "of")} {state.total}
            </button>
            <button
              onClick={btnPaginationNextPage}
              disabled={state.page >= state.totalPages}
              className={clsx("join-item btn btn-sm", {
                "bg-restro-bg-card-dark-mode text-gray-200":
                  theme === "black" && state.page < state.totalPages,
                "bg-white text-gray-800": theme !== "black" && state.page < state.totalPages,
                "bg-restro-bg-card-dark-mode text-gray-400 cursor-not-allowed":
                  theme === "black" && state.page >= state.totalPages,
                "bg-gray-100 text-gray-400 cursor-not-allowed":
                  theme !== "black" && state.page >= state.totalPages,
              })}
            >
              <IconChevronRight stroke={iconStroke} />
            </button>
            <button
              onClick={btnPaginationLastPage}
              disabled={state.page >= state.totalPages}
              className={clsx("join-item btn btn-sm", {
                "bg-restro-bg-card-dark-mode text-gray-200":
                  theme === "black" && state.page < state.totalPages,
                "bg-white text-gray-800": theme !== "black" && state.page < state.totalPages,
                "bg-restro-bg-card-dark-mode text-gray-400 cursor-not-allowed":
                  theme === "black" && state.page >= state.totalPages,
                "bg-gray-100 text-gray-400 cursor-not-allowed":
                  theme !== "black" && state.page >= state.totalPages,
              })}
            >
              <IconChevronsRight stroke={iconStroke} />
            </button>
          </div>
        </div>
        <div className="text-end mt-4">
          <p>
            {t("superadmin_business_groups.showing", "Showing")} {state.groups.length}{" "}
            {t("superadmin_business_groups.of", "of")} {state.total}
          </p>
        </div>
        {/* pagination */}
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
    </Page>
  );
}
