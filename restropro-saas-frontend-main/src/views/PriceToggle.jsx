import React from 'react';
import { useTranslation } from 'react-i18next';

const PricingToggle = ({ isYearly, onToggle }) => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center gap-4 mb-12 relative">
      <span className={`text-base font-semibold transition-colors ${!isYearly ? 'text-foreground' : 'text-muted-foreground'}`}>
        {t("inactive_subscription.pay_monthly")}
      </span>
      <button
        onClick={onToggle}
        className={`relative w-16 h-8 rounded-full p-1 transition-colors duration-300 ${
          isYearly ? 'bg-restro-green-10' : 'bg-restro-green-10'
        }`}
      >
        <div
          className={`w-6 h-6 bg-restro-green rounded-full shadow-md transition-transform duration-300 ${
            isYearly ? 'translate-x-8' : 'translate-x-0'
          }`}
        />
      </button>
      <span className={`text-base font-semibold transition-colors ${isYearly ? 'text-foreground' : 'text-muted-foreground'}`}>
        {t("inactive_subscription.pay_yearly")}
      </span>
      
      {/* Curved Arrow and Save Badge */}
      {/* <div className="absolute left-[calc(50%+130px)] top-1/4 translate-y-1/3 flex items-center">
        <svg 
          width="40" 
          height="30" 
          viewBox="0 0 40 30" 
          fill="none" 
          className="text-restro-green -mr-1"
        >
          <path 
            d="M2 2C2 2 8 2 12 8C16 14 14 22 20 26C24 28 32 28 38 24" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round"
            fill="none"
          />
          <path 
            d="M32 20L38 24L34 30" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
        <span className="text-restro-green font-bold text-lg ml-1">
          Save More
        </span>
      </div> */}
    </div>
  );
};

export default PricingToggle;
