import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { apiRequest } from "../lib/api.js";
import { aesEncrypt } from "../lib/cipher.js";

const Encode = () => {
  const { token } = useAuth();
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState([]);
  const [encryptionKey, setEncryptionKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailMessage, setEmailMessage] = useState("");
  const [encodedImage, setEncodedImage] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setDownloadUrl("");
    setEmailMessage("");
    setLoading(true);

    try {
      if (!files.length) {
        throw new Error("Please upload at least one PNG image");
      }

      const { cipherText, key } = await aesEncrypt(message);
      setEncryptionKey(key);
      setEncodedImage({ cipherText, key });

      const formData = new FormData();
      files.forEach((file) => formData.append("images", file));
      formData.append("cipherText", cipherText);

      const isBatch = files.length > 1;
      const response = await apiRequest(`/api/stego/encode${isBatch ? "?format=zip" : ""}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Encoding failed");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmail = async (event) => {
    event.preventDefault();
    setEmailMessage("");
    setError("");
    setEmailLoading(true);

    try {
      if (!recipientEmail) {
        throw new Error("Please enter recipient email");
      }

      if (!encryptionKey) {
        throw new Error("Please encode a message first");
      }

      if (!files.length) {
        throw new Error("No images to send");
      }

      // Validate email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(recipientEmail)) {
        throw new Error("Invalid email address");
      }

      const formData = new FormData();
      files.forEach((file) => formData.append("images", file));
      formData.append("recipientEmail", recipientEmail);
      formData.append("encryptionKey", encryptionKey);

      const response = await apiRequest("/api/stego/send-email", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to send email");
      }

      const data = await response.json();
      setEmailMessage(
        `✉️ Email sent successfully to ${recipientEmail}. They can decode it using the provided encryption key.`
      );
      setRecipientEmail("");
    } catch (err) {
      setError(err.message);
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <section className="grid gap-8 lg:grid-cols-2">
      <div className="glass-panel gradient-border rounded-2xl p-8 shadow-glass">
        <h1 className="text-3xl font-semibold text-white">Encode message</h1>
        <p className="mt-2 text-slate-300">Encrypt and hide a message inside PNG images.</p>
        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <textarea
            className="h-36 w-full rounded-xl border border-slate-700/70 bg-slate-900/60 px-4 py-3 text-slate-100 outline-none focus:border-glow"
            placeholder="Secret message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            required
          />
          <div>
            <label className="text-sm text-slate-300">Encryption key (save this)</label>
            <input
              className="mt-2 w-full rounded-xl border border-slate-700/70 bg-slate-900/60 px-4 py-2 text-slate-100"
              type="text"
              value={encryptionKey}
              readOnly
            />
          </div>
          <input
            className="w-full rounded-xl border border-slate-700/70 bg-slate-900/60 px-4 py-3 text-slate-100"
            type="file"
            accept="image/png"
            multiple
            onChange={(event) => setFiles(Array.from(event.target.files || []))}
            required
          />
          {error && <p className="text-sm text-amber-300">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-glow px-4 py-3 text-slate-900 font-semibold transition hover:bg-sky-300 disabled:opacity-60"
          >
            {loading ? "Encoding..." : files.length > 1 ? "Create stego zip" : "Create stego image"}
          </button>
        </form>
      </div>
      <div className="glass-panel rounded-2xl p-8 shadow-lift">
        <h2 className="text-xl font-semibold text-white">Download & Share</h2>
        <p className="mt-2 text-sm text-slate-300">Your stego output will be ready here.</p>
        <div className="mt-6 space-y-4">
          {downloadUrl ? (
            <>
              <a
                href={downloadUrl}
                download={files.length > 1 ? "stego-images.zip" : "stego.png"}
                className="inline-flex items-center rounded-full bg-ember px-6 py-3 text-slate-900 font-semibold hover:bg-orange-400 transition"
              >
                {files.length > 1 ? "Download stego zip" : "Download stego image"}
              </a>
              <div className="mt-4 pt-4 border-t border-slate-700">
                <h3 className="text-sm font-semibold text-white mb-2">Send via Email</h3>
                <form className="space-y-2" onSubmit={handleSendEmail}>
                  <input
                    className="w-full rounded-xl border border-slate-700/70 bg-slate-900/60 px-4 py-2 text-slate-100 text-sm"
                    type="email"
                    placeholder="Recipient email address"
                    value={recipientEmail}
                    onChange={(event) => setRecipientEmail(event.target.value)}
                    required
                  />
                  <button
                    type="submit"
                    disabled={emailLoading || !encryptionKey}
                    className="w-full rounded-xl bg-moss px-4 py-2 text-slate-900 font-semibold text-sm transition hover:bg-green-400 disabled:opacity-60"
                  >
                    {emailLoading ? "Sending..." : "Send via Email"}
                  </button>
                </form>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-400">Waiting for encoded output.</p>
          )}
        </div>
        {emailMessage && (
          <div className="mt-4 p-3 rounded-lg bg-moss/20 border border-moss">
            <p className="text-sm text-moss">{emailMessage}</p>
          </div>
        )}
      </div>
    </section>
  );
};

export default Encode;
