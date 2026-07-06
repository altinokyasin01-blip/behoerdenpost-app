import { IconChevron, IconTemplate } from "../components/icons.jsx";
import { TEMPLATE_TYPES } from "../utils/domainConstants.js";

export default function TemplatesView({ onPick }) {
  return (
    <div className="view">
      <header className="view-header">
        <h1>Vorlagen</h1>
        <p className="lead">
          Wähle eine Vorlage, beschreibe kurz den Kontext — Claude verfasst das
          Anschreiben.
        </p>
      </header>

      <div className="template-grid">
        {TEMPLATE_TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            className="card template-card"
            onClick={() => onPick(t.id)}
          >
            <div className="template-icon">
              <IconTemplate size={22} />
            </div>
            <div className="template-body">
              <div className="template-title">{t.label}</div>
              <div className="template-desc">{t.desc}</div>
            </div>
            <IconChevron />
          </button>
        ))}
      </div>
    </div>
  );
}
