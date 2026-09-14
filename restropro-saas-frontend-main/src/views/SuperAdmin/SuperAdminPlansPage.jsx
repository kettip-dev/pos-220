import React, { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import Page from "../../components/Page";
import DeleteModal from "../../components/DeleteModal";
import {
  IconSearch,
  IconFilter,
  IconCheck,
  IconX,
  IconPencil,
  IconEye,
  IconTrash,
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconAlertTriangleFilled,
  IconSparkles,
  IconPlus,
  IconTag,
  IconGlobe,
  IconPackage,
  IconCreditCard,
  IconStar,
  IconClock,
} from "@tabler/icons-react";
import { iconStroke, subscriptionPrice } from "../../config/config";
import {
  getTenantsDataByStatus,
  activatePaymentGateway,
} from "../../controllers/superadmin.controller";
import { toast } from "react-hot-toast";
import { Link } from "react-router-dom";
import { useTheme } from "../../contexts/ThemeContext";
import { clsx } from "clsx";
import {
  addPlan,
  createPaystackPlan,
  deletePlan,
  deletePaystackPlan,
  getPlans,
  updatePlan,
  updatePaystackPlan,
} from "../../controllers/plans.controller";
import { PLAN_FEATURES, SCOPES } from "../../config/scopes";
import { STRIPE_SUPPORTCURRENCIES, PAYSTACK_SUPPORTCURRENCIES } from "../../config/currencies.config";

export default function SuperAdminTenantsPage() {
  const { t } = useTranslation();
  const { theme } = useTheme();

  // For Delete
  const [planDeleteId, setPlanDeleteId] = useState(null);

  const [title, setTitle] = useState("");
  const [featuresDescription, setFeaturesDescription] = useState([]);
  const [featureInput, setFeatureInput] = useState("");
  const [features, setFeatures] = useState([]);
  const [isTrial, setIsTrial] = useState(false);
  const [trialDays, setTrialDays] = useState("");
  const [isRecommended, setIsRecommended] = useState(false);
  const [discount, setDiscount] = useState("");
  const [yearlyDiscount, setYearlyDiscount] = useState("");
  const [isAddingPlan, setIsAddingPlan] = useState(false);
  const [currencies, setCurrencies] = useState([
    {
      country: "",
      currency: "",
      symbol: "",
      monthly: "",
      yearly: "",
      is_default: false,
    },
  ]);
  const selectedCountries = currencies.map((c) => c.country).filter(Boolean);

  const [plans, setPlans] = useState([]);
  const [planLoading, setPlanLoading] = useState(false);
  const [planPage, setPlanPage] = useState(1);
  const [planPerPage, setPlanPerPage] = useState(4);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const [activePaymentGatewayName, setActivePaymentGatewayName] = useState("");
  const [editPlanId, setEditPlanId] = useState(null);

  const CURRENCIESWITHNAME = useMemo(() => {
    const gatewayName = activePaymentGatewayName?.gateway_name?.toLowerCase();
    if (gatewayName === "paystack") {
      return PAYSTACK_SUPPORTCURRENCIES;
    }
    return STRIPE_SUPPORTCURRENCIES;
  }, [activePaymentGatewayName]);

  // Check if payment gateway is Paystack
  const isPaystack = useMemo(() => {
    return activePaymentGatewayName?.gateway_name?.toLowerCase() === "paystack";
  }, [activePaymentGatewayName]);

  const openEditDialog = (plan) => {
    setTitle(plan.title);
    setFeaturesDescription(plan.features_description || []);
    setFeatures(plan.features || []);
    setIsTrial(plan.is_trial === 1);
    setTrialDays(plan.trial_days || "");
    setIsRecommended(plan.is_recommended === 1);
    setDiscount(plan.discount || "");
    setCurrencies(
      plan.currencies?.length
        ? plan.currencies
        : [
          {
            country: "",
            currency: "",
            symbol: "",
            monthly: "",
            yearly: "",
            is_default: false,
          },
        ]
    );

    setEditPlanId(plan.id);
    document.getElementById("modal-edit").showModal();
  };

  const handleUpdate = async () => {
    if (!editPlanId) return;

    if (!title?.trim()) {
      return toast.error(t("superadmin_plans.please_provide_name"));
    }
    if (!featuresDescription?.length) {
      return toast.error(
        t("superadmin_plans.please_provide_feature_description")
      );
    }
    if (!features?.length) {
      return toast.error(t("superadmin_plans.please_provide_feature"));
    }
    try {
      const payload = {
        title,
        features_description: featuresDescription,
        features,
        trial_days: isTrial ? Number(trialDays) : null,
        is_trial: isTrial ? 1 : 0,
        is_recommended: isRecommended ? 1 : 0,
        discount: discount ? Number(discount) : 0,
        currencies,
      };

      let res;
      if (isPaystack) {
        // When Paystack is the active gateway, update plan via Paystack API
        res = await updatePaystackPlan(editPlanId, payload);
      } else {
        res = await updatePlan(editPlanId, payload);
      }
      toast.success(t("superadmin_plans.plan_updated_successfully"));
      setSearch("");

      await fetchPlans();
      document.getElementById("modal-edit").close();
    } catch (err) {
      toast.error(err.message || t("superadmin_plans.failed_to_update_plan"));
    }
  };

  const resetAddPlanForm = () => {
    setTitle("");
    setFeaturesDescription([]);
    setFeatureInput("");
    setFeatures([]);
    setIsTrial(false);
    setTrialDays("");
    setIsRecommended(false);
    setDiscount("");
    setYearlyDiscount("");
    setCurrencies([
      {
        country: "",
        currency: "",
        symbol: "",
        monthly: "",
        yearly: "",
        is_default: false,
      },
    ]);
  };

  // Reset trial when Paystack is selected
  useEffect(() => {
    if (isPaystack) {
      setIsTrial(false);
      setTrialDays("");
    }
  }, [isPaystack]);

  const fetchPlans = async () => {
    try {
      setPlanLoading(true);
      const [p, g] = await Promise.allSettled([
        getPlans(),
        activatePaymentGateway(),
      ]);
      p.status === "fulfilled" && setPlans(p.value.data.data);
      g.status === "fulfilled" && setActivePaymentGatewayName(g.value.data);
      setPlanLoading(false);
    } catch (err) {
      toast.error(t("superadmin_plans.failed_to_load_plans"));
    } finally {
      setPlanLoading(false);
    }
  };

  const filteredPlans = plans?.filter((plan) =>
    plan.title.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    fetchPlans();
  }, [planPage, planPerPage]);

  const addFeatureDescription = () => {
    if (!featureInput.trim()) return;
    setFeaturesDescription([...featuresDescription, featureInput.trim()]);
    setFeatureInput("");
  };

  const removeFeatureDescription = (index) => {
    setFeaturesDescription(featuresDescription.filter((_, i) => i !== index));
  };

  const removeFeature = (index) => {
    setFeatures(features.filter((_, i) => i !== index));
  };

  const toggleFeature = (featureValue) => {
    if (features.includes(featureValue)) {
      setFeatures(features.filter((f) => f !== featureValue));
    } else {
      setFeatures([...features, featureValue]);
    }
  };

  const updateCurrency = (index, field, value) => {
    const updated = [...currencies];
    updated[index][field] = value;
    setCurrencies(updated);
  };

  const addCurrencyRow = () => {
    setCurrencies([
      ...currencies,
      {
        country: "",
        currency: "",
        symbol: "",
        monthly: "",
        yearly: "",
        is_default: false,
      },
    ]);
  };

  const removeCurrency = (index) => {
    if (currencies.length === 1) return;
    setCurrencies(currencies.filter((_, i) => i !== index));
  };

  const handleDefaultCheckbox = (selectedIndex) => {
    setCurrencies((prev) =>
      prev.map((price, index) => ({
        ...price,
        is_default:
          index === selectedIndex
            ? !price.is_default // toggle selected
            : false, // force others off
      }))
    );
  };

  const handleKeyPress = (e, action) => {
    if (e.key === "Enter") {
      e.preventDefault();
      action();
    }
  };

  const handleSubmit = async () => {
    try {
      if (!title?.trim()) {
        return toast.error(t("superadmin_plans.please_provide_name"));
      }

      if (!featuresDescription?.length) {
        return toast.error(
          t("superadmin_plans.please_provide_feature_description")
        );
      }

      if (!features?.length) {
        return toast.error(t("superadmin_plans.please_provide_feature"));
      }

      if (!currencies?.length) {
        return toast.error(t("superadmin_plans.please_provide_price"));
      }

      const payload = {
        title,
        features_description: featuresDescription,
        features,
        trial_days: isPaystack ? null : (isTrial ? Number(trialDays) : null),
        is_trial: isPaystack ? 0 : (isTrial ? 1 : 0),
        is_recommended: isRecommended ? 1 : 0,
        discount: discount ? Number(discount) : 0,
        yearlyDiscount: yearlyDiscount ? Number(yearlyDiscount) : 0,
        currencies,
      };

      setIsAddingPlan(true);

      let res;
      if (isPaystack) {
        // When Paystack is the active gateway, create plan via Paystack API
        res = await createPaystackPlan(payload);
      } else {
        res = await addPlan(payload);
      }

      if (res?.status === 200 || res?.data?.success) {
        toast.success(t("superadmin_plans.plan_created_successfully"));
        await fetchPlans();
        document.getElementById("modal-add").close();
        resetAddPlanForm();
        setIsAddingPlan(false);
      }
      // onClose();
    } catch (err) {
      console.error(err);
      toast.error(err.message || t("superadmin_plans.failed_to_create_plan"));
      setIsAddingPlan(false);
    }
  };

  const featuresOptions = Object.values(PLAN_FEATURES);

  const handleSearchChange = (event) => {
    const searchTerm = event.target.value;
    // setState((prevState) => ({
    //   ...prevState,
    //   search: searchTerm,
    //   page: 1,
    // }));
    setSearch(searchTerm);
  };

  // Pagination functions
  const totalPages = Math.ceil(filteredPlans.length / ITEMS_PER_PAGE);
  const paginatedPlans = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredPlans.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredPlans, currentPage]);

  const startItem = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endItem = Math.min(currentPage * ITEMS_PER_PAGE, filteredPlans?.length);

  const isFirstPage = currentPage === 1;
  const isLastPage = currentPage === totalPages;

  const btnShowDelete = (planId) => {
    setPlanDeleteId(planId);
  };

  const btnDelete = async (planId) => {
    try {
      toast.loading(t("superadmin_plans.please_wait"));
      const res = isPaystack
        ? await deletePaystackPlan(planId)
        : await deletePlan(planId);

      if (res.status == 200) {
        await fetchPlans();
        toast.dismiss();
        toast.success(res.data.message);
      }
    } catch (error) {
      console.log(error);
      const message =
        error?.response?.data?.message ||
        t("superadmin_plans.something_went_wrong");
      console.error(error);

      toast.dismiss();
      toast.error(message);
    }
  };

  return (
    <Page className="px-4 py-3 overflow-x-hidden h-full">
      <div className="flex justify-between items-center mb-6 mt-6">
        <h1 className="text-2xl font-semibold capitalize">
          {activePaymentGatewayName?.gateway_name
            ? activePaymentGatewayName?.gateway_name
            : ""}{" "}
          {t("superadmin_plans.title")}
        </h1>
        <button
          onClick={() => {
            resetAddPlanForm();
            document.getElementById("modal-add").showModal();
          }}
          className="bg-restro-green text-white text-sm px-6 py-2 rounded-[42px] hover:bg-restro-green/80"
        >
          {t("superadmin_plans.add_plan")}
        </button>
      </div>

      <div className="flex flex-col px-6 py-6 border border-restro-border-green rounded-3xl">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-2">
          <div className="flex items-center backdrop-blur sticky top-0 z-10 rounded-t-2xl w-full sm:w-auto gap-2">
            <label className="flex-grow bg-restro-gray rounded-[42px] px-3 py-2 text-gray-500 flex items-center gap-2 w-full">
              <IconSearch size={16} stroke={iconStroke} />
              <input
                type="search"
                placeholder={t("superadmin_plans.search_placeholder")}
                value={search}
                onChange={handleSearchChange}
                className="w-full bg-transparent outline-none text-sm"
              />
            </label>
            <button
              onClick={() =>
                document.getElementById("filter-dialog").showModal()
              }
              className="btn btn-circle btn-sm bg-restro-gray hover:bg-restro-button-hover m-1"
            >
              <IconFilter size={16} stroke={iconStroke} />
            </button>
          </div>
          {/* <button
            onClick={handleExportCSV}
            className="mt-2 sm:mt-0 bg-restro-green text-white text-sm px-4 sm:px-6 py-2 rounded-[42px] hover:bg-restro-green-button-hover whitespace-nowrap w-full sm:w-auto"
          >
            {state.status !== ""
              ? t('superadmin_plans.export_active_plans')
              : t('superadmin_plans.export_all_plans')}
          </button> */}
        </div>

        {planLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-muted-foreground text-sm">
                {t("superadmin_plans.loading_plans")}
              </p>
            </div>
          </div>
        ) : paginatedPlans?.length == 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <IconPackage className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">
              {t("superadmin_plans.no_plans_found")}
            </h3>
            <p className="text-muted-foreground text-sm">
              {t(
                "superadmin_plans.create_your_first_subscription_plan_to_get_started"
              )}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-auto w-full border-separate border-spacing-y-1">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground border-b border-gray-200">
                    {t("superadmin_plans.plan_details")}
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground border-b border-gray-200">
                    {t("superadmin_plans.recommended")}
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground border-b border-gray-200">
                    {t("superadmin_plans.discount")}
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground border-b border-gray-200">
                    {t("superadmin_plans.trial")}
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground border-b border-gray-200">
                    {t("superadmin_plans.pricing")}
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground w-[100px] border-b border-gray-200">
                    {t("superadmin_plans.actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-500">
                {paginatedPlans?.map((plan, index) => (
                  <tr className="group animate-fade-in ">
                    <td className="py-3 px-4 border-b border-gray-200">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-restro-green-10 flex items-center justify-center flex-shrink-0">
                          <IconCreditCard className="w-5 h-5 text-restro-green" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-foreground truncate">
                              {plan.title}
                            </h3>
                            {plan.is_recommended ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-warning/10 text-warning">
                                <IconStar className="w-3.5 h-3.5 fill-current" />
                                {t("superadmin_plans.recommended")}
                              </span>
                            ) : (
                              ""
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate mt-0.5">
                            {plan.features_description[0]}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 border-b border-gray-200">
                      <span
                        className={
                          plan.is_recommended
                            ? "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors bg-restro-green-10 text-accent-foreground"
                            : "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors bg-restro-bg-gray text-muted-foreground"
                        }
                      >
                        {plan.is_recommended ? (
                          <IconCheck className="w-3.5 h-3.5" />
                        ) : (
                          <IconX className="w-3.5 h-3.5" />
                        )}
                        {plan.is_recommended ? "Yes" : "No"}
                      </span>
                    </td>

                    <td className="py-3 px-4 border-b border-gray-200 space-x-1">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-success/10 text-success">
                        -{plan.discount || 0}%
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-success/10 text-success">
                        -{plan.yearly_discount || 0}%
                      </span>
                    </td>

                    <td className="py-3 px-4 border-b border-gray-200">
                      {plan.is_trial ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          <IconClock className="w-3.5 h-3.5" />
                          {plan.trial_days} {t("superadmin_plans.day")}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          {t("superadmin_plans.no_trial")}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 border-b border-gray-200">
                      <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                        {plan.prices?.slice(0, 2).map((c, i) => (
                          <div
                            key={i}
                            className="text-xs bg-restro-bg-gray rounded-lg px-2 py-1.5 font-medium"
                          >
                            <span className="text-muted-foreground">
                              {c.symbol}
                            </span>{" "}
                            <span className="text-foreground">
                              {c.amount}/{t("superadmin_plans.month")}
                            </span>
                          </div>
                        ))}
                        {plan.prices?.length > 2 && (
                          <div className="text-xs bg-restro-gray rounded-lg px-2 py-1.5 font-medium text-muted-foreground">
                            +{plan.prices?.length - 2}{" "}
                            {t("superadmin_plans.more")}
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4 border-b border-gray-200">
                      <div className="flex gap-3">
                        <button
                          onClick={() => openEditDialog(plan)}
                          className="rounded-[42px] bg-white dark:bg-restro-bg-gray p-3 text-restro-text"
                        >
                          <IconPencil size={24} stroke={iconStroke} />
                        </button>
                        <Link
                          to={`/superadmin/dashboard/plans/${plan.id}`}
                          className="rounded-[42px] flex items-center justify-center bg-white dark:bg-restro-bg-gray p-3 text-restro-text"
                        >
                          <IconEye size={24} stroke={iconStroke} />
                        </Link>
                        <button
                          onClick={() => btnShowDelete(plan.id)}
                          className="rounded-[42px] bg-white p-3 text-red-500 dark:bg-restro-gray"
                        >
                          <IconTrash size={24} stroke={iconStroke} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
          <p className="text-sm text-muted-foreground order-2 sm:order-1">
            Showing{" "}
            <span className="font-medium text-foreground">{startItem}</span> to{" "}
            <span className="font-medium text-foreground">{endItem}</span> of{" "}
            <span className="font-medium text-foreground">
              {filteredPlans?.length}
            </span>{" "}
            {t("superadmin_plans.plans")}
          </p>

          <div className="flex items-center gap-1 order-1 sm:order-2">
            <button
              variant="outline"
              size="icon"
              className={`h-9 w-9 rounded-xl ${isFirstPage ? "opacity-50 cursor-not-allowed" : ""
                }`}
              onClick={() => setCurrentPage(1)}
              disabled={isFirstPage}
            >
              <IconChevronLeft className="h-4 w-4" />
            </button>
            <button
              variant="outline"
              size="icon"
              className={`h-9 w-9 rounded-xl ${isFirstPage ? "opacity-50 cursor-not-allowed" : ""
                }`}
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={isFirstPage}
            >
              <IconChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-1 px-2">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "ghost"}
                    size="icon"
                    className={`h-9 w-9 rounded-xl text-sm font-medium ${currentPage === pageNum && "shadow-soft"
                      }`}
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              variant="outline"
              size="icon"
              className={`h-9 w-9 rounded-xl ${isLastPage ? "opacity-50 cursor-not-allowed" : ""
                }`}
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={isLastPage}
            >
              <IconChevronRight className="h-4 w-4" />
            </button>
            <button
              variant="outline"
              size="icon"
              className={`h-9 w-9 rounded-xl ${isLastPage ? "opacity-50 cursor-not-allowed" : ""
                }`}
              onClick={() => setCurrentPage(totalPages)}
              disabled={isLastPage}
            >
              <IconChevronsRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        {/* pagination */}
      </div>

      {/* modal add */}
      <dialog id="modal-add" className="modal modal-bottom sm:modal-middle">
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          {/* Backdrop */}
          <div
            onClick={() => {
              document.getElementById("modal-add").close();
              resetAddPlanForm();
            }}
            className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm transition-opacity"
          />

          {/* Modal */}
          <div
            className={`relative w-full max-w-3xl max-h-[95vh] overflow-hidden rounded-2xl shadow-2xl border animate-scale-in ${theme === "light"
              ? "bg-white border-restro-border-green"
              : "bg-restro-card-bg border-restro-border-green"
              }`}
          >
            {/* Header */}
            <div
              className={`sticky top-0 z-10 flex items-center justify-between px-6 py-5 border-b backdrop-blur-md ${theme === "light"
                ? "bg-white/95 border-restro-border-green"
                : "bg-restro-card-bg/95 border-restro-border-green"
                }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl transition-all ${theme === "light"
                    ? "bg-restro-green-10"
                    : "bg-restro-green/20"
                    }`}
                >
                  <IconSparkles
                    className={`h-6 w-6 ${theme === "light"
                      ? "text-restro-green"
                      : "text-restro-green"
                      }`}
                  />
                </div>
                <div>
                  <h2
                    className={`text-xl font-semibold ${theme === "light" ? "text-gray-900" : "text-restro-text"
                      }`}
                  >
                    {t("superadmin_plans.create_plan")}
                  </h2>
                  <p
                    className={`text-sm ${theme === "light" ? "text-gray-500" : "text-gray-400"
                      }`}
                  >
                    {t("superadmin_plans.set_up_a_new_subscription_plan")}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  document.getElementById("modal-add").close();
                  resetAddPlanForm();
                }}
                className={`h-10 w-10 rounded-xl flex items-center justify-center transition-all ${theme === "light"
                  ? "hover:bg-restro-gray text-gray-600"
                  : "hover:bg-restro-gray text-gray-400"
                  }`}
              >
                <IconX className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div
              className={`overflow-y-auto max-h-[calc(95vh-180px)] px-6 py-6 space-y-6 ${theme === "light" ? "bg-white" : "bg-restro-card-bg"
                }`}
            >
              {/* Plan Title */}
              <div className="space-y-2">
                <label
                  htmlFor="title"
                  className={`text-sm font-semibold flex items-center gap-1 ${theme === "light" ? "text-gray-900" : "text-restro-text"
                    }`}
                >
                  {t("superadmin_plans.plan_title")}{" "}
                  <span className="text-red-500 font-normal">*</span>
                </label>
                <input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("superadmin_plans.placeholder_plan_title")}
                  className={`w-full h-12 px-4 rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-restro-green/50 ${theme === "light"
                    ? "bg-white border-restro-border-green text-gray-900 placeholder-gray-400"
                    : "bg-restro-gray border-restro-border-green text-restro-text placeholder-gray-500"
                    }`}
                />
              </div>

              {/* Features Description */}
              <div className="space-y-3">
                <label
                  className={`text-sm font-semibold flex items-center gap-1 ${theme === "light" ? "text-gray-900" : "text-restro-text"
                    }`}
                >
                  {t("superadmin_plans.features_description")}{" "}
                  <span className="text-red-500 font-normal">*</span>
                </label>
                <div className="flex gap-3">
                  <input
                    value={featureInput}
                    onChange={(e) => setFeatureInput(e.target.value)}
                    onKeyPress={(e) => handleKeyPress(e, addFeatureDescription)}
                    placeholder={t("superadmin_plans.add_feature_description")}
                    className={`flex-1 h-12 px-4 rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-restro-green/50 ${theme === "light"
                      ? "bg-white border-restro-border-green text-gray-900 placeholder-gray-400"
                      : "bg-restro-gray border-restro-border-green text-restro-text placeholder-gray-500"
                      }`}
                  />
                  <button
                    onClick={addFeatureDescription}
                    className={`h-12 w-12 shrink-0 rounded-xl flex items-center justify-center transition-all shadow-md hover:shadow-lg active:scale-95 ${theme === "light"
                      ? "bg-restro-green hover:bg-restro-green-button-hover text-white"
                      : "bg-restro-green hover:bg-restro-green-button-hover text-white"
                      }`}
                  >
                    <IconPlus className="h-5 w-5" />
                  </button>
                </div>
                {featuresDescription.length > 0 && (
                  <div
                    className={`space-y-2 rounded-xl p-4 border animate-fade-in ${theme === "light"
                      ? "bg-restro-gray/50 border-restro-border-green"
                      : "bg-restro-gray/30 border-restro-border-green"
                      }`}
                  >
                    {featuresDescription.map((f, i) => (
                      <div
                        key={i}
                        className={`flex items-center justify-between gap-3 p-3 rounded-lg transition-all animate-slide-in ${theme === "light"
                          ? "bg-white border border-restro-border-green"
                          : "bg-restro-gray border border-restro-border-green"
                          }`}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div
                            className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${theme === "light"
                              ? "bg-restro-green-10"
                              : "bg-restro-green/20"
                              }`}
                          >
                            <IconCheck
                              className={`h-3.5 w-3.5 ${theme === "light"
                                ? "text-restro-green"
                                : "text-restro-green"
                                }`}
                            />
                          </div>
                          <span
                            className={`text-sm flex-1 ${theme === "light"
                              ? "text-gray-700"
                              : "text-restro-text"
                              }`}
                          >
                            {f}
                          </span>
                        </div>
                        <button
                          onClick={() => removeFeatureDescription(i)}
                          className={`p-2 rounded-lg transition-all hover:scale-105 active:scale-95 ${theme === "light"
                            ? "text-gray-400 hover:text-red-500 hover:bg-red-50"
                            : "text-gray-500 hover:text-red-400 hover:bg-red-500/10"
                            }`}
                        >
                          <IconTrash className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Features Points */}
              <div className="space-y-3">
                <label
                  className={`text-sm font-semibold flex items-center gap-1 ${theme === "light" ? "text-gray-900" : "text-restro-text"
                    }`}
                >
                  <IconTag className="h-4 w-4" />
                  {t("superadmin_plans.feature_points")}{" "}
                  <span className="text-red-500 font-normal">*</span>
                </label>
                <div
                  className={clsx(
                    "p-4 rounded-xl border transition-all",
                    theme === "light"
                      ? "bg-restro-gray/50 border-restro-border-green"
                      : "bg-restro-gray/30 border-restro-border-green"
                  )}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {featuresOptions?.map((opt, idx) => {
                      const isChecked = features.includes(opt);
                      return (
                        <label
                          key={idx}
                          className={clsx(
                            "flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border-2",
                            isChecked
                              ? theme === "light"
                                ? "bg-restro-green-10 border-restro-green text-restro-green"
                                : "bg-restro-green/20 border-restro-green text-restro-green"
                              : theme === "light"
                              ? "bg-white border-restro-border-green hover:bg-restro-gray/50 text-gray-700"
                              : "bg-restro-gray border-restro-border-green hover:bg-restro-gray/50 text-restro-text"
                          )}
                        >
                          <div className="relative flex items-center justify-center flex-shrink-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleFeature(opt)}
                              className="sr-only peer"
                            />
                            <div
                              className={clsx(
                                "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                                isChecked
                                  ? "bg-restro-green border-restro-green"
                                  : theme === "light"
                                  ? "border-restro-border-green bg-white"
                                  : "border-restro-border-green bg-restro-gray"
                              )}
                            >
                              {isChecked && (
                                <IconCheck className="w-3.5 h-3.5 text-white" stroke={2.5} />
                              )}
                            </div>
                          </div>
                          <span className={clsx("text-sm font-medium flex-1", isChecked ? "text-restro-green" : "")}>
                            {opt}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {features.length === 0 && (
                    <p className={clsx("text-xs text-center mt-3", theme === "light" ? "text-gray-500" : "text-gray-400")}>
                      {t("superadmin_plans.select_features") || "Select at least one feature"}
                    </p>
                  )}
                </div>
                {features.length > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className={clsx("font-medium", theme === "light" ? "text-gray-600" : "text-gray-400")}>
                      {t("superadmin_plans.selected") || "Selected"}:
                    </span>
                    <span className={clsx("font-bold text-restro-green")}>{features.length}</span>
                    <span className={clsx(theme === "light" ? "text-gray-500" : "text-gray-400")}>
                      {t("superadmin_plans.features") || "features"}
                    </span>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div
                className={`h-px ${theme === "light"
                  ? "bg-restro-border-green"
                  : "bg-restro-border-green"
                  }`}
              />

              {/* Trial & Settings */}
              <div className="space-y-5">
                {/* Trial Toggle - Hidden for Paystack */}
                {!isPaystack && (
                  <div
                    className={`p-4 rounded-xl border ${theme === "light"
                      ? "bg-restro-gray/30 border-restro-border-green"
                      : "bg-restro-gray/20 border-restro-border-green"
                      }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <label
                        htmlFor="trial"
                        className={`text-sm font-semibold ${theme === "light" ? "text-gray-900" : "text-restro-text"
                          }`}
                      >
                        {t("superadmin_plans.enable_trial")}
                      </label>
                      <label className="flex items-center cursor-pointer">
                        <input
                          id="trial"
                          type="checkbox"
                          checked={isTrial}
                          onChange={(e) => setIsTrial(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div
                          className={`
                        w-12 h-6 rounded-full relative transition-all duration-300
                        ${theme === "light" ? "bg-gray-300" : "bg-gray-600"}
                        peer-checked:bg-restro-green
                        after:content-[''] after:absolute after:top-0.5 after:left-0.5
                        after:w-5 after:h-5 after:bg-white after:rounded-full after:shadow-md
                        after:transition-all after:duration-300
                        peer-checked:after:translate-x-6
                      `}
                        />
                      </label>
                    </div>
                    {isTrial && (
                      <div className="animate-fade-in mt-3">
                        <input
                          type="number"
                          min={1}
                          placeholder="Enter trial days (e.g., 7, 14, 30)"
                          value={trialDays}
                          onChange={(e) => {
                            const value = e.target.value;

                            if (value === "") {
                              setTrialDays("");
                              return;
                            }

                            const num = Number(value);
                            if (Number.isNaN(num) || num < 1) return;

                            setTrialDays(value);
                          }}
                          className={`w-full h-12 px-4 rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-restro-green/50 ${theme === "light"
                            ? "bg-white border-restro-border-green text-gray-900 placeholder-gray-400"
                            : "bg-restro-gray border-restro-border-green text-restro-text placeholder-gray-500"
                            }`}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Recommended Toggle */}
                <div
                  className={`p-4 rounded-xl border ${theme === "light"
                    ? "bg-restro-gray/30 border-restro-border-green"
                    : "bg-restro-gray/20 border-restro-border-green"
                    }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <label
                      htmlFor="recommended"
                      className={`text-sm font-semibold ${theme === "light" ? "text-gray-900" : "text-restro-text"
                        }`}
                    >
                      {t("superadmin_plans.mark_as_recommended")}
                    </label>
                    <label className="flex items-center cursor-pointer">
                      <input
                        id="recommended"
                        type="checkbox"
                        checked={isRecommended}
                        onChange={(e) => setIsRecommended(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div
                        className={`
                        w-12 h-6 rounded-full relative transition-all duration-300
                        ${theme === "light" ? "bg-gray-300" : "bg-gray-600"}
                        peer-checked:bg-restro-green
                        after:content-[''] after:absolute after:top-0.5 after:left-0.5
                        after:w-5 after:h-5 after:bg-white after:rounded-full after:shadow-md
                        after:transition-all after:duration-300
                        peer-checked:after:translate-x-6
                      `}
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label
                        className={`text-sm font-medium ${theme === "light" ? "text-gray-700" : "text-gray-300"
                          }`}
                      >
                        {t("superadmin_plans.monthly_discount")} (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        placeholder="0"
                        value={discount}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (
                            value === "" ||
                            (Number(value) >= 0 && Number(value) <= 100)
                          ) {
                            setDiscount(value);
                          }
                        }}
                        className={`w-full h-12 px-4 rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-restro-green/50 ${theme === "light"
                          ? "bg-white border-restro-border-green text-gray-900 placeholder-gray-400"
                          : "bg-restro-gray border-restro-border-green text-restro-text placeholder-gray-500"
                          }`}
                      />
                    </div>
                    <div className="space-y-2">
                      <label
                        className={`text-sm font-medium ${theme === "light" ? "text-gray-700" : "text-gray-300"
                          }`}
                      >
                        {t("superadmin_plans.yearly_discount")} (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        placeholder="0"
                        value={yearlyDiscount}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (
                            value === "" ||
                            (Number(value) >= 0 && Number(value) <= 100)
                          ) {
                            setYearlyDiscount(value);
                          }
                        }}
                        className={`w-full h-12 px-4 rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-restro-green/50 ${theme === "light"
                          ? "bg-white border-restro-border-green text-gray-900 placeholder-gray-400"
                          : "bg-restro-gray border-restro-border-green text-restro-text placeholder-gray-500"
                          }`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div
                className={`h-px ${theme === "light"
                  ? "bg-restro-border-green"
                  : "bg-restro-border-green"
                  }`}
              />

              {/* Currencies */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label
                    className={`text-sm font-semibold flex items-center gap-2 ${theme === "light" ? "text-gray-900" : "text-restro-text"
                      }`}
                  >
                    <IconGlobe className="h-4 w-4" />
                    {t("superadmin_plans.pricing_by_currency")}{" "}
                    <span className="text-red-500 font-normal">*</span>
                  </label>
                  <button
                    onClick={addCurrencyRow}
                    className={`h-10 px-4 rounded-xl flex items-center gap-2 transition-all shadow-md hover:shadow-lg active:scale-95 ${theme === "light"
                      ? "bg-restro-green hover:bg-restro-green-button-hover text-white"
                      : "bg-restro-green hover:bg-restro-green-button-hover text-white"
                      }`}
                  >
                    <IconPlus className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {t("superadmin_plans.add_currency")}
                    </span>
                  </button>
                </div>

                <div className="space-y-3">
                  {currencies.map((c, i) => (
                    <div
                      key={i}
                      className={`grid grid-cols-7 gap-3 p-4 rounded-xl border animate-fade-in ${theme === "light"
                        ? "bg-restro-gray/30 border-restro-border-green"
                        : "bg-restro-gray/20 border-restro-border-green"
                        }`}
                    >
                      <select
                        value={c.country}
                        onChange={(e) => {
                          const country = e.target.value;
                          if (selectedCountries.includes(country)) {
                            toast.error(
                              t(
                                "superadmin_plans.price_for_this_country_already_exists"
                              )
                            );
                            return;
                          }
                          const currencyObj = CURRENCIESWITHNAME.find(
                            (cur) => cur.country === country
                          );
                          updateCurrency(i, "country", country);
                          if (currencyObj)
                            updateCurrency(i, "currency", currencyObj.cc);
                          if (currencyObj)
                            updateCurrency(i, "symbol", currencyObj.symbol);
                        }}
                        className={`h-11 text-sm px-3 rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-restro-green/50 ${theme === "light"
                          ? "bg-white border-restro-border-green text-gray-900"
                          : "bg-restro-gray border-restro-border-green text-restro-text"
                          }`}
                      >
                        <option value="">
                          {t("superadmin_plans.select_country")}
                        </option>
                        {CURRENCIESWITHNAME.map((cur) => (
                          <option key={cur.cc} value={cur.country}>
                            {cur.country}
                          </option>
                        ))}
                      </select>

                      <input
                        placeholder={t("superadmin_plans.currency")}
                        value={c.currency}
                        onChange={(e) =>
                          updateCurrency(i, "currency", e.target.value)
                        }
                        disabled
                        className={`h-11 text-sm px-3 rounded-lg border ${theme === "light"
                          ? "bg-gray-100 border-restro-border-green text-gray-600 cursor-not-allowed"
                          : "bg-restro-gray/50 border-restro-border-green text-gray-500 cursor-not-allowed"
                          }`}
                      />
                      <input
                        placeholder={t("superadmin_plans.symbol")}
                        value={c.symbol}
                        onChange={(e) =>
                          updateCurrency(i, "symbol", e.target.value)
                        }
                        disabled
                        className={`h-11 text-sm px-3 rounded-lg border ${theme === "light"
                          ? "bg-gray-100 border-restro-border-green text-gray-600 cursor-not-allowed"
                          : "bg-restro-gray/50 border-restro-border-green text-gray-500 cursor-not-allowed"
                          }`}
                      />
                      <input
                        placeholder={t("superadmin_plans.monthly")}
                        type="number"
                        min="0"
                        step="0.01"
                        value={c.monthly}
                        onChange={(e) =>
                          updateCurrency(i, "monthly", e.target.value)
                        }
                        className={`h-11 text-sm px-3 rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-restro-green/50 ${theme === "light"
                          ? "bg-white border-restro-border-green text-gray-900 placeholder-gray-400"
                          : "bg-restro-gray border-restro-border-green text-restro-text placeholder-gray-500"
                          }`}
                      />
                      <input
                        placeholder={t("superadmin_plans.yearly")}
                        type="number"
                        min="0"
                        step="0.01"
                        value={c.yearly}
                        onChange={(e) =>
                          updateCurrency(i, "yearly", e.target.value)
                        }
                        className={`h-11 text-sm px-3 rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-restro-green/50 ${theme === "light"
                          ? "bg-white border-restro-border-green text-gray-900 placeholder-gray-400"
                          : "bg-restro-gray border-restro-border-green text-restro-text placeholder-gray-500"
                          }`}
                      />
                      <div className="flex items-center gap-2 px-2">
                        <input
                          type="checkbox"
                          checked={c.is_default}
                          onChange={() => handleDefaultCheckbox(i)}
                          className={`w-4 h-4 rounded border-2 cursor-pointer transition-all ${theme === "light"
                            ? "border-restro-border-green checked:bg-restro-green checked:border-restro-green"
                            : "border-restro-border-green checked:bg-restro-green checked:border-restro-green"
                            }`}
                        />
                        <span
                          className={`text-xs font-medium ${theme === "light"
                            ? "text-gray-700"
                            : "text-gray-300"
                            }`}
                        >
                          {t("superadmin_plans.fallback_currency")}
                        </span>
                      </div>

                      <button
                        onClick={() => removeCurrency(i)}
                        disabled={currencies.length === 1}
                        className={`h-11 w-11 rounded-lg flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed ${theme === "light"
                          ? "text-gray-400 hover:text-red-500 hover:bg-red-50"
                          : "text-gray-500 hover:text-red-400 hover:bg-red-500/10"
                          }`}
                      >
                        <IconTrash className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div
              className={`sticky bottom-0 z-10 flex items-center justify-end gap-3 px-6 py-4 border-t backdrop-blur-md ${theme === "light"
                ? "bg-white/95 border-restro-border-green"
                : "bg-restro-card-bg/95 border-restro-border-green"
                }`}
            >
              <button
                type="button"
                onClick={() => {
                  document.getElementById("modal-add").close();
                  resetAddPlanForm();
                }}
                className={`h-11 px-6 rounded-xl font-medium transition-all active:scale-95 ${theme === "light"
                  ? "bg-restro-gray hover:bg-restro-button-hover text-gray-700 border border-restro-border-green"
                  : "bg-restro-gray hover:bg-restro-button-hover text-restro-text border border-restro-border-green"
                  }`}
              >
                {t("superadmin_plans.cancel")}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isAddingPlan}
                className={`h-11 px-8 rounded-xl font-semibold text-white transition-all shadow-lg hover:shadow-xl active:scale-95 ${theme === "light"
                  ? "bg-restro-green hover:bg-restro-green-button-hover"
                  : "bg-restro-green hover:bg-restro-green-button-hover"
                  }`}
              >
                {isAddingPlan
                  ? t("superadmin_plans.please_wait")
                  : t("superadmin_plans.create_plan")}
              </button>
            </div>
          </div>
        </div>
      </dialog>
      {/* modal add */}

      {/* update dialog */}
      <dialog id="modal-edit" className="modal modal-bottom sm:modal-middle">
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          {/* Backdrop */}
          <div
            onClick={() => document.getElementById("modal-edit").close()}
            className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm transition-opacity"
          />

          {/* Modal */}
          <div
            className={`relative w-full max-w-3xl max-h-[95vh] overflow-hidden rounded-2xl shadow-2xl border animate-scale-in ${theme === "light"
              ? "bg-white border-restro-border-green"
              : "bg-restro-card-bg border-restro-border-green"
              }`}
          >
            {/* Header */}
            <div
              className={`sticky top-0 z-10 flex items-center justify-between px-6 py-5 border-b backdrop-blur-md ${theme === "light"
                ? "bg-white/95 border-restro-border-green"
                : "bg-restro-card-bg/95 border-restro-border-green"
                }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl transition-all ${theme === "light"
                    ? "bg-restro-green-10"
                    : "bg-restro-green/20"
                    }`}
                >
                  <IconSparkles
                    className={`h-6 w-6 ${theme === "light"
                      ? "text-restro-green"
                      : "text-restro-green"
                      }`}
                  />
                </div>
                <div>
                  <h2
                    className={`text-xl font-semibold ${theme === "light" ? "text-gray-900" : "text-restro-text"
                      }`}
                  >
                    {t("superadmin_plans.edit_plan")}
                  </h2>
                  <p
                    className={`text-sm ${theme === "light" ? "text-gray-500" : "text-gray-400"
                      }`}
                  >
                    {t("superadmin_plans.update_your_subscription_plan")}
                  </p>
                </div>
              </div>
              <button
                onClick={() => document.getElementById("modal-edit").close()}
                className={`h-10 w-10 rounded-xl flex items-center justify-center transition-all ${theme === "light"
                  ? "hover:bg-restro-gray text-gray-600"
                  : "hover:bg-restro-gray text-gray-400"
                  }`}
              >
                <IconX className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div
              className={`overflow-y-auto max-h-[calc(95vh-180px)] px-6 py-6 space-y-6 ${theme === "light" ? "bg-white" : "bg-restro-card-bg"
                }`}
            >
              {/* Plan Title */}
              <div className="space-y-2">
                <label
                  htmlFor="edit-title"
                  className={`text-sm font-semibold flex items-center gap-1 ${theme === "light" ? "text-gray-900" : "text-restro-text"
                    }`}
                >
                  {t("superadmin_plans.plan_title")}{" "}
                  <span className="text-red-500 font-normal">*</span>
                </label>
                <input
                  id="edit-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("superadmin_plans.placeholder_plan_title")}
                  className={`w-full h-12 px-4 rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-restro-green/50 ${theme === "light"
                    ? "bg-white border-restro-border-green text-gray-900 placeholder-gray-400"
                    : "bg-restro-gray border-restro-border-green text-restro-text placeholder-gray-500"
                    }`}
                />
              </div>

              {/* Features Description */}
              <div className="space-y-3">
                <label
                  className={`text-sm font-semibold flex items-center gap-1 ${theme === "light" ? "text-gray-900" : "text-restro-text"
                    }`}
                >
                  {t("superadmin_plans.features_description")}{" "}
                  <span className="text-red-500 font-normal">*</span>
                </label>
                <div className="flex gap-3">
                  <input
                    value={featureInput}
                    onChange={(e) => setFeatureInput(e.target.value)}
                    onKeyPress={(e) => handleKeyPress(e, addFeatureDescription)}
                    placeholder={t("superadmin_plans.add_feature_description")}
                    className={`flex-1 h-12 px-4 rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-restro-green/50 ${theme === "light"
                      ? "bg-white border-restro-border-green text-gray-900 placeholder-gray-400"
                      : "bg-restro-gray border-restro-border-green text-restro-text placeholder-gray-500"
                      }`}
                  />
                  <button
                    onClick={addFeatureDescription}
                    className={`h-12 w-12 shrink-0 rounded-xl flex items-center justify-center transition-all active:scale-95 ${theme === "light"
                      ? "bg-restro-green hover:bg-restro-green-button-hover text-white"
                      : "bg-restro-green hover:bg-restro-green-button-hover text-white"
                      }`}
                  >
                    <IconPlus className="h-5 w-5" />
                  </button>
                </div>
                {featuresDescription.length > 0 && (
                  <div
                    className={`space-y-2 rounded-xl p-4 border animate-fade-in ${theme === "light"
                      ? "bg-restro-gray/50 border-restro-border-green"
                      : "bg-restro-gray/30 border-restro-border-green"
                      }`}
                  >
                    {featuresDescription.map((f, i) => (
                      <div
                        key={i}
                        className={`flex items-center justify-between gap-3 p-3 rounded-lg transition-all animate-slide-in ${theme === "light"
                          ? "bg-white border border-restro-border-green"
                          : "bg-restro-gray border border-restro-border-green"
                          }`}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div
                            className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${theme === "light"
                              ? "bg-restro-green-10"
                              : "bg-restro-green/20"
                              }`}
                          >
                            <IconCheck
                              className={`h-3.5 w-3.5 ${theme === "light"
                                ? "text-restro-green"
                                : "text-restro-green"
                                }`}
                            />
                          </div>
                          <span
                            className={`text-sm flex-1 ${theme === "light"
                              ? "text-gray-700"
                              : "text-restro-text"
                              }`}
                          >
                            {f}
                          </span>
                        </div>
                        <button
                          onClick={() => removeFeatureDescription(i)}
                          className={`p-2 rounded-lg transition-all hover:scale-105 active:scale-95 ${theme === "light"
                            ? "text-gray-400 hover:text-red-500 hover:bg-red-50"
                            : "text-gray-500 hover:text-red-400 hover:bg-red-500/10"
                            }`}
                        >
                          <IconTrash className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Features Points */}
              <div className="space-y-3">
                <label
                  className={`text-sm font-semibold flex items-center gap-1 ${theme === "light" ? "text-gray-900" : "text-restro-text"
                    }`}
                >
                  <IconTag className="h-4 w-4" />
                  {t("superadmin_plans.feature_points")}{" "}
                  <span className="text-red-500 font-normal">*</span>
                </label>
                <div
                  className={clsx(
                    "p-4 rounded-xl border transition-all",
                    theme === "light"
                      ? "bg-restro-gray/50 border-restro-border-green"
                      : "bg-restro-gray/30 border-restro-border-green"
                  )}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {featuresOptions?.map((opt, idx) => {
                      const isChecked = features.includes(opt);
                      return (
                        <label
                          key={idx}
                          className={clsx(
                            "flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border-2",
                            isChecked
                              ? theme === "light"
                                ? "bg-restro-green-10 border-restro-green text-restro-green"
                                : "bg-restro-green/20 border-restro-green text-restro-green"
                              : theme === "light"
                              ? "bg-white border-restro-border-green hover:bg-restro-gray/50 text-gray-700"
                              : "bg-restro-gray border-restro-border-green hover:bg-restro-gray/50 text-restro-text"
                          )}
                        >
                          <div className="relative flex items-center justify-center flex-shrink-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleFeature(opt)}
                              className="sr-only peer"
                            />
                            <div
                              className={clsx(
                                "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                                isChecked
                                  ? "bg-restro-green border-restro-green"
                                  : theme === "light"
                                  ? "border-restro-border-green bg-white"
                                  : "border-restro-border-green bg-restro-gray"
                              )}
                            >
                              {isChecked && (
                                <IconCheck className="w-3.5 h-3.5 text-white" stroke={2.5} />
                              )}
                            </div>
                          </div>
                          <span className={clsx("text-sm font-medium flex-1", isChecked ? "text-restro-green" : "")}>
                            {opt}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {features.length === 0 && (
                    <p className={clsx("text-xs text-center mt-3", theme === "light" ? "text-gray-500" : "text-gray-400")}>
                      {t("superadmin_plans.select_features") || "Select at least one feature"}
                    </p>
                  )}
                </div>
                {features.length > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className={clsx("font-medium", theme === "light" ? "text-gray-600" : "text-gray-400")}>
                      {t("superadmin_plans.selected") || "Selected"}:
                    </span>
                    <span className={clsx("font-bold text-restro-green")}>{features.length}</span>
                    <span className={clsx(theme === "light" ? "text-gray-500" : "text-gray-400")}>
                      {t("superadmin_plans.features") || "features"}
                    </span>
                  </div>
                )}
              </div>

              {/* Recommended Toggle */}
              <div
                className={`p-4 rounded-xl border ${theme === "light"
                  ? "bg-restro-gray/30 border-restro-border-green"
                  : "bg-restro-gray/20 border-restro-border-green"
                  }`}
              >
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="recommended"
                    className={`text-sm font-semibold ${theme === "light" ? "text-gray-900" : "text-restro-text"
                      }`}
                  >
                    {t("superadmin_plans.mark_as_recommended")}
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      id="recommended"
                      type="checkbox"
                      checked={isRecommended}
                      onChange={(e) => setIsRecommended(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div
                      className={`
                        w-12 h-6 rounded-full relative transition-all duration-300
                        ${theme === "light" ? "bg-gray-300" : "bg-gray-600"}
                        peer-checked:bg-restro-green
                        after:content-[''] after:absolute after:top-0.5 after:left-0.5
                        after:w-5 after:h-5 after:bg-white after:rounded-full
                        after:transition-all after:duration-300
                        peer-checked:after:translate-x-6
                      `}
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div
              className={`sticky bottom-0 z-10 flex items-center justify-end gap-3 px-6 py-4 border-t backdrop-blur-md ${theme === "light"
                ? "bg-white/95 border-restro-border-green"
                : "bg-restro-card-bg/95 border-restro-border-green"
                }`}
            >
              <button
                type="button"
                onClick={() => document.getElementById("modal-edit").close()}
                className={`h-11 px-6 rounded-xl font-medium transition-all active:scale-95 ${theme === "light"
                  ? "bg-restro-gray hover:bg-restro-button-hover text-gray-700 border border-restro-border-green"
                  : "bg-restro-gray hover:bg-restro-button-hover text-restro-text border border-restro-border-green"
                  }`}
              >
                {t("superadmin_plans.cancel")}
              </button>
              <button
                type="button"
                onClick={handleUpdate}
                className={`h-11 px-8 rounded-xl font-semibold text-white transition-all active:scale-95 ${theme === "light"
                  ? "bg-restro-green hover:bg-restro-green-button-hover"
                  : "bg-restro-green hover:bg-restro-green-button-hover"
                  }`}
              >
                {t("superadmin_plans.save")}
              </button>
            </div>
          </div>
        </div>
      </dialog>
      {/* update dialog */}

      {/* Delete Confirmation Modal */}
      <DeleteModal
        isOpen={Boolean(planDeleteId)}
        onClose={() => setPlanDeleteId(null)}
        onConfirm={async () => {
          const id = planDeleteId;
          setPlanDeleteId(null);
          await btnDelete(id);
        }}
        title={t("superadmin_plans.are_you_sure")}
        description={t("superadmin_plans.irreversible_action")}
        confirmText={t("superadmin_plans.yes_delete")}
        cancelText={t("superadmin_plans.cancel")}
      />
    </Page>
  );
}
