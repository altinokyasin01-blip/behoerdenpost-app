import { Component } from "react";
import AppErrorScreen from "./AppErrorScreen.jsx";

// Fängt Render-Fehler irgendwo im App-Baum ab, die sonst zu einem
// unwiederbringlichen weißen Bildschirm führen würden (React entfernt bei
// einem unbehandelten Fehler den kompletten Baum ab der Fehlerstelle).
// Muss eine Klassenkomponente sein -- Hooks können getDerivedStateFromError/
// componentDidCatch nicht abbilden.
export default class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Unhandled render error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <AppErrorScreen
          title="Etwas ist schiefgelaufen"
          message="Die App ist auf einen unerwarteten Fehler gestoßen. Ein Neuladen behebt das in der Regel."
        />
      );
    }
    return this.props.children;
  }
}
