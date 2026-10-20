import type { Metadata } from "next";
import { AboutList, SubPage } from "@/components/settings";
import pkg from "../../../../../package.json";

export const metadata: Metadata = { title: "Tentang Wiridku" };

const FEATURES = [
  ["Wirid Salat", "Bacaan wirid dan doa setelah salat fardu, berurutan, lengkap dengan sumber dalil."],
  ["Jadwal Salat", "Waktu salat dan Imsak untuk kota pilihan atau lokasi GPS Anda."],
  ["Kalender", "Tanggal Masehi, Hijriah, dan pasaran Jawa, lengkap dengan hari besar Islam."],
  ["Tasbih", "Penghitung dzikir yang tersimpan di perangkat."],
  ["Arah Kiblat", "Arah Kiblat dari posisi Anda, dengan kompas di ponsel."],
] as const;

export default function AboutPage() {
  const build = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);
  return (
    <SubPage title="Tentang Wiridku">
      <section className="set-card about-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="" width={56} height={56} />
        <div>
          <p className="set-value">Wiridku</p>
          <p className="set-note">
            Versi {pkg.version}
            {build ? ` (${build})` : ""}
          </p>
        </div>
      </section>

      <section className="set-card">
        <p className="set-label">Tentang</p>
        <p className="set-text">Teman ibadah sehari-hari: wirid dan doa setelah salat fardu, jadwal salat, kalender, tasbih, dan arah Kiblat. Disusun untuk penggunaan pribadi.</p>
        <AboutList items={FEATURES} />
      </section>

      <p className="set-note about-foot">Sumber data dan kebijakan privasi ada di menu Pengaturan: Informasi Data dan Kebijakan Privasi.</p>
    </SubPage>
  );
}
