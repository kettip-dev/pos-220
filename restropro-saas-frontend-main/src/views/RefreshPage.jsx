import { IconAlertTriangle } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { signOut } from "../controllers/auth.controller";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";

export default function RefreshPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const btnLogout = async () => {
    try {
      toast.loading(t("refresh_page.buttons.login_again"));
      const response = await signOut();

      if (response.status === 200) {
        toast.dismiss();
        navigate("/login", { replace: true });
      }
    } catch (error) {
      toast.dismiss();
      toast.error(t("toast.something_went_wrong"));
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 text-center">
        
        {/* Icon */}
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
          <IconAlertTriangle className="h-7 w-7 text-red-600" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-semibold text-gray-900">
          {t("refresh_page.title")}
        </h1>

        {/* Description */}
        <p className="mt-3 text-sm text-gray-600 leading-relaxed">
          {t("refresh_page.description")}
        </p>

        {/* Actions */}
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => {window.location.reload(); window.history.back() }}
            className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-100 transition"
          >
            {t("refresh_page.buttons.refresh")}
          </button>

          <button
            onClick={btnLogout}
            className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-white hover:opacity-90 transition"
          >
            {t("refresh_page.buttons.login_again")}
          </button>
        </div>
      </div>
    </div>
  );
}
