"use client";

import { useEffect, useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { moveRows, remove, setStatus, toggleActive, type RowResult } from "@/actions/content";
import { DataTable } from "@/components/admin/data-table";
import { assignNumbers } from "@/lib/numbering";
import type { AudioSource } from "@/lib/audio-source";

export type Status = "draft" | "published" | "archived";
const STATUS_LABEL: Record<Status, string> = { draft: "Draft", published: "Terbit", archived: "Arsip" };

function StatusBadge({ status }: { status: Status }) {
  return <span className={`badge ${status}`}>{STATUS_LABEL[status]}</span>;
}

type Entity = "phase" | "recitation";
type Base = { id: string; group: string; sort_order: number; status: Status; active: boolean };
type Op = { t: "toggle"; id: string } | { t: "status"; id: string; to: Status } | { t: "remove"; id: string } | { t: "set"; rows: Base[] };

// Swaps a row with its neighbour inside its group and renumbers the group 1..n, like the server will.
function reorder<T extends Base>(rows: T[], id: string, dir: -1 | 1): { rows: T[]; changes: { id: string; sort_order: number }[] } | null {
  const me = rows.find((r) => r.id === id);
  if (!me) return null;
  const positions = rows.flatMap((r, i) => (r.group === me.group ? [i] : []));
  const sibs = positions.map((p) => rows[p]);
  const i = sibs.findIndex((r) => r.id === id);
  const j = i + dir;
  if (j < 0 || j >= sibs.length) return null;
  [sibs[i], sibs[j]] = [sibs[j], sibs[i]];

  const next = rows.slice();
  const changes: { id: string; sort_order: number }[] = [];
  sibs.forEach((r, idx) => {
    if (r.sort_order !== idx + 1) changes.push({ id: r.id, sort_order: idx + 1 });
    next[positions[idx]] = { ...r, sort_order: idx + 1 };
  });
  return { rows: next, changes };
}

function apply<T extends Base>(rows: T[], op: Op): T[] {
  switch (op.t) {
    case "toggle":
      return rows.map((r) => (r.id === op.id ? { ...r, active: !r.active } : r));
    case "status":
      return rows.map((r) => (r.id === op.id ? { ...r, status: op.to } : r));
    case "remove":
      return rows.filter((r) => r.id !== op.id);
    case "set":
      return op.rows as T[];
  }
}

function useRows<T extends Base>(initial: T[], entity: Entity) {
  const [rows, dispatch] = useOptimistic(initial, apply<T>);
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<RowResult | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const run = (op: Op, call: () => Promise<RowResult>) =>
    start(async () => {
      dispatch(op);
      const res = await call();
      setToast(res);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setToast(null), res.error ? 7000 : 2500);
    });

  return {
    rows,
    pending,
    toast,
    toggle: (r: T) => run({ t: "toggle", id: r.id }, () => toggleActive(entity, r.id, !r.active)),
    setStatus: (r: T, to: Status) => run({ t: "status", id: r.id, to }, () => setStatus(entity, r.id, to)),
    remove: (r: T) => run({ t: "remove", id: r.id }, () => remove(entity, r.id)),
    move: (r: T, dir: -1 | 1) => {
      const moved = reorder(rows, r.id, dir);
      if (moved) run({ t: "set", rows: moved.rows }, () => moveRows(entity, moved.changes));
    },
  };
}

function Toast({ toast, pending }: { toast: RowResult | null; pending: boolean }) {
  const text = toast?.error ?? toast?.ok ?? (pending ? "Menyimpan…" : null);
  return (
    <div className="toast-region" role="status" aria-live="polite">
      {text && <div className={`toast${toast?.error ? " error" : ""}`}>{text}</div>}
    </div>
  );
}

type Api<T extends Base> = ReturnType<typeof useRows<T>>;

function Actions<T extends Base>({ r, api, isAdmin, editHref, confirmRemove }: { r: T; api: Api<T>; isAdmin: boolean; editHref: string; confirmRemove: string }) {
  const ask = (message: string, go: () => void) => () => window.confirm(message) && go();
  return (
    <div className="row-actions">
      <button type="button" className="btn small" aria-label="Naikkan" onClick={() => api.move(r, -1)}>
        ↑
      </button>
      <button type="button" className="btn small" aria-label="Turunkan" onClick={() => api.move(r, 1)}>
        ↓
      </button>
      <Link prefetch={false} className="btn small" href={editHref}>
        Edit
      </Link>
      <button type="button" className="btn small" onClick={() => api.toggle(r)}>
        {r.active ? "Nonaktifkan" : "Aktifkan"}
      </button>
      {isAdmin && (
        <>
          {r.status !== "published" ? (
            <button type="button" className="btn small primary" onClick={ask("Publikasikan sekarang? Langsung tampil di halaman publik.", () => api.setStatus(r, "published"))}>
              Terbitkan
            </button>
          ) : (
            <button type="button" className="btn small" onClick={ask("Tarik ke draft? Hilang dari halaman publik.", () => api.setStatus(r, "draft"))}>
              Tarik ke draft
            </button>
          )}
          {r.status === "archived" ? (
            <button type="button" className="btn small" onClick={() => api.setStatus(r, "draft")}>
              Pulihkan
            </button>
          ) : (
            <button type="button" className="btn small" onClick={ask("Arsipkan? Hilang dari halaman publik.", () => api.setStatus(r, "archived"))}>
              Arsipkan
            </button>
          )}
          <button type="button" className="btn small danger" onClick={ask(confirmRemove, () => api.remove(r))}>
            Hapus
          </button>
        </>
      )}
    </div>
  );
}

