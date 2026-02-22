import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const Navbar = () => {
  const { isAuthenticated, logout, user } = useAuth();

  const navClass = ({ isActive }) =>
    `rounded-full px-4 py-2 text-sm font-semibold transition ${
      isActive ? "bg-slate-100 text-slate-900" : "text-slate-200 hover:text-white"
    }`;

  return (
    <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
        <Link to="/dashboard" className="text-lg font-semibold text-white">
          SecureVision Stego
        </Link>
        <nav className="flex items-center gap-2">
          {isAuthenticated ? (
            <>
              <NavLink to="/dashboard" className={navClass}>
                Dashboard
              </NavLink>
              <NavLink to="/encode" className={navClass}>
                Encode
              </NavLink>
              <NavLink to="/decode" className={`${navClass} hidden`}>
                Decode
              </NavLink>
              <NavLink to="/face-decrypt" className={navClass}>
                Face Decrypt
              </NavLink>
              <NavLink to="/face" className={navClass}>
                Face Verify
              </NavLink>
              {user?.role === "admin" && (
                <NavLink to="/admin" className={navClass}>
                  Admin
                </NavLink>
              )}
              <button
                type="button"
                onClick={logout}
                className="rounded-full border border-slate-500/60 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-200 hover:text-white"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className={navClass}>
                Login
              </NavLink>
              <NavLink to="/register" className={navClass}>
                Register
              </NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Navbar;
