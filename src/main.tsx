import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "@fontsource-variable/inter-tight";
import "./index.css";
import Admin from "./admin/Admin";
import Till from "./till/Till";

registerSW({ immediate: true });

function useHash() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const on = () => setHash(location.hash);
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return hash;
}

function App() {
  const hash = useHash();
  // Plain hash names (#pos-receipts, #admin-orders, #till) so links survive being shared.
  if (hash.startsWith("#pos")) return <Admin section="pos" page={hash.slice(5) || "overview"} />;
  if (hash.startsWith("#admin-")) return <Admin section={hash.slice(7)} page="" />;
  return <Till />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
