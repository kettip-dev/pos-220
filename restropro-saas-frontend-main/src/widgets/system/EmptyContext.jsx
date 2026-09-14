import React from "react";
import { IconLoader2 } from "@tabler/icons-react";
import { iconStroke } from "../../config/config";

export function NoData({ message = "No data available." }) {
  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-xs text-restro-text">{message}</p>
    </div>
  );
}

export function ContextLoading() {
  return (
    <div className="flex h-full items-center justify-center">
      <IconLoader2 className="animate-spin text-restro-green" size={20} stroke={iconStroke} />
    </div>
  );
}
