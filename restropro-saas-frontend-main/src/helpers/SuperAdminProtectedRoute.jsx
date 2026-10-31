import { Navigate } from "react-router-dom";
import { getUserDetailsInLocalStorage } from "./UserDetails";

const SuperAdminProtectedRoute = ({ children }) => {
  const user = getUserDetailsInLocalStorage();
  const role = user?.role;
  
  if (role === "superadmin" || role === "admin") {
    return children;
  }

  // If logged in with another role, redirect to dashboard home rather than showing no-access
  if (role) {
    return <Navigate to="/dashboard/home" replace />;
  }

  return <Navigate to="/superadmin/login" replace />;
};

export default SuperAdminProtectedRoute;
