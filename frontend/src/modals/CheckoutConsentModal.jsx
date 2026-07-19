import { useState } from "react";
import Modal from "../components/Modal.jsx";
import LegalModal from "./LegalModal.jsx";

const CHECKOUT_INFO = {
  subscription: {
    label: "Smart-Abo",
    price: "3,90€/Monat",
    note: "Läuft danach monatlich weiter, bis zur Kündigung in den Einstellungen.",
  },
  credits: {
    label: "15 Credits",
    price: "0,50€ einmalig",
    note: "Einmalzahlung, keine Wiederholung.",
  },
};

// Pflicht-Checkbox vor jedem Checkout, § 356 Abs. 5 BGB: das gesetzliche
// 14-tägige Widerrufsrecht bei digitalen Leistungen erlischt nur vorzeitig,
// wenn der Nutzer AKTIV (nicht vorangehakt) zustimmt, dass die Leistung vor
// Fristablauf beginnt, UND bestätigt, dass ihm der dadurch entstehende
// Verlust des Widerrufsrechts bekannt ist. Ohne dieses Häkchen bleibt der
// "Weiter zu Stripe"-Button gesperrt.
export default function CheckoutConsentModal({ type, onConfirm, onClose }) {
  const [agreed, setAgreed] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);
  const info = CHECKOUT_INFO[type];
  if (!info) return null;

  return (
    <Modal onClose={onClose}>
      <div className="disclaimer">
        <h2 className="disclaimer-title">
          {info.label} — {info.price}
        </h2>
        <p className="disclaimer-text">
          Du wirst zu Stripe weitergeleitet, um die Zahlung abzuschließen.{" "}
          {info.note}
        </p>
        <label className="google-sync-toggle">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <div className="google-sync-body">
            <div className="google-sync-title">
              Sofortiger Beginn der Leistung
            </div>
            <div className="google-sync-sub">
              Ich stimme ausdrücklich zu, dass die Leistung vor Ablauf der
              14-tägigen Widerrufsfrist beginnt. Mir ist bekannt, dass ich
              dadurch mein Widerrufsrecht verliere, sobald mit der
              Ausführung begonnen wurde. Details:{" "}
              <button
                type="button"
                className="legal-inline-link"
                onClick={() => setLegalOpen(true)}
              >
                Widerrufsrecht
              </button>
            </div>
          </div>
        </label>
        <button
          type="button"
          className="btn-primary btn-primary-block"
          disabled={!agreed}
          onClick={onConfirm}
        >
          Weiter zu Stripe
        </button>
        <button
          type="button"
          className="btn-secondary btn-primary-block"
          onClick={onClose}
        >
          Abbrechen
        </button>
      </div>
      {legalOpen && (
        <LegalModal type="widerruf" onClose={() => setLegalOpen(false)} />
      )}
    </Modal>
  );
}
