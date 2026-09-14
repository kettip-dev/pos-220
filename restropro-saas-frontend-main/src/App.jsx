import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import PrivateRoute from "./helpers/PrivateRoute";
import LoginPage from "./views/LoginPage";
import DashboardLayout from "./views/DashboardLayout";
import DashboardPage from "./views/DashboardPage";
import POSPage from "./views/POSPage";
import OrdersPage from "./views/OrdersPage";
import KitchenPage from "./views/KitchenPage";
import ReservationPage from "./views/ReservationPage";
import CustomersPage from "./views/CustomersPage";
import CustomerInsightsPage from "./views/CustomerInsightsPage";
import InvoicesPage from "./views/InvoicesPage";
import InvoiceAuditLogsPage from "./views/InvoiceAuditLogsPage";
import UsersPage from "./views/UsersPage";
import ReportsPage from "./views/ReportsPage";
import SettingsPage from "./views/SettingsPage";
import SettingsHomePage from "./views/SettingsViews/SettingsHomePage";
import SettingDetailsPage from "./views/SettingsViews/SettingDetailsPage";
import PrintSettingsPage from "./views/SettingsViews/PrintSettingsPage";
import TablesSettingsPage from "./views/SettingsViews/TableSettingsPage";
import TablesPage from "./views/TablesPage";
import TableAssignmentsPage from "./views/SettingsViews/TableAssignmentsPage";
import MenuItemsSettingsPage from "./views/SettingsViews/MenuItemsSettingsPage";
import TaxSetupPage from "./views/SettingsViews/TaxSetupPage";
import PaymentTypesPage from "./views/SettingsViews/PaymentTypesPage";
import DevicesPage from "./views/SettingsViews/DevicesPage";
import ContactSupport from "./views/SettingsViews/ContactSupportPage";
import CategoriesPage from "./views/SettingsViews/CategoriesPage";
import MenuItemViewPage from "./views/SettingsViews/MenuItemViewPage";
import { NavbarContext } from "./contexts/NavbarContext";
import { getIsNavbarCollapsed } from "./helpers/NavbarSettings";
import PrintReceiptPage from "./views/PrintReceiptPage";
import PrintTokenPage from "./views/PrintTokenPage";
import NoAccessPage from "./views/NoAccessPage";
import ProfilePage from "./views/ProfilePage";
import { SCOPES } from "./config/scopes";
import ScopeProtectedRoute from "./helpers/ScopeProtectedRoute";
import RequiresSingleBusiness from "./components/RequiresSingleBusiness";
import { SocketProvider } from "./contexts/SocketContext";
import RegistrationPage from "./views/RegistrationPage";
import ForgotPasswordPage from "./views/ForgotPasswordPage";
import InActiveSubscriptionPage from "./views/InActiveSubscriptionPage";
import PaymentSuccessPage from "./views/PaymentSuccessPage";
import PaymentCancelledPage from "./views/PaymentCancelledPage";
import ResetPasswordPage from "./views/ResetPasswordPage";
import QRMenuPage from "./views/QRMenuPage";
import SuperAdminProtectedRoute from "./helpers/SuperAdminProtectedRoute";
import SuperAdminLoginPage from "./views/SuperAdmin/LoginPage";
import SuperAdminDashboadLayout from "./views/SuperAdmin/SuperAdminDashboadLayout";
import SuperAdminDashboardPage from "./views/SuperAdmin/SuperAdminDashboardPage";
import SuperAdminContactSupportPage from "./views/SuperAdmin/SuperAdminContactSupportPage";
import SuperAdminTenantsPage from "./views/SuperAdmin/SuperAdminTenantsPage";
import SuperAdminReportsPage from "./views/SuperAdmin/SuperAdminReportsPage";
import SuperAdminTenantSubscriptionHistoryPage from "./views/SuperAdmin/SuperAdminTenantSubscriptionHistoryPage";
import CartPage from "./views/CartPage";
import OrderSuccessPage from "./views/OrderSuccessPage";
import OrderFailedPage from "./views/OrderFailedPage";
import CustomersImportPage from "./views/CustomersImportPage";
import FeedbackCollectPage from "./views/FeedbackCollectPage";
import FeedbackCollectSuccessPage from "./views/FeedbackCollectSuccessPage";
import FeedbackPage from "./views/FeedbackPage";
import LanguagePage from "./views/LanguagePage";
import InventoryPage from "./views/InventoryPage";
import InventoryLogsPage from "./views/InventoryLogsPage";
import InventoryDashboardPage from "./views/InventoryDashboard";
import { ThemeProvider } from "./contexts/ThemeContext";
import MyToaster from "./components/MyToaster";
import SuperAdminPlansPage from "./views/SuperAdmin/SuperAdminPlansPage";
import SuperAdminPlanDetails from "./views/SuperAdmin/SuperAdminPlanDetails";
import SuperAdminPaymentGatewaysPage from "./views/SuperAdmin/SuperAdminPaymentGatewaysPage";
import SuperAdminGoogleSettingPage from "./views/SuperAdmin/SuperAdminGoogleSettingPage";
import SuperAdminFirebaseConfigPage from "./views/SuperAdmin/SuperAdminFirebaseConfigPage";
import RefreshPage from "./views/RefreshPage";
import SuperAdminImageStoragePage from "./views/SuperAdmin/SuperAdminImageStoragePage";
import SuperAdminBusinessGroupsPage from "./views/SuperAdmin/SuperAdminBusinessGroupsPage";
import SuperAdminBusinessGroupDetailsPage from "./views/SuperAdmin/SuperAdminBusinessGroupDetailsPage";
import { initializeImageStorage } from "./services/ImageStorageService";
import OrderStatusDisplayPage from "./views/OrderStatusDisplayPage";
import DisplayPage from "./views/DisplayPage";

