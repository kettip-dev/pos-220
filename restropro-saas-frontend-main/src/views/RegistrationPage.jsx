import React, { useEffect, useState } from "react";
import Logo from "../assets/logo.svg";
import LogoDark from "../assets/LogoDark.svg"
import { toast } from "react-hot-toast";
import { Link, useNavigate } from "react-router-dom";
import { SCOPES } from "../config/scopes";
import { signUp, googleSignIn } from "../controllers/auth.controller";
import { validateEmail } from "../utils/emailValidator";
import { useTranslation } from "react-i18next";
import { useTheme } from "../contexts/ThemeContext";
import EcosystemWidget from "../components/EcosystemWidget";
import { signInWithPopup } from "firebase/auth";
import { getGoogleAuthClient } from "../config/firebase";
import { saveUserDetailsInLocalStorage, getUserDetailsInLocalStorage } from "../helpers/UserDetails";
import ApiClient from "../helpers/ApiClient";

export default function RegistrationPage() {
  const { t } = useTranslation();
  const {theme} = useTheme();
  const navigate = useNavigate();
  const [googleAuthClient, setGoogleAuthClient] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadGoogleAuth = async () => {
      try {
        const { data } = await ApiClient.get("/auth/google-config");
        if (data.enabled && isMounted) {
          setGoogleAuthClient(getGoogleAuthClient(data.firebaseConfig));
        }
      } catch (error) {
        console.error("Unable to load Google Sign-In configuration", error);
      }
    };

    loadGoogleAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleGoogleAuth = async () => {
    if (!googleAuthClient) return;

    const bizNameInput = document.getElementById("biz_name");
    const bizName = bizNameInput ? bizNameInput.value.trim() : "";

    // if (!bizName) {
    //   toast.error(t("register.business_name_error"));
    //   if (bizNameInput) bizNameInput.focus();
    //   return;
    // }

    try {
      toast.loading(t("register.loading_message"));
      const result = await signInWithPopup(
        googleAuthClient.auth,
        googleAuthClient.googleProvider
      );
      const idToken = await result.user.getIdToken();

      const res = await googleSignIn(idToken, bizName);

      if (res.status == 200) {
        toast.dismiss();
        toast.success(res.data.message || t("register.success_message") || "Account Created successfully!");

        const resultUser = res.data.user;

        const user = {
          ...resultUser,
          planFeautures: resultUser.features ? JSON.parse(resultUser.features) : null,
          features_description: resultUser.features_description
            ? JSON.parse(resultUser.features_description)
            : null,
        };
        saveUserDetailsInLocalStorage(user);

        const { role, scope } = getUserDetailsInLocalStorage();
        // A Business Group Owner has no per-user scope string (their access
        // comes from the business group), so they route like an admin.
        if (role == "admin" || role == "group_owner") {
          navigate("/dashboard/home", {
            replace: true,
          });
          return;
        }
        const userScopes = scope?.split(",") || [];
        if (userScopes.includes(SCOPES.DASHBOARD)) {
          navigate("/dashboard/home", {
            replace: true,
          });
          return;
        } else {
          navigate("/dashboard/profile", {
            replace: true,
          });
        }
        return;
      } else {
        const message = res.data.message;
        toast.dismiss();
        toast.error(message);
        return;
      }
    } catch (error) {
      console.error(error);
      const message =
        error?.response?.data?.message || error?.message || t("register.error_message");

      toast.dismiss();
      toast.error(message);
      return;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const bizName = e.target.biz_name.value;
    const email = e.target.username.value;
    const password = e.target.password.value;

    if (!bizName) {
      toast.error(t("register.business_name_error"));
      return;
    }

    if (!email) {
      toast.error(t("register.email_error"));
      return;
    }

    if (!password) {
      toast.error(t("register.password_error"));
      return;
    }

    if (!validateEmail(email)) {
      toast.error(t("register.valid_email_error"));
      return;
    }

    try {
      toast.loading(t("register.loading_message"));

      const res = await signUp(bizName, email, password);
      toast.dismiss();
      if (res.status == 200) {
        toast.success(res.data.message);
        navigate("/login", {
          replace: true,
        });
        return;
      } else {
        const message = res.data.message;
        toast.dismiss();
        toast.error(message);
        return;
      }
    } catch (error) {
      console.error(error);
      const message = error?.response?.data?.message || t("register.error_message");

      toast.dismiss();
      toast.error(message);
      return;
    }
  };

  return (
    <div className='relative overflow-x-hidden md:overflow-hidden bg-restro-green-light'> 
    <img
      src="/assets/circle_illustration.svg"
      alt="illustration"
      className='absolute w-96 lg:w-[1024px] h-96 lg:h-[1024px] lg:-bottom-96 lg:-right-52 -right-36 '
    />

    <div className="flex flex-col md:flex-row items-center justify-end md:justify-between gap-10 h-screen container mx-auto px-4 md:px-0 py-4 md:py-0 relative lg:px-12">
      <div className="lg:block hidden">
        <h3
          className='text-2xl lg:text-6xl font-black text-restro-green-dark dark:text-restro-green-dark-mode'
        >
          {t("register.signup_today")}
        </h3>
        <h3
          className='text-2xl lg:text-6xl font-black outline-text dark:text-green-600 text-restro-green-light'
        >
          {t("register.increase_productivity")}
        </h3>
      </div>

      <div className='border bg-white dark:bg-black border-restro-border-green rounded-2xl px-8 py-8 w-full sm:w-96 mx-8 sm:mx-0 shadow-2xl'>
        <div className="flex items-center justify-between">
          <div className='text-xl font-medium dark:text-green-100 text-restro-green-dark'>
            {t("register.title")}
          </div>
          <div>
            <img src={theme === "black" ? LogoDark : Logo} className="h-16" />
          </div>
        </div>

        <form className="mt-6" onSubmit={handleSubmit}>
          <div>
            <label
              htmlFor="biz_name"
              className={theme === 'black' ? 'text-gray-200' : ''}
            >
              {t("register.business_name_label")}
            </label>
            <input
              type="text"
              id="biz_name"
              name="biz_name"
              required
              placeholder={t("register.business_name_placeholder")}
              className = 'mt-1 block w-full px-4 py-3 rounded-xl outline-none focus-visible:ring-1 bg-restro-gray focus-visible:ring-restro-ring'
            />
          </div>

          <div className="mt-4">
            <label
              htmlFor="username"
              className={theme === 'black' ? 'text-gray-200' : ''}
            >
              {t("register.email_label")}
            </label>
            <input
              type="email"
              id="username"
              name="username"
              required
              placeholder={t("register.email_placeholder")}
              className='mt-1 block w-full px-4 py-3 rounded-xl outline-none focus-visible:ring-1 bg-restro-gray focus-visible:ring-restro-ring'
            />
          </div>

          <div className="mt-4">
            <label
              htmlFor="password"
              className={theme === 'black' ? 'text-gray-200' : ''}
            >
              {t("register.password_label")}
            </label>
            <input
              type="password"
              id="password"
              name="password"
              required
              placeholder={t("register.password_placeholder")}
              className='mt-1 block w-full px-4 py-3 rounded-xl outline-none focus-visible:ring-1 bg-restro-gray  focus-visible:ring-restro-ring'
            />
          </div>

          <button
            type="submit"
            className='block w-full mt-6 text-white rounded-xl px-4 py-3 transition hover:scale-105 active:scale-95 hover:shadow-md outline-none focus-visible:ring-1 bg-restro-green focus-visible:ring-restro-ring hover:bg-restro-green-button-hover'>
            {t("register.register_button")}
          </button>
                <div className="flex items-center gap-4 my-4">
              <div className={`flex-1 border-b ${theme === 'black' ? 'border-gray-600' : ''}`}></div>
              <p className={`text-sm ${theme === 'black' ? 'text-gray-300' : 'text-gray-400'}`}>
                {t("register.or")}
              </p>
              <div className={`flex-1 border-b ${theme === 'black' ? 'border-gray-600' : ''}`}></div>
            </div>
          {googleAuthClient && <>


            <button
              type="button"
              onClick={handleGoogleAuth}
              className="flex items-center justify-center gap-2 w-full mb-4 border border-restro-border-green dark:border-gray-700 bg-white dark:bg-black text-restro-green-dark dark:text-green-100 rounded-xl px-4 py-3 transition hover:scale-105 active:scale-95 hover:shadow-md outline-none focus-visible:ring-1 focus-visible:ring-restro-ring"
            >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                style={{ fill: "#4285F4" }}
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                style={{ fill: "#34A853" }}
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                style={{ fill: "#FBBC05" }}
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                style={{ fill: "#EA4335" }}
              />
            </svg>
              <span>{t("register.continue_with_google")}</span>
            </button>
          </>}

          <Link
            to="/login"
            className='block w-full text-center rounded-xl px-4 py-3 transition hover:scale-105 active:scale-95 hover:shadow-xl outline-none focus-visible:ring-1 bg-restro-gray hover:bg-restro-button-hover focus-visible:ring-restro-ring dark:focus-visible:ring-restro-ring-dark'
          >
            {t("register.signin_button")}
          </Link>
        </form>
      </div>
    </div>

    <EcosystemWidget />
    </div>

  );
}
