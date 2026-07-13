"use client";

import { useI18n } from "../i18n";

export function EffortGuide() {
  const { language } = useI18n();
  const tr = language === "tr";

  return (
    <aside className="effort-guide" role="note" aria-label={tr ? "İş yükü rehberi" : "Effort guide"}>
      <strong>{tr ? "İş yükü rehberi" : "Effort guide"}</strong>
      <span>{tr ? "1–3: Küçük işler" : "1–3: Small tasks"}</span>
      <span>{tr ? "5–8: Orta veya zor işler" : "5–8: Medium or difficult tasks"}</span>
      <span>{tr ? "13: Çok zor, çok adımlı veya belirsiz iş" : "13: Very difficult, multi-step, or uncertain work"}</span>
    </aside>
  );
}
