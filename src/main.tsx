import { createRoot, hydrateRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

if (typeof crypto !== "undefined" && typeof crypto.randomUUID !== "function") {
  crypto.randomUUID = () =>
    "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
      const random = (crypto.getRandomValues(new Uint8Array(1))[0] ?? 0) & 15;
      const value = char === "x" ? random : (random & 3) | 8;
      return value.toString(16);
    }) as `${string}-${string}-${string}-${string}-${string}`;
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root not found");
}

if (rootElement.hasChildNodes()) {
  hydrateRoot(rootElement, <App />);
} else {
  createRoot(rootElement).render(<App />);
}
