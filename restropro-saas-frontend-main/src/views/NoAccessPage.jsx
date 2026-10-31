import React from 'react';
import { useTranslation } from 'react-i18next';
import Page from "../components/Page";
import Logo from "../assets/logo.svg";
import LogoDark from "../assets/LogoDark.svg"
import { IconChevronLeft, IconLayoutDashboard } from '@tabler/icons-react';
import { iconStroke } from '../config/config';
import { useNavigate, Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { getUserDetailsInLocalStorage } from '../helpers/UserDetails';

export default function NoAccessPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {theme} = useTheme();
  const user = getUserDetailsInLocalStorage();

  const homePath = user?.role === "superadmin" ? "/superadmin/dashboard/home" : "/dashboard/home";

  return (
    <Page className='px-4 py-3 flex flex-col items-center justify-center w-full min-h-screen'>
      <img src={theme === "black" ? LogoDark : Logo} alt="logo" className="h-14 block mb-6" />
      <h3 className="text-2xl font-bold text-center">{t('no_access.title')}</h3>

      <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
        <button onClick={() => navigate(-1)} className='btn btn-sm px-4 py-2 rounded-xl border border-gray-200 dark:border-zinc-800 hover:bg-restro-button-hover flex items-center gap-1.5'>
          <IconChevronLeft stroke={iconStroke} size={18} /> {t('no_access.go_back')}
        </button>
        <Link to={homePath} className='btn btn-sm px-4 py-2 rounded-xl bg-[#2CA01C] hover:bg-[#248417] text-white flex items-center gap-1.5 font-medium shadow-sm'>
          <IconLayoutDashboard stroke={iconStroke} size={18} /> {t('navbar.dashboard', 'Go to Dashboard')}
        </Link>
      </div>
    </Page>
  )
}
