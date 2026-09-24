import { createRoot } from "react-dom/client";
// Fonts are bundled with the app instead of loaded from Google Fonts, so opening
// the app doesn't send visitors' IP addresses to Google before any consent. Only the
// Latin and Latin Extended character sets are included (English and Slovak text).
import "@fontsource/archivo/latin-500.css";
import "@fontsource/archivo/latin-ext-500.css";
import "@fontsource/archivo/latin-700.css";
import "@fontsource/archivo/latin-ext-700.css";
import "@fontsource/archivo/latin-900.css";
import "@fontsource/archivo/latin-ext-900.css";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-ext-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-ext-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-ext-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/inter/latin-ext-700.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(<App />);
