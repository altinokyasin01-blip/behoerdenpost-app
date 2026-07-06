import { useRef, useState } from "react";
import API_BASE from "../config.js";
import { IconUpload, IconCamera, IconQr } from "../components/icons.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import QrScannerModal from "../modals/QrScannerModal.jsx";
import { formatDate } from "../utils/format.js";
import { detectQrCodes } from "../utils/qrScan.js";

export default function ScanView({ docs, isFirstScan, onScanned, onOpenDoc }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [analyzingQr, setAnalyzingQr] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  async function handleFile(file) {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("document", file);
      // Promise.all waits for both, even if QR detection (large multi-page
      // PDF) takes longer than the Claude round-trip — no race/timeout that
      // could silently drop codes on slow documents.
      const [res, qrCodes] = await Promise.all([
        fetch(`${API_BASE}/api/analyze`, {
          method: "POST",
          body: formData,
        }),
        detectQrCodes(file, file.type),
      ]);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const result = await res.json();
      onScanned({ ...result, filename: file.name, qrCodes });
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleQrScanned(text) {
    setQrOpen(false);
    setError(null);
    setAnalyzingQr(true);
    try {
      const res = await fetch(`${API_BASE}/api/qr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const result = await res.json();
      onScanned({ ...result, filename: "QR-Code" });
    } catch (e) {
      setError("QR-Analyse: " + e.message);
    } finally {
      setAnalyzingQr(false);
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  }

  return (
    <div className="view">
      <header className="view-header">
        <h1>Scannen</h1>
        <p className="lead">Dokument hochladen oder mit Kamera aufnehmen.</p>
      </header>

      {isFirstScan && (
        <div className="first-scan-coach">
          <div className="first-scan-coach-head">Dein erster Scan</div>
          <div className="first-scan-coach-body">
            Zieh eine PDF-Datei rein oder tipp auf die Fläche. Claude erkennt
            Absender, Frist und Betrag und schlägt vor, was du damit tun
            kannst.
          </div>
        </div>
      )}

      <div
        className={`dropzone ${dragging ? "dragging" : ""} ${
          uploading ? "uploading" : ""
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        <div className="dropzone-icon">
          <IconUpload />
        </div>
        <div className="dropzone-title">
          {uploading ? "Analysiere…" : "Datei hier ablegen oder wählen"}
        </div>
        <div className="dropzone-sub">PDF, JPG oder PNG · max. 15 MB</div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/*"
          hidden
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>

      <button
        className="camera-btn"
        onClick={() => cameraInputRef.current?.click()}
        disabled={uploading || analyzingQr}
      >
        <IconCamera />
        <span>Foto aufnehmen</span>
      </button>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      <button
        className="camera-btn"
        onClick={() => setQrOpen(true)}
        disabled={uploading || analyzingQr}
      >
        <IconQr />
        <span>{analyzingQr ? "Claude analysiert QR…" : "QR/Barcode scannen"}</span>
      </button>

      {qrOpen && (
        <QrScannerModal
          onScanned={handleQrScanned}
          onCancel={() => setQrOpen(false)}
        />
      )}

      {error && <div className="alert">Fehler: {error}</div>}

      {docs.length === 0 ? (
        <div className="card scan-empty">
          <div className="scan-empty-title">
            Ihr erstes Dokument wartet darauf erkannt zu werden.
          </div>
          <div className="scan-empty-sub">Büro erkennt zuverlässig:</div>
          <ul className="scan-empty-list">
            <li>Behördenbriefe &amp; Mahnungen</li>
            <li>Rechnungen &amp; Zahlungsaufforderungen</li>
            <li>Verträge &amp; wichtige Schreiben</li>
          </ul>
          <button
            type="button"
            className="btn-primary btn-primary-block"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || analyzingQr}
          >
            Jetzt scannen
          </button>
        </div>
      ) : (
        <>
          <h2 className="section-title">Scan-Verlauf</h2>
          <div className="doc-list">
            {docs.map((d) => (
              <button
                key={d.id}
                type="button"
                className="card doc-card"
                onClick={() => onOpenDoc(d.id)}
              >
                <div className="doc-body">
                  <div className="doc-title">{d.title}</div>
                  <div className="doc-meta">
                    {d.sender} · {formatDate(d.date)}
                  </div>
                </div>
                <StatusBadge status={d.status} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
