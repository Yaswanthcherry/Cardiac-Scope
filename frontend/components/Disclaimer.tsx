"use client";

import { useState } from "react";

export default function Disclaimer() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-2xl w-[calc(100%-2rem)]">
      <div className="bg-amber-950/90 border border-amber-500/40 rounded-xl px-4 py-3 backdrop-blur-sm flex items-start gap-3 shadow-xl">
        <span className="text-amber-400 text-xl flex-shrink-0 mt-0.5">⚠️</span>
        <div className="flex-1 min-w-0">
          <p className="text-amber-200 text-sm font-semibold">Clinical Safety Disclaimer</p>
          <p className="text-amber-300/80 text-xs mt-0.5 leading-relaxed">
            CardioScope is for <strong>educational and decision-support purposes only</strong>.
            Predictions are not a substitute for formal diagnostic imaging, clinical examination,
            or professional medical advice. Always consult a qualified cardiologist.
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-amber-400/60 hover:text-amber-300 text-lg flex-shrink-0 transition-colors"
          aria-label="Dismiss disclaimer"
        >
          ×
        </button>
      </div>
    </div>
  );
}
