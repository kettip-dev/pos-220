import React from "react";
import {
  IconAlertTriangle,
  IconStar,
  IconClock,
} from "@tabler/icons-react";
import {
  LowStockAlerts,
  FeedbackWidget,
  ReservationWidget,
} from "../../components/DashboardWidgets";
import { ContextLoading } from "../system/EmptyContext";

function ready(context) {
  return context && !context.isLoading && context.data;
}

export function LowStockWidget({ context }) {
  if (!ready(context)) return <ContextLoading />;
  return <LowStockAlerts items={context.data?.lowStockAlerts || []} />;
}

export function FeedbackWidgetWrap({ context }) {
  if (!ready(context)) return <ContextLoading />;
  return <FeedbackWidget feedbacks={context.data?.recentFeedback || []} />;
}

export function ReservationsWidget({ context }) {
  if (!ready(context)) return <ContextLoading />;
  return <ReservationWidget reservations={context.data?.reservations || []} />;
}

export const ICONS = { IconAlertTriangle, IconStar, IconClock };