// ---------- phases ----------

export type PhaseRow = Base & { slug: string; title: string; count: number };

export function PhaseTable({ initial, isAdmin }: { initial: PhaseRow[]; isAdmin: boolean }) {
  const api = useRows(initial, "phase");
  return (
    <>
      <Toast toast={api.toast} pending={api.pending} />
      <DataTable
        colSpan={6}
        empty="Belum ada fase."
        head={
          <tr>
            <th>No</th>
            <th>Judul</th>
            <th>Status</th>
            <th>Aktif</th>
            <th>Bacaan</th>
            <th>Aksi</th>
          </tr>
        }
        rows={api.rows.map((p, i) => (
          <tr key={p.id}>
            <td data-label="No">{i + 1}</td>
            <td className="wide">
              <strong>{p.title}</strong>
              <br />
              <code>{p.slug}</code>
            </td>
            <td data-label="Status">
              <StatusBadge status={p.status} />
            </td>
            <td data-label="Aktif">{p.active ? "Ya" : "Tidak"}</td>
            <td data-label="Bacaan">{p.count}</td>
            <td className="wide">
              <Actions r={p} api={api} isAdmin={isAdmin} editHref={`/putrazea/phases/${p.id}`} confirmRemove="Hapus fase ini permanen? Hanya bisa jika fase kosong." />
            </td>
          </tr>
        ))}
      />
    </>
  );
}

// ---------- recitations ----------

export type AudioKinds = { recording: string | null; synthetic: boolean; youtube: boolean };
export type RecitationRow = Base & { slug: string; title: string; kind: "standard" | "tasbih"; show_number: boolean; source: AudioSource; audio: AudioKinds; arabic_empty: boolean };
export type PhaseInfo = { id: string; title: string; status: Status; active: boolean; continue_numbering: boolean };

// recording holds the reciter name ("" when unnamed), null when the card has no recording
export function SourceBadges({ audio, source }: { audio: AudioKinds; source: AudioSource }) {
  const items: [AudioSource, string, boolean, string?][] = [
    ["mp3", "MP3", audio.recording !== null, audio.recording || undefined],
    ["tts", "TTS", audio.synthetic],
    ["youtube", "YouTube", audio.youtube],
  ];
  const any = items.some(([, , has]) => has);
  return (
    <span className="src-badges">
      {items.map(([kind, label, has, title]) =>
        has ? (
          <span key={kind} className={`src-badge${kind === source ? " on" : ""}`} title={title ?? (kind === source ? "Dipakai pengunjung" : undefined)}>
            {kind === source && "● "}
            {label}
          </span>
        ) : null,
      )}
      {!any && <span className="muted">tanpa audio</span>}
      {source !== "off" && any && !items.some(([kind, , has]) => has && kind === source) && <span className="warn-text">tidak bersuara di situs</span>}
    </span>
  );
}

export function RecitationGroups({ phases, initial, isAdmin }: { phases: PhaseInfo[]; initial: RecitationRow[]; isAdmin: boolean }) {
  const api = useRows(initial, "recitation");

  // same numbering as the public page: only published, active cards in a published, active phase take a number
  const numbers = useMemo(() => {
    const live = new Set(phases.filter((p) => p.status === "published" && p.active).map((p) => p.id));
    const grouped = phases.map((p) => ({ continue_numbering: p.continue_numbering, id: p.id, recitations: api.rows.filter((r) => r.group === p.id) }));
    return assignNumbers<RecitationRow, (typeof grouped)[number]>(grouped, (r, p) => live.has(p.id) && r.status === "published" && r.active);
  }, [phases, api.rows]);

  return (
    <>
      <Toast toast={api.toast} pending={api.pending} />
      {phases.map((p, pi) => {
        const rows = api.rows.filter((r) => r.group === p.id);
        return (
          <section key={p.id} className="group">
            <h2>
              Fase {pi + 1}: {p.title} {p.status !== "published" && <StatusBadge status={p.status} />}
            </h2>
            {p.status !== "published" && <p className="muted">Fase ini belum terbit, jadi bacaan di dalamnya belum tampil di publik.</p>}
            <DataTable
              colSpan={6}
              empty="Belum ada bacaan."
              head={
                <tr>
                  <th>No</th>
                  <th>Judul</th>
                  <th>Status</th>
                  <th>Aktif</th>
                  <th>Audio</th>
                  <th>Aksi</th>
                </tr>
              }
              rows={rows.map((r) => {
                const n = numbers.get(r);
                return (
                  <tr key={r.id}>
                    <td data-label="No">{n ?? "—"}</td>
                    <td className="wide">
                      <strong>{r.title}</strong> {r.kind === "tasbih" && <span className="badge">Tasbih</span>}
                      <br />
                      <code>{r.slug}</code>
                      {r.kind === "standard" && r.arabic_empty && <span className="warn-text"> · teks Arab kosong</span>}
                    </td>
                    <td data-label="Status">
                      <StatusBadge status={r.status} />
                    </td>
                    <td data-label="Aktif">{r.active ? "Ya" : "Tidak"}</td>
                    <td data-label="Audio">
                      <SourceBadges audio={r.audio} source={r.source} />
                    </td>
                    <td className="wide">
                      <Actions r={r} api={api} isAdmin={isAdmin} editHref={`/putrazea/recitations/${r.id}`} confirmRemove="Hapus bacaan ini permanen? Audionya ikut terhapus dari database." />
                    </td>
                  </tr>
                );
              })}
            />
          </section>
        );
      })}
    </>
  );
}
