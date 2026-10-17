"use client";

import { useState, type ReactElement, type ReactNode } from "react";
import { deleteVisitLog } from "@/actions/traffic";
import { ConfirmButton } from "@/components/admin/confirm-button";

const SIZES = [10, 25, 50];

type PagerState = {
  size: number;
  pages: number;
  current: number;
  from: number;
  to: number;
  total: number;
  setSize: (size: number) => void;
  setPage: (page: number) => void;
};

function usePager(total: number, pageSize: number): PagerState {
  const [size, setSize] = useState(pageSize);
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(total / size) || 1);
  const current = total === 0 ? 0 : Math.min(page, pages - 1);
  return {
    size,
    pages,
    current,
    from: current * size,
    to: Math.min(total, current * size + size),
    total,
    setSize: (next) => {
      setSize(next);
      setPage(0);
    },
    setPage,
  };
}

function Pager({ state }: { state: PagerState }) {
  const { total, from, to, current, pages, setPage, setSize, size } = state;
  const start = Math.max(0, Math.min(current - 2, pages - 5));
  const end = Math.min(pages, start + 5);
  return (
    <div className="pager">
      <label className="pager-size">
        Tampilkan
        <select aria-label="Jumlah baris per halaman" value={size} onChange={(e) => setSize(Number(e.target.value))}>
          {SIZES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <span className="pager-count">{total === 0 ? "0 dari 0" : `${from + 1}–${to} dari ${total}`}</span>
      <div className="pager-nav" role="navigation" aria-label="Halaman tabel">
        <button type="button" className="btn small" disabled={total === 0 || current === 0} onClick={() => setPage(current - 1)}>
          Sebelumnya
        </button>
        {total > 0 &&
          Array.from({ length: end - start }, (_, i) => start + i).map((n) => (
            <button key={n} type="button" className={`btn small${n === current ? " primary" : ""}`} aria-current={n === current ? "page" : undefined} onClick={() => setPage(n)}>
              {n + 1}
            </button>
          ))}
        <button type="button" className="btn small" disabled={total === 0 || current >= pages - 1} onClick={() => setPage(current + 1)}>
          Berikutnya
        </button>
      </div>
    </div>
  );
}

function Frame({ head, colSpan, empty, state, body, loose = false }: { head: ReactNode; colSpan: number; empty: string; state: PagerState; body: ReactNode; loose?: boolean }) {
  const rows =
    state.total === 0 ? (
      <tbody>
        <tr>
          <td colSpan={colSpan} className="muted">
            {empty}
          </td>
        </tr>
      </tbody>
    ) : loose ? (
      body
    ) : (
      <tbody>{body}</tbody>
    );
  return (
    <div className="datatable">
      <div className="table-wrap">
        <table>
          <thead>{head}</thead>
          {rows}
        </table>
      </div>
      <Pager state={state} />
    </div>
  );
}

// keepMounted leaves every row in the form, so a select on another page still submits.
export function DataTable({
  head,
  rows,
  empty = "Belum ada data.",
  colSpan,
  pageSize = 10,
  keepMounted = false,
}: {
  head: ReactNode;
  rows: ReactElement[];
  empty?: string;
  colSpan: number;
  pageSize?: number;
  keepMounted?: boolean;
}) {
  const state = usePager(rows.length, pageSize);
  // Rows from a Server Component arrive as lazy nodes, so cloneElement cannot set hidden on them.
  const body = keepMounted
    ? rows.map((row, i) => (
        <tbody key={i} hidden={i < state.from || i >= state.to}>
          {row}
        </tbody>
      ))
    : rows.slice(state.from, state.to);
  return <Frame head={head} colSpan={colSpan} empty={empty} state={state} body={body} loose={keepMounted} />;
}

export type AccessLogRow = {
  id: string;
  visitor: string;
  kind: "user" | "visitor";
  time: string;
  who: string;
  place: string;
  device: string;
  event: string;
};

type VisitGroup = { id: string; who: string; kind: "user" | "visitor"; latest: AccessLogRow; events: AccessLogRow[] };

// Rows arrive newest first, so the first sighting of a visitor is their latest visit.
function groupVisits(rows: AccessLogRow[]): VisitGroup[] {
  const order: string[] = [];
  const map = new Map<string, AccessLogRow[]>();
  for (const row of rows) {
    const list = map.get(row.visitor);
    if (list) list.push(row);
    else {
      map.set(row.visitor, [row]);
      order.push(row.visitor);
    }
  }
  return order.map((id) => {
    const events = map.get(id)!;
    return { id, who: events[0].who, kind: events[0].kind, latest: events[0], events };
  });
}

export function AccessLogTable({ rows, days }: { rows: AccessLogRow[]; days: number }) {
  const groups = groupVisits(rows);
  const state = usePager(groups.length, 10);
  const slice = groups.slice(state.from, state.to);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
      {rows.length > 0 && (
        <form action={deleteVisitLog} className="log-clear">
          <input type="hidden" name="scope" value="all" />
          <input type="hidden" name="hari" value={String(days)} />
          <ConfirmButton className="btn small danger" busyLabel="Menghapus…" message="Hapus seluruh log akses? Semua rentang waktu ikut terhapus dan tidak bisa dikembalikan.">
            Hapus semua
          </ConfirmButton>
        </form>
      )}
    <Frame
      colSpan={5}
      empty="Belum ada kunjungan di rentang ini."
      state={state}
      head={
        <tr>
          <th>Siapa</th>
          <th>Terakhir (WIB)</th>
          <th>Lokasi</th>
          <th>Perangkat</th>
          <th>Kejadian</th>
        </tr>
      }
      body={slice.flatMap((g) => {
        const shown = open.has(g.id);
        const summary = (
          <tr key={g.id}>
            <td className="wide" data-label="Siapa">
              <button type="button" className="btn small log-toggle" aria-expanded={shown} onClick={() => toggle(g.id)}>
                {shown ? "Tutup" : "Lihat"}
              </button>
              {g.who}
              <form action={deleteVisitLog} className="log-person">
                <input type="hidden" name="scope" value="visitor" />
                <input type="hidden" name="kind" value={g.kind} />
                <input type="hidden" name="id" value={g.id} />
                <input type="hidden" name="hari" value={String(days)} />
                <ConfirmButton className="btn small danger" busyLabel="Menghapus…" message={`Hapus semua log ${g.who}? Semua rentang waktu untuk pengguna ini ikut terhapus dan tidak bisa dikembalikan.`}>
                  Hapus log
                </ConfirmButton>
              </form>
            </td>
            <td data-label="Terakhir">{g.latest.time}</td>
            <td data-label="Lokasi">{g.latest.place}</td>
            <td data-label="Perangkat">{g.latest.device}</td>
            <td data-label="Kejadian">{g.events.length} kejadian</td>
          </tr>
        );
        if (!shown) return [summary];
        return [
          summary,
          <tr key={`${g.id}-detail`} className="log-detail">
            <td colSpan={5}>
              <ul className="log-events">
                {g.events.map((r) => (
                  <li key={r.id}>
                    <time>{r.time}</time>
                    <span>{r.event}</span>
                    <small>
                      {r.place} · {r.device}
                    </small>
                    <form action={deleteVisitLog}>
                      <input type="hidden" name="scope" value="one" />
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="hari" value={String(days)} />
                      <ConfirmButton className="btn small danger" busyLabel="Menghapus…" message="Hapus catatan ini?">
                        Hapus
                      </ConfirmButton>
                    </form>
                  </li>
                ))}
              </ul>
            </td>
          </tr>,
        ];
      })}
    />
    </>
  );
}
