import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { apiRequest } from "../lib/api.js";
import { aesDecrypt } from "../lib/cipher.js";
import CameraCapture from "../components/CameraCapture.jsx";

const FaceDecrypt = () => {
  const { token } = useAuth();
  const [stegoImage, setStegoImage] = useState(null);
  const [liveBlob, setLiveBlob] = useState(null);
  const [encryptionKey, setEncryptionKey] = useState("");
  const [cipherText, setCipherText] = useState("");
  const [message, setMessage] = useState("");
  const [verification, setVerification] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setCipherText("");
    setVerification(null);
    setLoading(true);

    try {
      if (!stegoImage || !liveBlob) {
        throw new Error("Stego image and live capture are required");
      }

      if (!encryptionKey) {
        throw new Error("Please enter the encryption key");
      }

      const formData = new FormData();
      formData.append("image", stegoImage);
      formData.append("live", liveBlob, "live-decrypt.jpg");

      const response = await apiRequest("/api/stego/decode-face", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Face decrypt failed");
      }

      const data = await response.json();
      
      // Check if face verification passed
      if (!data.verification?.verified) {
        throw new Error("Face verification failed - unauthorized access denied");
      }
      
      // Set cipher text and verification
      setCipherText(data.cipherText);
      setVerification(data.verification);
      
      // Decrypt client-side with user's key
      try {
        const decryptedMessage = await aesDecrypt(data.cipherText, encryptionKey);
        setMessage(decryptedMessage);
      } catch (decryptErr) {
        setMessage("Invalid encryption key or corrupted cipher text");
        setError("Decryption failed - check your encryption key");
      }
    } catch (err) {
      setError(err.message);
      setVerification(null);
      setMessage("");
      setCipherText("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="grid gap-8 lg:grid-cols-2">
      <div className="glass-panel gradient-border rounded-2xl p-8 shadow-glass">
        <h1 className="text-3xl font-semibold text-white">Face decrypt</h1>
        <p className="mt-2 text-slate-300">
          Verify your live face before decrypting a stego image.
        </p>
        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <input
            className="w-full rounded-xl border border-slate-700/70 bg-slate-900/60 px-4 py-3 text-slate-100"
            type="file"
            accept="image/png"
            onChange={(event) => setStegoImage(event.target.files?.[0] || null)}
            required
          />
          <div>
            <label className="text-sm text-slate-300">Encryption key</label>
            <input
              className="mt-2 w-full rounded-xl border border-slate-700/70 bg-slate-900/60 px-4 py-2 text-slate-100"
              type="text"
              value={encryptionKey}
              onChange={(event) => setEncryptionKey(event.target.value)}
              placeholder="Paste the key from Encode"
              required
            />
          </div>
          {error && <p className="text-sm text-amber-300">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-ember px-4 py-3 text-slate-900 font-semibold transition hover:bg-orange-300 disabled:opacity-60"
          >
            {loading ? "Verifying & Decrypting..." : "Verify face + decrypt"}
          </button>
        </form>
      </div>
      <div className="glass-panel rounded-2xl p-8 shadow-lift">
        <h2 className="text-xl font-semibold text-white">Message</h2>
        <p className="mt-2 text-sm text-slate-300">Decrypted text appears here.</p>
        <div className="mt-6 rounded-xl border border-slate-700/60 bg-slate-900/50 p-4 text-slate-100 min-h-[140px]">
          {message || "No message yet."}
        </div>
        {verification && (
          <div className={`mt-6 rounded-xl border p-4 ${
            verification.verified 
              ? 'bg-emerald-900/30 border-emerald-500/50' 
              : 'bg-red-900/30 border-red-500/50'
          }`}>
            <div className="flex items-center gap-2 mb-3">
              {verification.verified ? (
                <>
                  <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="font-semibold text-emerald-400">Face Verified ✓</p>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="font-semibold text-red-400">Face Verification Failed ✗</p>
                </>
              )}
            </div>
            <div className="space-y-1 text-sm text-slate-300">
              <p>Distance: <span className="font-mono">{verification.distance}</span></p>
              <p>Threshold: <span className="font-mono">{verification.threshold}</span> (must be below this)</p>
              <p>Confidence: <span className="font-mono">{(verification.confidence * 100).toFixed(2)}%</span></p>
              {verification.model_threshold && (
                <p className="text-xs text-slate-400">Model: Facenet512 (Cosine distance)</p>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="lg:col-span-2">
        <CameraCapture label="Live face check" onCapture={(blob) => setLiveBlob(blob)} />
      </div>
    </section>
  );
};

export default FaceDecrypt;
