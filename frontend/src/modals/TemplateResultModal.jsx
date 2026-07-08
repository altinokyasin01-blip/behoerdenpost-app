import { useState } from "react";
import Modal from "../components/Modal.jsx";
import CategoryChip from "../components/CategoryChip.jsx";

export default function TemplateResultModal({
  result,
  existingCategories,
  onCopy,
  onPrint,
  onSaveAsDoc,
  onSaveAsTemplate,
  onClose,
}) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedAsTemplate, setSavedAsTemplate] = useState(false);
  const [category, setCategory] = useState(result.category || "Vorlagen");

  async function handleCopy() {
    const text = `Betreff: ${result.subject}\n\n${result.body}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  }

  function handleSave() {
    onSaveAsDoc(category);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  function handleSaveAsTemplate() {
    onSaveAsTemplate();
    setSavedAsTemplate(true);
    setTimeout(() => setSavedAsTemplate(false), 1800);
  }

  return (
    <Modal onClose={onClose}>
      <div className="detail">
        <div className="detail-head">
          <div className="detail-title">{result.templateLabel}</div>
        </div>

        <section className="detail-section">
          <h3 className="detail-heading">Betreff</h3>
          <p className="detail-text">{result.subject}</p>
        </section>

        <section className="detail-section">
          <div className="detail-heading-row">
            <h3 className="detail-heading">Anschreiben</h3>
            <button type="button" className="copy-btn" onClick={handleCopy}>
              {copied ? "Kopiert" : "Kopieren"}
            </button>
          </div>
          <pre className="code-block">{result.body}</pre>
        </section>

        <div className="print-area" aria-hidden="true">
          <h1>{result.subject}</h1>
          <pre>{result.body}</pre>
        </div>

        <div className="form-field">
          <label>Kategorie beim Speichern als Dokument</label>
          <CategoryChip
            value={category}
            existingCategories={existingCategories}
            onChange={setCategory}
          />
        </div>

        <div className="detail-actions detail-actions-stack">
          <button
            type="button"
            className="btn-primary btn-primary-block"
            onClick={onPrint}
          >
            Als PDF drucken
          </button>
          <button
            type="button"
            className="btn-secondary btn-primary-block"
            onClick={handleSave}
            disabled={saved}
          >
            {saved ? "Gespeichert" : "Als Dokument speichern"}
          </button>
          <button
            type="button"
            className="btn-secondary btn-primary-block"
            onClick={handleSaveAsTemplate}
            disabled={savedAsTemplate}
          >
            {savedAsTemplate ? "Als Vorlage gespeichert" : "Als Vorlage speichern"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
