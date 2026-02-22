import { Navigate, Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Admin from "./pages/Admin.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Decode from "./pages/Decode.jsx";
import Encode from "./pages/Encode.jsx";
import FaceDecrypt from "./pages/FaceDecrypt.jsx";
import FaceVerify from "./pages/FaceVerify.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";

const App = () => {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/encode"
            element={
              <ProtectedRoute>
                <Encode />
              </ProtectedRoute>
            }
          />
          <Route
            path="/decode"
            element={
              <ProtectedRoute>
                <Decode />
              </ProtectedRoute>
            }
          />
          <Route
            path="/face-decrypt"
            element={
              <ProtectedRoute>
                <FaceDecrypt />
              </ProtectedRoute>
            }
          />
          <Route
            path="/face"
            element={
              <ProtectedRoute>
                <FaceVerify />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <Admin />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
    </div>
  );
};

export default App;
