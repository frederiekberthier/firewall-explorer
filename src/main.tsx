import { createRoot } from "react-dom/client";
// Self-hosted fonts (no requests to Google Fonts), same as the other Graduaat IoT apps.
import "@fontsource-variable/nunito";
import "@fontsource-variable/open-sans";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
