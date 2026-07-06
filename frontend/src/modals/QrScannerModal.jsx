import { useEffect, useRef, useState } from "react";
import Modal from "../components/Modal.jsx";
import { getJsQR } from "../utils/loaders.js";

export default function QrScannerModal({ onScanned, onCancel }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const [status, setStatus] = useState("Kamera wird gestartet…");
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    function stop() {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    }

    async function start() {
      try {
        const jsQR = await getJsQR();
        if (cancelled) return;
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        setStatus("Halte den Code in den Rahmen");

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });

        function tick() {
          if (cancelled) return;
          if (video.readyState !== video.HAVE_ENOUGH_DATA) {
            rafRef.current = requestAnimationFrame(tick);
            return;
          }
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(img.data, img.width, img.height, {
            inversionAttempts: "dontInvert",
          });
          if (code && code.data) {
            cancelled = true;
            stop();
            onScanned(code.data);
            return;
          }
          rafRef.current = requestAnimationFrame(tick);
        }
        rafRef.current = requestAnimationFrame(tick);
      } catch (e) {
        setError(
          e.name === "NotAllowedError"
            ? "Kamerazugriff verweigert. Erlaube den Zugriff im Browser."
            : e.message
        );
      }
    }

    start();
    return () => {
      cancelled = true;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal onClose={onCancel}>
      <div className="qr-scanner">
        <div className="detail-head">
          <div className="detail-title">QR/Barcode scannen</div>
        </div>
        <div className="qr-video-wrap">
          <video ref={videoRef} playsInline muted className="qr-video" />
          <canvas ref={canvasRef} style={{ display: "none" }} />
          <div className="qr-scan-frame" />
        </div>
        <div className="qr-status">{status}</div>
        {error && <div className="alert">{error}</div>}
        <div className="detail-actions">
          <button type="button" className="btn-secondary btn-primary-block" onClick={onCancel}>
            Abbrechen
          </button>
        </div>
      </div>
    </Modal>
  );
}
