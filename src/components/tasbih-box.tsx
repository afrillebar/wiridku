"use client";

import { useState } from "react";
import type { TasbihStep } from "@/lib/content";
import { buzz } from "@/lib/haptic";

export function TasbihBox({ steps }: { steps: TasbihStep[] }) {
  const [index, setIndex] = useState(0);
  const [count, setCount] = useState(0);

  const finished = index >= steps.length;
  const cur = steps[Math.min(index, steps.length - 1)];

  const tap = () => {
    if (finished) return;
    buzz(8);
    if (count + 1 >= cur.target) {
      setIndex(index + 1);
      setCount(0);
    } else {
      setCount(count + 1);
    }
  };
  const reset = () => {
    setIndex(0);
    setCount(0);
  };

  return (
    <div className="tasbih-box">
      <div className="tasbih-word">
        <div className="ar" dir="rtl">
          {cur.arabic}
        </div>
        <div className="tr">{cur.transliteration}</div>
      </div>
      <div className="tasbih-count" aria-live="polite">
        {count}
        <span className="tasbih-target"> / {cur.target}</span>
      </div>
      <div className="tasbih-progress">
        <div className="tasbih-progress-bar" style={{ width: `${Math.min(100, (count / cur.target) * 100)}%` }} />
      </div>
      <div className="tasbih-buttons">
        {!finished && (
          <button type="button" className="tap-btn" onClick={tap}>
            Ketuk untuk hitung
          </button>
        )}
        <button type="button" className="reset-btn" onClick={reset}>
          Ulang
        </button>
      </div>
      {finished && (
        <p className="tasbih-done-note">
          Alhamdulillah, {steps.map((s) => s.target).join("× + ")}× selesai — lanjut ke bacaan penyempurna ↓
        </p>
      )}
    </div>
  );
}
