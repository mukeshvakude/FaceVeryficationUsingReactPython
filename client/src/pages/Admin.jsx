import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { apiRequest } from "../lib/api.js";

const Admin = () => {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [thumbs, setThumbs] = useState({});

  const loadUsers = async () => {
    setError("");
    setLoading(true);
    try {
      const response = await apiRequest("/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to load users");
      }

      const data = await response.json();
      setUsers(data.users || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadThumbnail = async (userId) => {
    try {
      const response = await apiRequest(`/api/admin/faces/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setThumbs((prev) => ({ ...prev, [userId]: url }));
    } catch {
      // Ignore image load errors.
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-white">Admin Console</h1>
        <p className="mt-2 text-slate-300">
          View registered users and face images.
        </p>
      </div>

      {error && <p className="text-sm text-amber-300">{error}</p>}
      <div className="glass-panel rounded-2xl p-6 shadow-glass">
        <div className="flex items-center justify-between">
          <p className="text-sm uppercase text-slate-400">Users</p>
          <button
            type="button"
            onClick={loadUsers}
            className="rounded-full border border-slate-500/60 px-4 py-2 text-sm font-semibold text-slate-200"
          >
            Refresh
          </button>
        </div>
        {loading ? (
          <p className="mt-4 text-sm text-slate-300">Loading users...</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm text-slate-200">
              <thead>
                <tr className="text-left text-slate-400">
                  <th className="pb-2">User</th>
                  <th className="pb-2">Role</th>
                  <th className="pb-2">Created</th>
                  <th className="pb-2">Face</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {users.map((user) => (
                  <tr key={user.id} className="align-middle">
                    <td className="py-3">
                      <div className="font-semibold text-white">{user.name}</div>
                      <div className="text-slate-400">{user.email}</div>
                    </td>
                    <td className="py-3 capitalize">{user.role || "user"}</td>
                    <td className="py-3 text-slate-400">
                      {user.createdAt?.slice(0, 10) || "-"}
                    </td>
                    <td className="py-3">
                      {user.faceImagePath ? (
                        <div className="flex items-center gap-3">
                          {thumbs[user.id] ? (
                            <img
                              src={thumbs[user.id]}
                              alt="face thumbnail"
                              className="h-12 w-12 rounded-full object-cover"
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => loadThumbnail(user.id)}
                              className="rounded-full border border-slate-500/60 px-3 py-1 text-xs font-semibold text-slate-200"
                            >
                              Load
                            </button>
                          )}
                          <span className="text-xs text-slate-400">{user.faceImagePath}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">No face</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};

export default Admin;
