import ReactDOM from "react-dom/client";

import App from "./App";
import "./styles/global.css";

// Pas de StrictMode : il double-monte les effets en dev, ce qui dédoublerait
// les abonnements aux événements audio (et donc les solves enregistrés).
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <App />,
);
