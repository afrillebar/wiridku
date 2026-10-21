"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { buzz } from "@/lib/haptic";
import { angleDiff, compass8, distanceToKaabaKm, qiblaBearing } from "@/lib/qibla";
import { placeName, useCity } from "./prayer-card";

type Place = { lat: number; lon: number; label: string };
type Sensor = "off" | "asking" | "on" | "none" | "denied";
type OrientationLike = Event & { alpha?: number | null; beta?: number | null; gamma?: number | null; absolute?: boolean; webkitCompassHeading?: number };

const ALIGNED = 3; // degrees either side of the Qibla that count as facing it
const TICKS = Array.from({ length: 72 }, (_, i) => i * 5);

function Icon({ children, size = 20 }: { children: ReactNode; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export function ArahKiblat() {
  const { city } = useCity();
  const [found, setFound] = useState<Place | null>(null);
  const [geo, setGeo] = useState<"idle" | "busy" | "error">("idle");
  const [geoMsg, setGeoMsg] = useState("");
  const [heading, setHeading] = useState<number | null>(null);
  const [tilt, setTilt] = useState(false);
  const [sensor, setSensor] = useState<Sensor>("off");
  const smooth = useRef<number | null>(null);
  const got = useRef(false);
  const listener = useRef<((e: Event) => void) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const saved: Place | null = city?.gps ? { lat: city.gps.lat, lon: city.gps.lon, label: placeName(city) } : null;
  const place = found ?? saved;
  const bearing = place ? qiblaBearing(place.lat, place.lon) : null;
  const km = place ? distanceToKaabaKm(place.lat, place.lon) : null;
  const off = bearing !== null && heading !== null ? angleDiff(bearing, heading) : null;
  const aligned = off !== null && Math.abs(off) <= ALIGNED;

  // a short buzz the moment the phone points at the Qibla
  useEffect(() => {
    if (aligned) buzz(40);
  }, [aligned]);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      if (listener.current) {
        window.removeEventListener("deviceorientationabsolute", listener.current, true);
        window.removeEventListener("deviceorientation", listener.current, true);
      }
    },
    [],
  );

  const locate = () => {
    if (!("geolocation" in navigator)) {
      setGeo("error");
      return setGeoMsg("Perangkat ini tidak mendukung GPS. Masukkan koordinat secara manual di bawah.");
    }
    if (!window.isSecureContext) {
      setGeo("error");
      return setGeoMsg("GPS hanya bisa dipakai di halaman https. Masukkan koordinat secara manual di bawah.");
    }
    setGeo("busy");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setFound({ lat: coords.latitude, lon: coords.longitude, label: "Lokasi Anda (GPS)" });
        setGeo("idle");
      },
      (err) => {
        setGeo("error");
        setGeoMsg(err.code === 1 ? "Izin lokasi ditolak. Izinkan lokasi di pengaturan browser, atau masukkan koordinat secara manual." : "Lokasi belum bisa ditentukan. Coba lagi di tempat terbuka, atau masukkan koordinat secara manual.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  };

  const manual = (form: FormData) => {
    const lat = Number(String(form.get("lat")).replace(",", "."));
    const lon = Number(String(form.get("lon")).replace(",", "."));
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || String(form.get("lat")).trim() === "" || String(form.get("lon")).trim() === "") {
      setGeo("error");
      return setGeoMsg("Koordinat tidak valid. Lintang antara -90 dan 90, bujur antara -180 dan 180 (contoh Jakarta: -6.2088 dan 106.8456).");
    }
    setFound({ lat, lon, label: "Koordinat yang Anda masukkan" });
    setGeo("idle");
  };

  const startCompass = async () => {
    // iPhone asks for permission and must be asked from a tap
    const ask = (window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> } | undefined)?.requestPermission;
    setSensor("asking");
    if (typeof ask === "function") {
      try {
        if ((await ask.call(window.DeviceOrientationEvent)) !== "granted") return setSensor("denied");
      } catch {
        return setSensor("denied");
      }
    }
    const onOrient = (e: Event) => {
      const o = e as OrientationLike;
      // iPhone gives the compass heading directly; Android gives an absolute alpha, the top edge of a flat phone points at 360 - alpha
      let raw: number | null = null;
      if (typeof o.webkitCompassHeading === "number" && !Number.isNaN(o.webkitCompassHeading)) raw = o.webkitCompassHeading;
      else if ((o.absolute || e.type === "deviceorientationabsolute") && typeof o.alpha === "number") raw = (360 - o.alpha) % 360;
      if (raw === null) return;
      got.current = true;
      clearTimeout(timer.current);
      setSensor("on");
      setTilt(Math.abs(o.beta ?? 0) > 55 || Math.abs(o.gamma ?? 0) > 55);
      const prev = smooth.current;
      const next = prev === null ? raw : (prev + angleDiff(raw, prev) * 0.3 + 360) % 360;
      smooth.current = next;
      setHeading(Math.round(next * 10) / 10);
    };
    listener.current = onOrient;
    window.addEventListener("deviceorientationabsolute", onOrient, true);
    window.addEventListener("deviceorientation", onOrient, true);
    got.current = false;
    // no event soon after: this device has no usable compass (a computer, for instance)
    timer.current = setTimeout(() => !got.current && setSensor("none"), 2500);
  };

  return (
    <div className="qbl">
      <header className="cal-head">
        <Link href="/" className="cal-back" aria-label="Kembali ke Beranda" data-tip="Kembali ke Beranda" data-tip-align="start">
          <Icon>
            <path d="M15 5l-7 7 7 7" />
          </Icon>
        </Link>
        <div>
          <h1>Arah Kiblat</h1>
          <p>
            <span>Dihitung dari posisi Anda ke Ka&apos;bah</span>
          </p>
        </div>
      </header>

      {place && bearing !== null && km !== null ? (
        <>
          <section className="qbl-result" aria-live="polite">
            <p className="qbl-deg">{Math.round(bearing)}°</p>
            <p className="qbl-dir">
              {compass8(bearing)} · dari Utara searah jarum jam · {Math.round(km).toLocaleString("id-ID")} km ke Ka&apos;bah
            </p>
            <p className="qbl-place">
              {place.label}
              {found ? (
                <button type="button" className="qbl-link" onClick={() => setFound(null)}>
                  Ganti
                </button>
              ) : (
                <Link href="/pengaturan/lokasi" className="qbl-link">
                  Ganti
                </Link>
              )}
            </p>
          </section>

          <div className={`qbl-wrap${aligned ? " aligned" : ""}`}>
            <span className="qbl-pointer" aria-hidden="true" />
            <div className="qbl-plate" style={{ transform: `rotate(${heading === null ? 0 : -heading}deg)` }} data-heading={heading ?? ""}>
              <svg viewBox="0 0 200 200" aria-hidden="true">
                <circle className="qbl-ring" cx="100" cy="100" r="92" />
                {TICKS.map((t) => (
                  <line key={t} className={t % 90 === 0 ? "major" : undefined} x1="100" y1={t % 90 === 0 ? 12 : 14} x2="100" y2={t % 45 === 0 ? 24 : 20} transform={`rotate(${t} 100 100)`} />
                ))}
                {[
                  ["U", 0],
                  ["T", 90],
                  ["S", 180],
                  ["B", 270],
                ].map(([l, a]) => (
                  <text key={l} className={l === "U" ? "north" : undefined} x="100" y="46" transform={`rotate(${a} 100 100)`} textAnchor="middle">
                    {l}
                  </text>
                ))}
                <g className="qbl-kaaba" transform={`rotate(${bearing} 100 100)`}>
                  <line x1="100" y1="100" x2="100" y2="36" />
                  <rect x="90" y="6" width="20" height="20" rx="3" />
                  <path d="M90 13h20" />
                </g>
              </svg>
            </div>
          </div>

          <p className="qbl-status" role="status">
            {sensor === "on" && heading !== null && off !== null
              ? aligned
                ? "Anda menghadap Kiblat"
                : `Putar ${Math.abs(Math.round(off))}° ke ${off > 0 ? "kanan" : "kiri"}`
              : sensor === "denied"
                ? "Izin sensor kompas ditolak. Izinkan lewat pengaturan browser, atau pakai angka derajat di atas."
                : sensor === "none"
                  ? "Perangkat ini tidak punya sensor kompas yang bisa dibaca. Pakai angka derajat di atas dengan kompas lain."
                  : "Kompas belum aktif. Angka derajat di atas sudah bisa dipakai."}
          </p>
          {tilt && sensor === "on" && <p className="qbl-tilt">Letakkan HP mendatar supaya arahnya akurat.</p>}

          {(sensor === "off" || sensor === "none" || sensor === "denied") && (
            <button type="button" className="qbl-btn" onClick={startCompass}>
              Aktifkan kompas
            </button>
          )}
          {sensor === "asking" && <p className="qbl-tilt">Menunggu izin sensor…</p>}

          <ul className="qbl-tips">
            <li>Pegang HP mendatar, layar menghadap ke atas, dan jauhi logam, magnet, atau perangkat elektronik.</li>
            <li>Bila arahnya terasa meleset, kalibrasi dengan menggerakkan HP membentuk angka 8 beberapa kali.</li>
            <li>Kompas HP mengukur utara magnetik; selisihnya dengan utara sebenarnya di Indonesia kecil, hanya beberapa derajat.</li>
          </ul>
        </>
      ) : (
        <section className="qbl-ask">
          <p>Arah Kiblat dihitung dari posisi Anda. Posisi hanya dipakai di perangkat ini dan tidak dikirim ke mana pun.</p>
          <button type="button" className="qbl-btn" onClick={locate} disabled={geo === "busy"}>
            {geo === "busy" ? "Mencari lokasi…" : "Gunakan lokasi saya (GPS)"}
          </button>
          {geo === "error" && (
            <p className="qbl-err" role="alert">
              {geoMsg}
            </p>
          )}
          <details open={geo === "error"}>
            <summary>Masukkan koordinat sendiri</summary>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                manual(new FormData(e.currentTarget));
              }}
            >
              <label>
                Lintang
                <input name="lat" inputMode="decimal" placeholder="-6.2088" autoComplete="off" />
              </label>
              <label>
                Bujur
                <input name="lon" inputMode="decimal" placeholder="106.8456" autoComplete="off" />
              </label>
              <button type="submit" className="qbl-btn">
                Hitung
              </button>
            </form>
          </details>
        </section>
      )}
    </div>
  );
}
