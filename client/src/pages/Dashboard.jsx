import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const Dashboard = () => {
  const { user } = useAuth();

  const cardClass =
    "glass-panel rounded-2xl p-6 shadow-glass transition hover:-translate-y-1 hover:shadow-lift";

  return (
    <section className="space-y-8">
      <div>
        <p className="text-sm uppercase text-slate-400">Welcome</p>
        <h1 className="text-3xl font-semibold text-white">
          {user?.name || "Agent"}, secure your next message
        </h1>
        <p className="mt-2 text-slate-300">
          Choose an action to encrypt data, extract hidden messages, or verify faces.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Link to="/encode" className={cardClass}>
          <h3 className="text-xl font-semibold text-white">Encode</h3>
          <p className="mt-2 text-sm text-slate-300">
            Encrypt a message and hide it inside a PNG image.
          </p>
        </Link>
        <Link to="/decode" className={`${cardClass} hidden`}>
          <h3 className="text-xl font-semibold text-white">Decode</h3>
          <p className="mt-2 text-sm text-slate-300">
            Extract and decrypt hidden data from a stego image.
          </p>
        </Link>
        <Link to="/face-decrypt" className={cardClass}>
          <h3 className="text-xl font-semibold text-white">Face Decrypt</h3>
          <p className="mt-2 text-sm text-slate-300">
            Verify your live face before decrypting a message.
          </p>
        </Link>
        <Link to="/face" className={cardClass}>
          <h3 className="text-xl font-semibold text-white">Face Verification</h3>
          <p className="mt-2 text-sm text-slate-300">
            Compare two faces and review the confidence score.
          </p>
        </Link>
        {user?.role === "admin" && (
          <Link to="/admin" className={cardClass}>
            <h3 className="text-xl font-semibold text-white">Admin</h3>
            <p className="mt-2 text-sm text-slate-300">
              Review users and registered face images.
            </p>
          </Link>
        )}
      </div>
    </section>
  );
};

export default Dashboard;
