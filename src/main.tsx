import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "@fontsource-variable/inter-tight";
import "./index.css";
import Admin from "./admin/Admin";
import AdminGate from "./admin/AdminGate";
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
  if (hash.startsWith("#admin")) {
    // Legacy prototype links (#admin-orders, etc.) — POS admin only has #pos-* pages.
    if (hash !== "#pos-overview") location.replace(`${location.pathname}${location.search}#pos-overview`);
    return null;
  }
  if (hash.startsWith("#pos")) {
    const page = hash.slice(5) || "overview";
    return (
      <AdminGate>
        {(staff, signOut) => <Admin page={page} staff={staff} onSignOut={signOut} />}
      </AdminGate>
    );
  }
  return <Till />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
