import { createRoot } from "react-dom/client";
import AkisApp from "../app/AkisApp";
import "../app/globals.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Akış uygulama kökü bulunamadı.");
}

createRoot(root).render(<AkisApp />);
