import { useEffect, useRef, useState } from "react";

const getAverageDiff = (dataA, dataB) => {
  let diff = 0;
  for (let i = 0; i < dataA.length; i += 4) {
    diff += Math.abs(dataA[i] - dataB[i]);
    diff += Math.abs(dataA[i + 1] - dataB[i + 1]);
    diff += Math.abs(dataA[i + 2] - dataB[i + 2]);
  }
  return diff / (dataA.length / 4);
};

const CameraCapture = ({ label, onCapture }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [warning, setWarning] = useState("");

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  const startCamera = async () => {
    setWarning("");
    try {
      const media = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      setStream(media);
      if (videoRef.current) {
        videoRef.current.srcObject = media;
      }
    } catch (err) {
      console.error("Camera access error:", err);
      
      let errorMsg = "Camera access failed. ";
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        errorMsg += "Please allow camera permissions in your browser settings.";
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        errorMsg += "No camera found. Please connect a camera.";
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        errorMsg += "Camera is already in use by another application. Close other apps using the camera.";
      } else if (err.name === "OverconstrainedError") {
        errorMsg += "Camera doesn't support the requested resolution.";
      } else {
        errorMsg += err.message || "Unknown error occurred.";
      }
      
      setWarning(errorMsg);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    setStream(null);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const captureFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  };

  const capture = async () => {
    if (!stream) {
      try {
        await startCamera();
      } catch (err) {
        // Error already handled in startCamera
      }
      return;
    }

    setWarning("");
    const first = captureFrame();
    await new Promise((resolve) => setTimeout(resolve, 700));
    const second = captureFrame();

    if (first && second) {
      const diff = getAverageDiff(first.data, second.data);
      if (diff < 2) {
        setWarning("Minimal movement detected. Try blinking or turning your head.");
      }
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg"));
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    onCapture(blob);
  };

  return (
    <div className="glass-panel rounded-xl p-1.5 shadow-glass">
      <p className="text-[10px] uppercase text-slate-400">{label}</p>
      <div className="mt-1.5 grid gap-2 md:grid-cols-[1.2fr_1fr]">
        <div className="rounded-lg border border-slate-700/60 bg-slate-900/60 p-1">
          <video ref={videoRef} autoPlay playsInline className="w-full rounded-md" />
          <canvas ref={canvasRef} className="hidden" />
        </div>
        <div className="rounded-lg border border-slate-700/60 bg-slate-900/60 p-1.5 text-[10px] text-slate-300">
          {previewUrl ? (
            <img src={previewUrl} alt="capture preview" className="w-full rounded-md" />
          ) : (
            <p>Start the camera and capture a live photo.</p>
          )}
        </div>
      </div>
      {warning && (
        <p className={`mt-1.5 text-[10px] ${warning.includes("failed") || warning.includes("error") ? "text-red-400" : "text-amber-300"}`}>
          {warning}
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-1">
        <button
          type="button"
          onClick={startCamera}
          className="rounded-full border border-slate-500/60 px-2.5 py-0.5 text-[10px] font-semibold text-slate-200"
        >
          Start camera
        </button>
        <button
          type="button"
          onClick={stopCamera}
          className="rounded-full border border-slate-500/60 px-2.5 py-0.5 text-[10px] font-semibold text-slate-200"
        >
          Stop camera
        </button>
        <button
          type="button"
          onClick={capture}
          className="rounded-full bg-ember px-2.5 py-0.5 text-[10px] font-semibold text-slate-900"
        >
          Capture
        </button>
      </div>
    </div>
  );
};

export default CameraCapture;
