import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { apiRequest } from "../lib/api.js";
import { aesDecrypt } from "../lib/cipher.js";

const Decode = () => {
  const { token } = useAuth();
  const [files, setFiles] = useState([]);
  const [encryptionKey, setEncryptionKey] = useState("");
  const [results, setResults] = useState([]);
  const [decodedResults, setDecodedResults] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const previewMap = useMemo(() => {
    const map = new Map();
    files.forEach((file) => {
      map.set(file.name, URL.createObjectURL(file));
    });
    return map;
  }, [files]);

  useEffect(() => {
    return () => {
      previewMap.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previewMap]);

  useEffect(() => {
    let isMounted = true;

    const runDecode = async () => {
      if (!results.length) {
        setDecodedResults([]);
        return;
      }

      const decoded = await Promise.all(
        results.map(async (item) => {
          try {
            const message = await aesDecrypt(item.cipherText || "", encryptionKey);
            return { ...item, decoded: message };
          } catch (err) {
            return { ...item, decoded: "Invalid key or cipher text." };
          }
        })
      );

      if (isMounted) {
        setDecodedResults(decoded);
      }
    };

    runDecode();

    return () => {
      isMounted = false;
    };
  }, [results, encryptionKey]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setResults([]);
    setLoading(true);

    try {
      if (!files.length) {
        throw new Error("Please upload at least one PNG image");
      }

      if (!token) {
        throw new Error("Not authenticated. Please login first.");
      }

      const formData = new FormData();
      files.forEach((file) => formData.append("images", file));

      console.log("Sending decode request with token:", token.substring(0, 20) + "...");

      const response = await apiRequest("/api/stego/decode", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Decoding failed");
      }

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/zip")) {
        throw new Error("Received a zip file. Use 'Download decoded zip' for ZIP output.");
      }

      const data = await response.json();
      setResults(data.results || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const allDecoded = decodedResults.length > 0 && decodedResults.every((item) => item.decoded && item.decoded !== "Invalid key or cipher text.");
  const hasDecodedError = decodedResults.some((item) => item.decoded === "Invalid key or cipher text.");

  return (
    <section className="grid gap-8 lg:grid-cols-2">
      <div className="glass-panel gradient-border rounded-2xl p-8 shadow-glass">
        <h1 className="text-3xl font-semibold text-white">Decode message</h1>
        <p className="mt-2 text-slate-300">Upload stego PNG images to reveal cipher text.</p>
        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <input
            className="w-full rounded-xl border border-slate-700/70 bg-slate-900/60 px-4 py-3 text-slate-100"
            type="file"
            accept="image/png"
            multiple
            onChange={(event) => setFiles(Array.from(event.target.files || []))}
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
            />
          </div>
          {error && <p className="text-sm text-amber-300">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-glow px-4 py-3 text-slate-900 font-semibold transition hover:bg-sky-300 disabled:opacity-60"
          >
            {loading ? "Decoding..." : "Reveal messages"}
          </button>
        </form>
      </div>
      <div className="glass-panel rounded-2xl p-8 shadow-lift">
        <h2 className="text-xl font-semibold text-white">Decoded results</h2>
        <p className="mt-2 text-sm text-slate-300">Cipher text and decoded message per image.</p>
        <div className="mt-6 space-y-4">
          {decodedResults.length > 0 && (
            <div className={`rounded-xl border px-4 py-3 text-sm ${allDecoded ? "border-emerald-500/50 bg-emerald-900/30 text-emerald-200" : "border-amber-500/50 bg-amber-900/30 text-amber-200"}`}>
              {allDecoded
                ? "All images decrypted successfully."
                : "Some images could not be decrypted. Check the key and try again."}
            </div>
          )}
          {decodedResults.length ? (
            decodedResults.map((item) => (
              <div key={item.filename} className="rounded-xl border border-slate-700/60 bg-slate-900/50 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start">
                  <div className="w-full md:w-44">
                    {previewMap.get(item.filename) ? (
                      <img
                        src={previewMap.get(item.filename)}
                        alt={item.filename}
                        className="w-full rounded-lg border border-slate-700/60 object-cover"
                      />
                    ) : (
                      <div className="rounded-lg border border-slate-700/60 bg-slate-900/70 p-3 text-xs text-slate-400">
                        Image preview unavailable
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-slate-400">{item.filename}</p>
                    <p className="mt-2 text-sm text-slate-300">Cipher text</p>
                    <div className="mt-2 rounded-lg border border-slate-700/60 bg-slate-900/70 p-3 text-slate-100">
                      {item.cipherText}
                    </div>
                    {hasDecodedError && item.decoded === "Invalid key or cipher text." && (
                      <p className="mt-2 text-xs text-amber-300">Check the encryption key or re-upload the correct stego image.</p>
                    )}
                    <p className="mt-3 text-sm text-slate-300">Decoded message</p>
                    <div className="mt-2 rounded-lg border border-slate-700/60 bg-slate-900/70 p-3 text-slate-100">
                      {item.decoded}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 p-4 text-slate-100 min-h-[140px]">
              No messages yet.
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default Decode;
