"use client";

import { cloneElement, useState, type ReactElement, type ReactNode } from "react";

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

function Frame({ head, colSpan, empty, state, body }: { head: ReactNode; colSpan: number; empty: string; state: PagerState; body: ReactNode }) {
  return (
    <div className="datatable">
      <div className="table-wrap">
        <table>
          <thead>{head}</thead>
          <tbody>
            {state.total === 0 ? (
              <tr>
                <td colSpan={colSpan} className="muted">
                  {empty}
                </td>
              </tr>
            ) : (
              body
            )}
          </tbody>
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
  rows: ReactElement<{ hidden?: boolean }>[];
  empty?: string;
  colSpan: number;
  pageSize?: number;
  keepMounted?: boolean;
}) {
  const state = usePager(rows.length, pageSize);
  const body = keepMounted
    ? rows.map((row, i) => cloneElement(row, { hidden: i < state.from || i >= state.to }))
    : rows.slice(state.from, state.to);
  return <Frame head={head} colSpan={colSpan} empty={empty} state={state} body={body} />;
}

export type AccessLogRow = { id: string; time: string; who: string; place: string; device: string; event: string };

export function AccessLogTable({ rows }: { rows: AccessLogRow[] }) {
  const state = usePager(rows.length, 10);
  const slice = rows.slice(state.from, state.to);
  return (
    <Frame
      colSpan={5}
      empty="Belum ada kunjungan di rentang ini."
      state={state}
      head={
        <tr>
          <th>Waktu (WIB)</th>
          <th>Siapa</th>
          <th>Lokasi</th>
          <th>Perangkat</th>
          <th>Kejadian</th>
        </tr>
      }
      body={slice.map((r) => (
        <tr key={r.id}>
          <td data-label="Waktu">{r.time}</td>
          <td data-label="Siapa">{r.who}</td>
          <td data-label="Lokasi">{r.place}</td>
          <td data-label="Perangkat">{r.device}</td>
          <td className="wide">{r.event}</td>
        </tr>
      ))}
    />
  );
}
