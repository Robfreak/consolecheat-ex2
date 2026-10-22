import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/source-sans-3/latin-400.css";
import "@fontsource/source-sans-3/latin-ext-400.css";
import "@fontsource/source-sans-3/cyrillic-400.css";
import "@fontsource/source-sans-3/cyrillic-ext-400.css";
import "@fontsource/source-sans-3/greek-400.css";
import "@fontsource/source-sans-3/vietnamese-400.css";
import "@fontsource/source-sans-3/latin-500.css";
import "@fontsource/source-sans-3/latin-ext-500.css";
import "@fontsource/source-sans-3/cyrillic-500.css";
import "@fontsource/source-sans-3/greek-500.css";
import "@fontsource/source-sans-3/latin-600.css";
import "@fontsource/source-sans-3/latin-ext-600.css";
import "@fontsource/source-sans-3/cyrillic-600.css";
import "@fontsource/source-sans-3/greek-600.css";
import "@fontsource/outfit/latin-500.css";
import "@fontsource/outfit/latin-ext-500.css";
import "@fontsource/outfit/latin-600.css";
import "@fontsource/outfit/latin-ext-600.css";
import { App } from "./App";
import "./styles.css";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
