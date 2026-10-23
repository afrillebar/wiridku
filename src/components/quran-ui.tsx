"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { nextReaderScroll, readerScrollStart } from "@/lib/reader-scroll";

const modalBackgrounds = new Map<HTMLElement, { count: number; inert: boolean }>();
let modalCount = 0;
let bodyOverflow = "";

export function useReadingControls(enabled: boolean) {
  const [hidden, setHidden] = useState(false);
  const showControls = useCallback(() => setHidden(false), []);
  useEffect(() => {
    if (!enabled) return;
    let state = readerScrollStart(window.scrollY);
    let frame = requestAnimationFrame(() => {
      state = readerScrollStart(window.scrollY);
      showControls();
    });
    const scroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        state = nextReaderScroll(state, window.scrollY, Math.max(0, document.documentElement.scrollHeight - window.innerHeight));
        setHidden(state.hidden);
      });
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key !== "Tab" && event.key !== "Escape") return;
      state = readerScrollStart(window.scrollY);
      showControls();
    };
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("keydown", keyboard);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("keydown", keyboard);
    };
  }, [enabled, showControls]);
  return { hidden: enabled && hidden, showControls };
}

export function QuranModeToggle({ mode, onChange }: { mode: "baca" | "dengar"; onChange: (mode: "baca" | "dengar") => void }) {
  return (
    <div className="quran-mode" role="group" aria-label="Mode Al-Qur’an">
      {(["baca", "dengar"] as const).map((value) => (
        <button key={value} type="button" aria-pressed={mode === value} onClick={() => onChange(value)}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {value === "baca" ? <path d="M12 5v15M12 5C9 3 5 3 3 4v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-2-1-6-1-9 1Z" /> : <><path d="M4 15v-3a8 8 0 0 1 16 0v3" /><rect x="3" y="13" width="5" height="8" rx="2" /><rect x="16" y="13" width="5" height="8" rx="2" /></>}
          </svg>
          {value === "baca" ? "Baca" : "Dengar"}
        </button>
      ))}
    </div>
  );
}

export function useModalFocus(ref: RefObject<HTMLElement | null>, onClose: () => void) {
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (modalCount++ === 0) bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () => Array.from(node.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href], select:not(:disabled), [tabindex="0"]')).filter((el) => !el.closest('[inert], [aria-hidden="true"]') && el.getClientRects().length > 0);
    (focusables()[0] ?? node).focus({ preventScroll: true });
    // Each nested dialog owns a lock, so closing both at once restores the page.
    const backgrounds: HTMLElement[] = [];
    let branch: HTMLElement = node;
    while (branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (!(sibling instanceof HTMLElement) || sibling === branch || /^(SCRIPT|STYLE|LINK)$/.test(sibling.tagName)) continue;
        const lock = modalBackgrounds.get(sibling) ?? { count: 0, inert: sibling.inert };
        lock.count++;
        modalBackgrounds.set(sibling, lock);
        sibling.setAttribute("inert", "");
        backgrounds.push(sibling);
      }
      if (branch.parentElement === document.body) break;
      branch = branch.parentElement;
    }
    const keydown = (event: KeyboardEvent) => {
      const dialogs = document.querySelectorAll('[aria-modal="true"]');
      if (dialogs[dialogs.length - 1] !== node) return;
      if (event.key === "Escape") {
        event.preventDefault();
        close.current();
      }
      if (event.key === "Tab") {
        const items = focusables();
        const first = items[0] ?? node;
        const last = items[items.length - 1] ?? node;
        if (!node.contains(document.activeElement) || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      for (const background of backgrounds) {
        const lock = modalBackgrounds.get(background);
        if (lock && --lock.count === 0) {
          background.toggleAttribute("inert", lock.inert);
          modalBackgrounds.delete(background);
        }
      }
      if (--modalCount === 0) document.body.style.overflow = bodyOverflow;
      requestAnimationFrame(() => {
        if (previous?.isConnected) previous.focus({ preventScroll: true });
      });
    };
  }, [ref]);
}

export function QuranDrawer({ title, dark = false, onClose, children }: { title: string; dark?: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const id = useId();
  useModalFocus(ref, onClose);
  return (
    <div className={dark ? "lsn-sheet-wrap" : "qrn-sheet-wrap"} onClick={onClose}>
      <section ref={ref} className={`${dark ? "lsn-sheet" : "qrn-sheet"} quran-drawer`} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1} onClick={(event) => event.stopPropagation()}>
        <span className="quran-drawer-grip" aria-hidden="true" />
        <div className="quran-drawer-head">
          <h2 id={id}>{title}</h2>
          <button type="button" onClick={onClose} aria-label={`Tutup ${title.toLowerCase()}`}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <div className="quran-drawer-body">{children}</div>
      </section>
    </div>
  );
}
