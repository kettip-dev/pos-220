import React from "react";
import { useTranslation } from "react-i18next";
import { IconBuildingStore } from "@tabler/icons-react";

import { iconStroke } from "../config/config";
import { getUserDetailsInLocalStorage } from "../helpers/UserDetails";
import { isAllBusinessesScope } from "../helpers/BusinessScope";

/**
 * The "pick a business first" screen.
 *
 * Single source of the design, so every business-specific module shows the same
 * thing. Two entry points use it:
 *
 *  - `RequiresSingleBusiness` below, wrapped around a route in App.jsx, which
 *    renders it *before* any request is made (POS, Kitchen, Menu, Settings…);
 *  - a module that only discovers the requirement from a failed response, which
 *    renders this directly — see `isBusinessRequiredError` in helpers/BusinessScope.
 */
export function SelectBusinessEmptyState() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-16">
      <div className="w-16 h-16 rounded-full bg-restro-green-light flex items-center justify-center">
        <IconBuildingStore size={28} stroke={iconStroke} className="text-restro-green" />
      </div>

      <h3 className="mt-4 text-lg font-semibold text-restro-text">
        {t("business_switcher.single_business_required_title", "Select a business")}
      </h3>

      <p className="mt-2 max-w-md text-sm text-gray-500">
        {t(
          "business_switcher.single_business_required",
          "This module requires a specific business. Please select a business from the Business Switcher."
        )}
      </p>
    </div>
  );
}

/**
 * Guard for modules that perform live operational actions and therefore only
 * make sense against ONE business — POS, Kitchen Display, Menu Management,
 * Table Management, Table Assignments, Print Settings, Tax Setup, Payment
 * Types, Store Details, Recipe Management and QR Menu Configuration.
 *
 * In Enterprise "All Businesses" mode these render the explanation instead of
 * their screen, so the app never tries to merge operational data.
 *
 * This is UX only. The backend refuses the same requests with 409 regardless of
 * what the client does — see `resolveDataScope` and its consolidation
 * allow-list. Rendering the message here just avoids a pointless round trip and
 * an error toast.
 */
export default function RequiresSingleBusiness({ children }) {
  const user = getUserDetailsInLocalStorage();

  if (!isAllBusinessesScope(user?.role)) {
    return children;
  }

  return <SelectBusinessEmptyState />;
}
