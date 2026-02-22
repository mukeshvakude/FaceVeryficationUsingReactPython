import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { apiRequest } from "../lib/api.js";
import CameraCapture from "../components/CameraCapture.jsx";

const FaceVerify = () => {
  const { token } = useAuth();
  const [imageA, setImageA] = useState(null);
  const [imageB, setImageB] = useState(null);
  const [result, setResult] = useState(null);
  const [liveBlob, setLiveBlob] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setResult(null);
    setLoading(true);

    try {
      if (!imageA || !imageB) {
        throw new Error("Please upload two images");
      }

      const formData = new FormData();
      formData.append("imageA", imageA);
      formData.append("imageB", imageB);

      const response = await apiRequest("/api/face/verify", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Verification failed");
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const registerLive = async (blob) => {
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("image", blob, "live-register.jpg");

      const response = await apiRequest("/api/face/register-live", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Face registration failed");
      }

      setMessage("Live face registered successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const verifyLive = async (blob) => {
    setError("");
    setMessage("");
    setResult(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("image", blob, "live-verify.jpg");

      const response = await apiRequest("/api/face/verify-live", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Live verification failed");
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="grid gap-8 lg:grid-cols-2">
      <div className="glass-panel gradient-border rounded-2xl p-8 shadow-glass">
        <h1 className="text-3xl font-semibold text-white">Face verification</h1>
        <p className="mt-2 text-slate-300">
          Compare two photos and review the matching confidence.
        </p>
        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <input
            className="w-full rounded-xl border border-slate-700/70 bg-slate-900/60 px-4 py-3 text-slate-100"
            type="file"
            accept="image/*"
            onChange={(event) => setImageA(event.target.files?.[0] || null)}
            required
          />
          <input
            className="w-full rounded-xl border border-slate-700/70 bg-slate-900/60 px-4 py-3 text-slate-100"
            type="file"
            accept="image/*"
            onChange={(event) => setImageB(event.target.files?.[0] || null)}
            required
          />
          {error && <p className="text-sm text-amber-300">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-ember px-4 py-3 text-slate-900 font-semibold transition hover:bg-orange-300 disabled:opacity-60"
          >
            {loading ? "Verifying..." : "Verify faces"}
          </button>
        </form>
      </div>
      <div className="glass-panel rounded-2xl p-8 shadow-lift">
        <h2 className="text-xl font-semibold text-white">Result</h2>
        <p className="mt-2 text-sm text-slate-300">The match outcome appears here.</p>
        {message && <p className="mt-4 text-sm text-moss">{message}</p>}
        {result ? (
          <div className="mt-6 space-y-2 text-sm text-slate-200">
            <p>
              <span className="text-slate-400">Verified:</span> {String(result.verified)}
            </p>
            <p>
              <span className="text-slate-400">Distance:</span> {result.distance}
            </p>
            <p>
              <span className="text-slate-400">Threshold:</span> {result.threshold}
            </p>
            <p>
              <span className="text-slate-400">Confidence:</span> {result.confidence}
            </p>
          </div>
        ) : (
          <p className="mt-6 text-sm text-slate-400">No verification yet.</p>
        )}
      </div>
      <div className="lg:col-span-2 grid gap-6">
        <CameraCapture
          label="Register live photo"
          onCapture={(blob) => registerLive(blob)}
        />
        <CameraCapture
          label="Verify with live photo"
          onCapture={(blob) => {
            setLiveBlob(blob);
            verifyLive(blob);
          }}
        />
        {error && <p className="text-sm text-amber-300">{error}</p>}
      </div>
    </section>
  );
};

export default FaceVerify;
