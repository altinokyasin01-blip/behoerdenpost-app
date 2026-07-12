export const APP_VERSION = "0.1.0";
export const SUPPORT_EMAIL = "support@buero.app";
// Eigenständige Versionierung für die Datenschutzerklärung — unabhängig von
// APP_VERSION (Software-Release), da Rechtstexte nach eigenem Anlass
// (z.B. neue Server-Standorte) revisioniert werden, nicht nach App-Releases.
const PRIVACY_VERSION = "0.3.0";
const PRIVACY_DATE = "12.07.2026";

export const LEGAL_TEXTS = {
  impressum: {
    title: "Impressum",
    body: (
      <>
        <p>
          <strong>Angaben gemäß § 5 TMG</strong>
        </p>
        <p>
          Yasin Altinok
          <br />
          Stolberger Straße 209
          <br />
          52068 Aachen
          <br />
          Deutschland
        </p>
        <p>
          <strong>Kontakt</strong>
          <br />
          E-Mail: kontakt@meinbuero.app
        </p>
        <p>
          <strong>Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV</strong>
          <br />
          Yasin Altinok
        </p>
      </>
    ),
  },
  datenschutz: {
    title: "Datenschutzerklärung",
    body: (
      <>
        <p>
          Deine Privatsphäre ist uns wichtig. Diese Erklärung beschreibt,
          welche Daten Büro verarbeitet, wo sie gespeichert werden und was
          mit ihnen passiert.
        </p>
        <p>
          <strong>Was wir speichern und wo</strong>
          <br />
          Deine Dokumente, Kontakte, Erinnerungen, Termine und
          App-Einstellungen werden in einer Datenbank bei{" "}
          <strong>Supabase</strong> gespeichert, gehostet in der
          Europäischen Union (Frankreich). Der Zugriff ist durch eine
          gesicherte Anmeldung (Supabase Auth) sowie durch
          Zeilenebene-Sicherheit (Row Level Security) so eingeschränkt, dass
          ausschließlich du selbst — authentifiziert über dein Konto — auf
          deine eigenen Daten zugreifen kannst.
        </p>
        <p>
          Supabase ist ein US-amerikanisches Unternehmen. Auch bei
          Speicherung auf Servern innerhalb der EU kann dies bedeuten, dass
          US-Behörden unter bestimmten gesetzlichen Voraussetzungen (US
          CLOUD Act) Zugriff auf die Daten verlangen könnten. Mit Supabase
          besteht ein Auftragsverarbeitungsvertrag (AVV) gemäß Art. 28
          DSGVO.
        </p>
        <p>
          Zusätzlich werden einige Daten lokal in deinem Browser
          zwischengespeichert (z.B. für Offline-Zugriff und Performance) —
          das ist eine Ergänzung, kein Ersatz für die Cloud-Speicherung bei
          Supabase.
        </p>
        <p>
          Wenn du Ordner über die File-System-Access-Funktion freigibst (nur
          Chrome/Edge Desktop), wird der extrahierte Text lokal in deinem
          Browser verarbeitet und bleibt auf deinem Gerät — diese Funktion
          läuft unabhängig von der Server-Speicherung.
        </p>
        <p>
          <strong>Was an unser Backend geht</strong>
          <br />
          Büro nutzt ein eigenes Backend, gehostet bei{" "}
          <strong>Railway</strong> in der Europäischen Union (Amsterdam,
          Niederlande), über das Anfragen an die Anthropic Claude API
          laufen. Alle Anfragen an das Backend sind durch eine
          Authentifizierung (JWT über Supabase) geschützt — nur du kannst
          mit deinem eigenen Konto Analysen auslösen. Mit Railway besteht
          ein Auftragsverarbeitungsvertrag (AVV) gemäß Art. 28 DSGVO.
        </p>
        <p>
          <strong>Was an externe Dienste außerhalb der EU geht</strong>
        </p>
        <p>
          <strong>Anthropic Claude API (USA):</strong> Für die KI-Analyse
          werden Dokumente und Textinhalte über unser Backend an die
          Anthropic Claude API übertragen — beim Scannen das Bild/PDF, bei
          Vorlagen, Widerspruch-Check und QR-Analyse der jeweilige
          Textinhalt. Diese Übertragung in die USA ist für die Kernfunktion
          der App (KI-gestützte Dokumentenanalyse) technisch notwendig. Die
          Datenübermittlung erfolgt auf Grundlage von
          Standardvertragsklauseln (SCC) bzw. den von Anthropic
          bereitgestellten Datenschutzgarantien. Die Daten werden von
          Anthropic gemäß deren Datenschutzerklärung behandelt
          (anthropic.com/privacy) und laut Anbieter nicht dauerhaft zu
          Trainingszwecken der Basismodelle verwendet.
        </p>
        <p>
          <strong>Google Calendar API (optional, aktuell nicht aktiv):</strong>{" "}
          Bei aktivierter Google-Calendar-Verknüpfung fließen von dir
          erstellte Fristen/Termine direkt aus deinem Browser zur Google
          Calendar API. Diese Funktion ist derzeit deaktiviert
          („Coming soon") und wird erst nach erneuter Aktivierung genutzt.
        </p>
        <p>
          <strong>Was NICHT passiert</strong>
          <br />
          Kein Tracking, keine Analytics, keine Werbe-Cookies. Keine
          Weitergabe deiner Daten an Dritte außer den oben genannten, für
          den Betrieb der App notwendigen Diensten (Supabase, Railway,
          Anthropic, optional Google).
        </p>
        <p>
          <strong>Deine Rechte nach DSGVO</strong>
        </p>
        <ul>
          <li>
            <strong>Auskunft:</strong> „Daten exportieren" liefert eine
            vollständige JSON-Kopie deiner bei uns gespeicherten Daten.
          </li>
          <li>
            <strong>Löschung:</strong> „Alle Daten löschen" entfernt deine
            Daten sowohl lokal als auch aus der Supabase-Datenbank.
          </li>
          <li>
            <strong>Widerruf/Kontoschließung:</strong> Kontaktiere uns unter
            kontakt@meinbuero.app, um dein Konto und alle zugehörigen Daten
            vollständig löschen zu lassen.
          </li>
          <li>
            <strong>Beschwerderecht:</strong> Du hast das Recht, dich bei der
            für dich zuständigen Datenschutz-Aufsichtsbehörde zu beschweren.
          </li>
        </ul>
        <p>
          <strong>Verantwortlich</strong>
          <br />
          Siehe Impressum.
        </p>
        <p className="detail-muted">
          Stand: {PRIVACY_DATE} — Version {PRIVACY_VERSION}
        </p>
      </>
    ),
  },
  agb: {
    title: "Nutzungsbedingungen",
    body: (
      <>
        <p>
          <strong>1. Was Büro ist</strong>
          <br />
          Büro ist ein persönlicher Assistent für die Verwaltung von Post,
          Fristen, Kontakten und Terminen. Die App analysiert deine Dokumente
          mit KI (Anthropic Claude) und schlägt Aktionen vor.
        </p>
        <p>
          <strong>2. Was Büro NICHT ist</strong>
          <br />
          Büro ersetzt keine juristische, steuerliche oder finanzielle
          Beratung. Alle Analysen und Vorschläge sind unverbindliche
          Hinweise — keine Rechts- oder Steuerauskunft.
        </p>
        <p>
          <strong>3. Haftung für KI-generierte Inhalte</strong>
          <br />
          Alle Analysen, Zusammenfassungen, Vorlagen-Anschreiben,
          Widerspruch-Einschätzungen und Aktions-Vorschläge werden durch ein
          KI-Sprachmodell erzeugt. KI-Systeme können falsche Angaben liefern,
          Fristen falsch lesen, Beträge verwechseln oder rechtliche
          Einschätzungen abgeben, die im konkreten Fall unzutreffend sind.
          Wir übernehmen <strong>keinerlei Gewähr</strong> für die
          Richtigkeit, Vollständigkeit oder rechtliche Verbindlichkeit dieser
          Ausgaben. Prüfe jede automatisch erzeugte Information selbst bevor
          du danach handelst.
        </p>
        <p>
          <strong>4. Deine Verantwortung</strong>
          <br />
          Für Entscheidungen auf Basis der App-Ausgaben bist du selbst
          verantwortlich. Bei rechtlich oder finanziell bedeutenden
          Angelegenheiten konsultiere einen Anwalt, Steuerberater oder
          anderen Fachmann.
        </p>
        <p>
          <strong>5. Externe Dienste</strong>
          <br />
          Büro nutzt aktuell die Anthropic Claude API (für KI-Analysen) und
          optional die Google Calendar API (für Kalender-Synchronisation).
          Weitere Verknüpfungen — z.B. Apple Kalender, Outlook oder andere
          Cloud-Dienste — können in zukünftigen Versionen ergänzt werden.
          Ihre Nutzung ist jeweils optional und wird an der betreffenden
          Stelle in der App explizit als solche gekennzeichnet.
        </p>
        <p>
          <strong>6. Datenschutz</strong>
          <br />
          Siehe Datenschutzerklärung.
        </p>
        <p>
          <strong>7. Änderungen</strong>
          <br />
          Diese Bedingungen können sich ändern. Aktuelle Fassung immer in der
          App einsehbar.
        </p>
        <p className="detail-muted">Stand: Version {APP_VERSION}</p>
      </>
    ),
  },
};