export default function App() {
  const [isNavbarCollapsed, setIsNavbarCollapsed] = useState(
    getIsNavbarCollapsed()
  );

  // Initialize image storage configuration on app load
  useEffect(() => {
    initializeImageStorage();
  }, []);

  return (
    <SocketProvider>
    <ThemeProvider>
    <NavbarContext.Provider value={[isNavbarCollapsed, setIsNavbarCollapsed]}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegistrationPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/print-receipt" element={<PrintReceiptPage />} />
          <Route path="/print-token" element={<PrintTokenPage />} />
          <Route path="/no-access" element={<NoAccessPage />} />
          <Route path="/success" element={<PaymentSuccessPage />} />
          <Route path="/cancelled-payment" element={<PaymentCancelledPage />} />
          <Route path="/refresh" element={<RefreshPage/>} />

          <Route path="/dashboard/inactive-subscription" element={<InActiveSubscriptionPage />} />

          <Route path="/m/:qrcode" element={<QRMenuPage />} />
          <Route path="/m/:qrcode/cart" element={<CartPage />} />
          <Route path="/m/order-success" element={<OrderSuccessPage />} />
          <Route path="/m/order-failed" element={<OrderFailedPage />} />

          <Route path="/m/:qrcode/feedback" element={<FeedbackCollectPage />} />
          <Route path="/m/:qrcode/feedback/success" element={<FeedbackCollectSuccessPage />} />
          <Route path="/order-status/:qrcode" element={<OrderStatusDisplayPage />} />
          <Route
            path="/customer/pos/:roomId"
            element={
              <PrivateRoute>
                <ScopeProtectedRoute scopes={[SCOPES.POS]}>
                  <DisplayPage />
                </ScopeProtectedRoute>
              </PrivateRoute>
            }
          />

          {/* app routes */}
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <DashboardLayout />
              </PrivateRoute>
            }
          >
            <Route
              path=""
              element={
                <ScopeProtectedRoute scopes={[SCOPES.DASHBOARD]}>
                  <DashboardPage />
                </ScopeProtectedRoute>
              }
            />
            <Route
              path="home"
              element={
                <ScopeProtectedRoute scopes={[SCOPES.DASHBOARD]}>
                  <DashboardPage />
                </ScopeProtectedRoute>
              }
            />
            <Route path="profile" element={<ProfilePage />} />

            <Route
              path="pos"
              element={
                <ScopeProtectedRoute scopes={[SCOPES.POS]}>
                  <RequiresSingleBusiness><POSPage /></RequiresSingleBusiness>
                </ScopeProtectedRoute>
              }
            />
            <Route
              path="tables"
              element={
                <ScopeProtectedRoute
                  scopes={[
                    SCOPES.POS,
                    SCOPES.SETTINGS,
                    SCOPES.DASHBOARD,
                  ]}
                >
                  <RequiresSingleBusiness><TablesPage /></RequiresSingleBusiness>
                </ScopeProtectedRoute>
              }
            />
            <Route
              path="orders"
              element={
                <ScopeProtectedRoute
                  scopes={[
                    SCOPES.POS,
                    SCOPES.ORDERS,
                    SCOPES.ORDER_STATUS,
                    SCOPES.ORDER_STATUS_DISPLAY,
                  ]}
                >
                  <OrdersPage />
                </ScopeProtectedRoute>
              }
            />
            <Route
              path="kitchen"
              element={
                <ScopeProtectedRoute
                  scopes={[SCOPES.KITCHEN, SCOPES.KITCHEN_DISPLAY]}
                >
                  <RequiresSingleBusiness><KitchenPage /></RequiresSingleBusiness>
                </ScopeProtectedRoute>
              }
            />
            <Route
              path="reservation"
              element={
                <ScopeProtectedRoute
                  scopes={[
                    SCOPES.RESERVATIONS,
                    SCOPES.VIEW_RESERVATIONS,
                    SCOPES.MANAGE_RESERVATIONS,
                  ]}
                >
                  <ReservationPage />
                </ScopeProtectedRoute>
              }
            />
            <Route
              path="customers"
              element={
                <ScopeProtectedRoute
                  scopes={[
                    SCOPES.CUSTOMERS,
                    SCOPES.VIEW_CUSTOMERS,
                    SCOPES.MANAGE_CUSTOMERS,
                  ]}
                >
                  <CustomersPage />
                </ScopeProtectedRoute>
              }
            />
            <Route
              path="customers/:phone/insights"
              element={
                <ScopeProtectedRoute
                  scopes={[
                    SCOPES.CUSTOMERS,
                    SCOPES.VIEW_CUSTOMERS,
                    SCOPES.MANAGE_CUSTOMERS,
                  ]}
                >
                  <CustomerInsightsPage />
                </ScopeProtectedRoute>
              }
            />
            <Route
              path="customers/import"
              element={
                <ScopeProtectedRoute
                  scopes={[
                    SCOPES.CUSTOMERS,
                    SCOPES.VIEW_CUSTOMERS,
                    SCOPES.MANAGE_CUSTOMERS,
                  ]}
                >
                  <CustomersImportPage />
                </ScopeProtectedRoute>
              }
            />
            <Route
              path="invoices"
              element={
                <ScopeProtectedRoute scopes={[SCOPES.INVOICES]}>
                  <InvoicesPage />
                </ScopeProtectedRoute>
              }
            />
            <Route
              path="inventory"
              element={
                <ScopeProtectedRoute scopes={[SCOPES.INVENTORY]}>
                  <InventoryPage/>
                </ScopeProtectedRoute>
              }
            />
            <Route
              path="inventory/dashboard"
              element={
                <ScopeProtectedRoute scopes={[SCOPES.INVENTORY]}>
                  <InventoryDashboardPage/>
                </ScopeProtectedRoute>
              }
            />
            <Route
              path="inventory/stock-movements"
              element={
                <ScopeProtectedRoute scopes={[SCOPES.INVENTORY]}>
                  <InventoryLogsPage />
                </ScopeProtectedRoute>
              }
            />
            <Route path="users" element={<ScopeProtectedRoute scopes={[SCOPES.USER]}><UsersPage /></ScopeProtectedRoute>} />
            <Route
              path="reports"
              element={
                <ScopeProtectedRoute scopes={[SCOPES.REPORTS]}>
                  <ReportsPage />
                </ScopeProtectedRoute>
              }
            />
            <Route
              path="reports/:reportId"
              element={
                <ScopeProtectedRoute scopes={[SCOPES.REPORTS]}>
                  <ReportsPage />
                </ScopeProtectedRoute>
              }
            />
            <Route
              path="audit-logs"
              element={
                <ScopeProtectedRoute scopes={[SCOPES.VIEW_INVOICE_AUDIT_LOG]}>
                  <InvoiceAuditLogsPage />
                </ScopeProtectedRoute>
              }
            />

            <Route
              path="feedbacks"
              element={
                <ScopeProtectedRoute scopes={[SCOPES.FEEDBACK]}>
                  <FeedbackPage />
                </ScopeProtectedRoute>
              }
            />

            <Route path="devices" element={<DevicesPage />} />
            <Route path="contact-support" element={<ContactSupport />} />
            <Route path="language" element={<LanguagePage />} />

            <Route
              path="settings"
              element={
                <ScopeProtectedRoute scopes={[SCOPES.SETTINGS]}>
                  <SettingsPage />
                </ScopeProtectedRoute>
              }
            >
              <Route path="" element={<SettingsHomePage />} />
              <Route path="details" element={<RequiresSingleBusiness><SettingDetailsPage /></RequiresSingleBusiness>} />
              <Route path="print-settings" element={<RequiresSingleBusiness><PrintSettingsPage /></RequiresSingleBusiness>} />
              <Route path="tables" element={<RequiresSingleBusiness><TablesSettingsPage /></RequiresSingleBusiness>} />
              <Route path="table-assignments" element={<RequiresSingleBusiness><TableAssignmentsPage /></RequiresSingleBusiness>} />
              <Route path="menu-items" element={<RequiresSingleBusiness><MenuItemsSettingsPage /></RequiresSingleBusiness>} />
              <Route path="menu-items/:id" element={<RequiresSingleBusiness><MenuItemViewPage /></RequiresSingleBusiness>} />
              <Route
                path="menu-items/categories"
                element={<RequiresSingleBusiness><CategoriesPage /></RequiresSingleBusiness>}
              />
              <Route path="tax-setup" element={<RequiresSingleBusiness><TaxSetupPage /></RequiresSingleBusiness>} />
              <Route path="payment-types" element={<RequiresSingleBusiness><PaymentTypesPage /></RequiresSingleBusiness>} />
            </Route>
          </Route>
          {/* app routes */}


          {/* superadmin routes */}
          <Route path="/superadmin" element={<SuperAdminLoginPage />} />
          <Route path="/superadmin/login" element={<SuperAdminLoginPage />} />
          <Route path="/superadmin/dashboard" element={<PrivateRoute><SuperAdminDashboadLayout/></PrivateRoute>}>
            <Route path="" element={<SuperAdminProtectedRoute><SuperAdminDashboardPage /></SuperAdminProtectedRoute>} />
            <Route path="home" element={<SuperAdminProtectedRoute><SuperAdminDashboardPage /></SuperAdminProtectedRoute>} />
            <Route path="plans" element={<SuperAdminProtectedRoute><SuperAdminPlansPage /></SuperAdminProtectedRoute>} />
            <Route path="payment-gateways" element={<SuperAdminProtectedRoute><SuperAdminPaymentGatewaysPage /></SuperAdminProtectedRoute>} />
            <Route path="push-notifications" element={<SuperAdminProtectedRoute><SuperAdminFirebaseConfigPage /></SuperAdminProtectedRoute>} />
            <Route path="tenants" element={<SuperAdminProtectedRoute><SuperAdminTenantsPage /></SuperAdminProtectedRoute>} />
            <Route path="business-groups" element={<SuperAdminProtectedRoute><SuperAdminBusinessGroupsPage /></SuperAdminProtectedRoute>} />
            <Route path="business-groups/:id" element={<SuperAdminProtectedRoute><SuperAdminBusinessGroupDetailsPage /></SuperAdminProtectedRoute>} />
            <Route path="tenants/:id/subscription-history" element={<SuperAdminProtectedRoute><SuperAdminTenantSubscriptionHistoryPage /></SuperAdminProtectedRoute>} />
            <Route path="plans/:id" element={<SuperAdminProtectedRoute><SuperAdminPlanDetails /></SuperAdminProtectedRoute>} />
            <Route path="reports" element={<SuperAdminProtectedRoute><SuperAdminReportsPage /></SuperAdminProtectedRoute>} />
            <Route path="image-storage" element={<SuperAdminProtectedRoute><SuperAdminImageStoragePage /></SuperAdminProtectedRoute>} />
            <Route path="contact-support" element={<SuperAdminProtectedRoute><SuperAdminContactSupportPage /></SuperAdminProtectedRoute>} />
            <Route path="language" element={<LanguagePage />} />
            <Route path="google" element={<SuperAdminProtectedRoute><SuperAdminGoogleSettingPage /></SuperAdminProtectedRoute>} />
            <Route path="google-auth" element={<SuperAdminProtectedRoute><SuperAdminGoogleSettingPage /></SuperAdminProtectedRoute>} />
          </Route>

          {/* superadmin routes */}


        </Routes>
        {/* <Toaster  /> */}
        <MyToaster />
      </BrowserRouter>
    </NavbarContext.Provider>
    </ThemeProvider>
    </SocketProvider>
  );
}
