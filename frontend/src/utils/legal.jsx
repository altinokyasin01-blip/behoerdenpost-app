export const APP_VERSION = "0.1.0";
export const SUPPORT_EMAIL = "support@buero.app";

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
          Deine Privatsphäre ist der Kern der App. Büro ist bewusst als lokale
          Web-App gebaut — deine Daten liegen bei dir, nicht bei uns.
        </p>
        <p>
          <strong>Was auf deinem Gerät gespeichert wird</strong>
          <br />
          Dokumente, Kontakte, Erinnerungen, Termine, App-Einstellungen und
          (wenn du Ordner freigibst) der extrahierte Text lokaler Dateien.
          Alles landet ausschließlich in localStorage und IndexedDB deines
          Browsers — nicht bei uns, nicht auf fremden Servern.
        </p>
        <p>
          <strong>Was temporär an externe Dienste geht</strong>
          <br />
          Für die KI-Analyse werden Dokumente und Textinhalte kurzzeitig an
          die Anthropic Claude API übertragen: beim Scannen das Bild/PDF, bei
          Vorlagen/Widerspruch-Check/QR-Analyse der jeweilige Textinhalt.
          Diese Übertragung ist für die Analyse notwendig; die Daten werden
          von Anthropic gemäß deren Datenschutzerklärung
          (anthropic.com/privacy) behandelt und laut Anbieter{" "}
          <strong>nicht dauerhaft zu Trainingszwecken gespeichert</strong>.
          Bei aktivierter Google-Calendar-Verknüpfung fließen die von dir
          erstellten Fristen/Termine direkt aus deinem Browser zur Google
          Calendar API — kein Backend-Umweg über uns.
        </p>
        <p>
          <strong>Was NICHT passiert</strong>
          <br />
          Kein Tracking, keine Analytics, keine Cookies. Keine Weitergabe an
          Dritte über die genannten APIs hinaus. Kein eigener Server, der
          deine Daten dauerhaft speichert.
        </p>
        <p>
          <strong>Deine Rechte nach DSGVO</strong>
          <br />
          Auskunft: „Daten exportieren" liefert eine vollständige JSON-Kopie.
          Löschung: „Alle Daten löschen" wischt alles vom Gerät. Widerruf:
          einfach nicht mehr benutzen.
        </p>
        <p>
          <strong>Verantwortlich</strong>
          <br />
          Siehe Impressum.
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
