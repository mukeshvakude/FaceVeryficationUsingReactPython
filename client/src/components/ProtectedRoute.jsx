import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-10 animate-fade-up">
      {children}
    </div>
  );
};

export default ProtectedRoute;
