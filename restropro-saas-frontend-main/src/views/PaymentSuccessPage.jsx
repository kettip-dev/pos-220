import React from 'react'
import AppBarDropdown from '../components/AppBarDropdown'
import Page from "../components/Page";
import Logo from "../assets/logo.svg";
import LogoDark from "../assets/LogoDark.svg"
import { IconCircleCheckFilled, IconDashboard, IconLayoutDashboard, IconLogout } from '@tabler/icons-react';
import { iconStroke } from '../config/config';
import toast from 'react-hot-toast';
import { signOut } from '../controllers/auth.controller';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from "react-i18next";
import { useTheme } from '../contexts/ThemeContext';
import useAuth from '../helpers/useAuth';

export default function PaymentSuccessPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {theme} = useTheme();
  useAuth();

  return (
    <Page className=''>
      <div className="fixed flex items-center justify-between px-4 py-3 border-b border-restro-border-green w-full dark:bg-black">
        <img src={theme === "black" ? LogoDark : Logo} alt="logo" className="h-12 block" />

        {/* profile */}
        <AppBarDropdown />
        {/* profile */}
      </div>

      <div className="min-h-screen container mx-auto flex items-center justify-center flex-col">
        <IconCircleCheckFilled className='text-restro-green' size={48} />
        <h1 className="text-2xl font-bold mt-2">{t("payment_success.title")}</h1>
        <p className="text-center">
          {t("payment_success.message")}
        </p>

        <button onClick={() =>  navigate("/dashboard/home", { replace: true })} className='flex items-center justify-center gap-2 rounded-full px-4 py-3 mt-4 bg-red-50 text-restro-green transition hover:bg-restro-green-10 dark:bg-restro-green-10 dark:text-restro-green active:scale-95 dark:hover:bg-restro-green-10 text-sm'>
          <IconLayoutDashboard stroke={iconStroke} /> {t("payment_success.logout_button")}
        </button>
      </div>
    </Page>
  )
}
