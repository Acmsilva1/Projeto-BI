import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./features/jornada/App";
import "./index.css";
import { applyTheme, defaultTheme } from "./theme/tokens";

applyTheme(defaultTheme);

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
