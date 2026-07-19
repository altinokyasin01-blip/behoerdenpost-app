export const APP_VERSION = "0.1.0";
export const SUPPORT_EMAIL = "support@buero.app";
// Eigenständige Versionierung für die Datenschutzerklärung — unabhängig von
// APP_VERSION (Software-Release), da Rechtstexte nach eigenem Anlass
// (z.B. neue Server-Standorte) revisioniert werden, nicht nach App-Releases.
const PRIVACY_VERSION = "0.4.0";
const PRIVACY_DATE = "19.07.2026";

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
        <p>
          <strong>Online-Streitbeilegung</strong>
          <br />
          Die Europäische Kommission stellt eine Plattform zur
          Online-Streitbeilegung (OS) bereit, die Sie unter
          https://ec.europa.eu/consumers/odr/ finden. Zur Teilnahme an einem
          Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle
          sind wir nicht verpflichtet und nicht bereit.
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
          <strong>Zahlungsabwicklung (Stripe)</strong>
          <br />
          Für die Abwicklung kostenpflichtiger Leistungen (Abonnements,
          Credit-Käufe) nutzen wir den Zahlungsdienstleister Stripe Payments
          Europe, Ltd., 1 Grand Canal Street Lower, Grand Canal Dock, Dublin,
          Irland. Im Rahmen der Zahlungsabwicklung übermitteln wir an Stripe
          die zur Vertragserfüllung erforderlichen Daten, insbesondere Name,
          E-Mail-Adresse und Zahlungsinformationen. Die Verarbeitung erfolgt
          auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung).
          Mit Stripe besteht ein Auftragsverarbeitungsvertrag gemäß Art. 28
          DSGVO. Weitere Informationen zum Datenschutz bei Stripe finden Sie
          unter: https://stripe.com/de/privacy
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
          Büro nutzt aktuell die Anthropic Claude API (für KI-Analysen), für
          kostenpflichtige Funktionen (Smart-Abo, Credits) den
          Zahlungsdienstleister Stripe sowie optional die Google Calendar API
          (für Kalender-Synchronisation). Weitere Verknüpfungen — z.B. Apple
          Kalender, Outlook oder andere Cloud-Dienste — können in zukünftigen
          Versionen ergänzt werden. Ihre Nutzung ist jeweils optional und
          wird an der betreffenden Stelle in der App explizit als solche
          gekennzeichnet.
        </p>
        <p>
          <strong>6. Datenschutz</strong>
          <br />
          Siehe Datenschutzerklärung.
        </p>
        <p>
          <strong>7. Widerrufsrecht</strong>
          <br />
          Für kostenpflichtige Leistungen (Smart-Abo, Credit-Käufe) gilt das
          gesetzliche Widerrufsrecht für Verbraucher. Die vollständige
          Widerrufsbelehrung mit Muster-Widerrufsformular findest du unter
          „Widerrufsrecht" in den Einstellungen. Beim Kauf holen wir deine
          ausdrückliche Zustimmung zum vorzeitigen Beginn der Leistung
          separat per Checkbox ein.
        </p>
        <p>
          <strong>8. Änderungen</strong>
          <br />
          Diese Bedingungen können sich ändern. Aktuelle Fassung immer in der
          App einsehbar.
        </p>
        <p className="detail-muted">Stand: Version {APP_VERSION}</p>
      </>
    ),
  },
  widerruf: {
    title: "Widerrufsrecht",
    body: (
      <>
        <p>
          Diese Belehrung gilt für den Kauf kostenpflichtiger Leistungen in
          Büro (Smart-Abo, Credit-Käufe).
        </p>
        <p>
          <strong>Widerrufsrecht</strong>
          <br />
          Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen
          diesen Vertrag zu widerrufen. Die Widerrufsfrist beträgt vierzehn
          Tage ab dem Tag des Vertragsabschlusses.
        </p>
        <p>
          Um Ihr Widerrufsrecht auszuüben, müssen Sie uns (Yasin Altinok,
          Stolberger Straße 209, 52068 Aachen, E-Mail: kontakt@meinbuero.app)
          mittels einer eindeutigen Erklärung (z.B. ein mit der Post
          versandter Brief oder E-Mail) über Ihren Entschluss, diesen Vertrag
          zu widerrufen, informieren. Sie können dafür das unten stehende
          Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben
          ist.
        </p>
        <p>
          Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die
          Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der
          Widerrufsfrist absenden.
        </p>
        <p>
          <strong>Folgen des Widerrufs</strong>
          <br />
          Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen,
          die wir von Ihnen erhalten haben, unverzüglich und spätestens
          binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die
          Mitteilung über Ihren Widerruf bei uns eingegangen ist. Für diese
          Rückzahlung verwenden wir dasselbe Zahlungsmittel, das Sie bei der
          ursprünglichen Transaktion eingesetzt haben. Haben Sie verlangt,
          dass die Leistung während der Widerrufsfrist beginnen soll, so
          haben Sie uns einen angemessenen Betrag zu zahlen, der dem Anteil
          der bis zu dem Zeitpunkt Ihrer Widerrufsmitteilung bereits
          erbrachten Leistung im Vergleich zum Gesamtumfang der vertraglich
          vereinbarten Leistung entspricht.
        </p>
        <p>
          <strong>Vorzeitiges Erlöschen des Widerrufsrechts</strong>
          <br />
          Ihr Widerrufsrecht erlischt vorzeitig, wenn wir die Leistung
          vollständig erbracht bzw. mit der Bereitstellung der digitalen
          Inhalte begonnen haben, nachdem Sie ausdrücklich zugestimmt haben,
          dass wir vor Ablauf der Widerrufsfrist mit der Ausführung des
          Vertrags beginnen, und Sie bestätigt haben, dass Sie wissen, dass
          Sie durch diese Zustimmung Ihr Widerrufsrecht verlieren. Diese
          Zustimmung holen wir beim Kauf ausdrücklich per Checkbox ein, bevor
          Sie zur Zahlung weitergeleitet werden.
        </p>
        <p>
          <strong>Muster-Widerrufsformular</strong>
          <br />
          (Wenn Sie den Vertrag widerrufen wollen, füllen Sie bitte dieses
          Formular aus und senden Sie es an kontakt@meinbuero.app.)
        </p>
        <p>
          An Yasin Altinok, Stolberger Straße 209, 52068 Aachen:
          <br />
          — Hiermit widerrufe(n) ich/wir den von mir/uns abgeschlossenen
          Vertrag über die Erbringung der folgenden Leistung: Smart-Abo /
          Credit-Kauf (Zutreffendes bitte angeben)
          <br />
          — Bestellt am:
          <br />
          — Name des/der Verbraucher(s):
          <br />
          — Anschrift des/der Verbraucher(s):
          <br />
          — Datum:
        </p>
        <p className="detail-muted">
          Stand: {PRIVACY_DATE} — Version {PRIVACY_VERSION}
        </p>
      </>
    ),
  },
};
