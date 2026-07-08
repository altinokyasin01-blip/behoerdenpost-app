import { useState } from "react";
import { IconChevron, IconTemplate } from "../components/icons.jsx";
import CardMenu from "../components/CardMenu.jsx";
import ShowMoreButton from "../components/ShowMoreButton.jsx";
import { TEMPLATE_TYPES } from "../utils/domainConstants.js";

export default function TemplatesView({
  onPick,
  savedTemplates,
  onUseSavedTemplate,
  onDeleteSavedTemplate,
}) {
  const [showAll, setShowAll] = useState(false);

  return (
    <>
      <h2 className="section-title">Vorlagen</h2>
      <p className="lead">
        Wähle eine Vorlage, beschreibe kurz den Kontext — Claude verfasst das
        Anschreiben.
      </p>

      {savedTemplates && savedTemplates.length > 0 && (
        <>
          <h2 className="section-title">Meine Vorlagen</h2>
          <div className="template-grid">
            {(showAll ? savedTemplates : savedTemplates.slice(0, 5)).map((t) => {
              const typeLabel = TEMPLATE_TYPES.find((x) => x.id === t.templateType)?.label;
              return (
                <div key={t.id} className="card template-card template-card-wrap">
                  <button
                    type="button"
                    className="template-card-body"
                    onClick={() => onUseSavedTemplate(t)}
                  >
                    <div className="template-icon">
                      <IconTemplate size={22} />
                    </div>
                    <div className="template-body">
                      <div className="template-title">{t.title}</div>
                      {typeLabel && <div className="template-desc">{typeLabel}</div>}
                    </div>
                    <IconChevron />
                  </button>
                  <CardMenu
                    items={[
                      { label: "Löschen", onClick: () => onDeleteSavedTemplate(t.id) },
                    ]}
                  />
                </div>
              );
            })}
          </div>
          <ShowMoreButton
            total={savedTemplates.length}
            visibleCount={5}
            expanded={showAll}
            onToggle={() => setShowAll((v) => !v)}
          />
        </>
      )}

      <h2 className="section-title">Neue Vorlage</h2>
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
    </>
  );
}
