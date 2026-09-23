import { createRoot } from "react-dom/client";
// Fonts are bundled with the app instead of loaded from Google Fonts, so opening
// the app doesn't send visitors' IP addresses to Google before any consent.
import "@fontsource/archivo/500.css";
import "@fontsource/archivo/700.css";
import "@fontsource/archivo/900.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(<App />);
