import type { Metadata } from "next";
import { SubPage } from "@/components/settings";
import pkg from "../../../../../package.json";

export const metadata: Metadata = { title: "Tentang Wiridku" };

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
        <p className="set-text">Panduan wirid dan doa setelah salat fardu, disusun berurutan, dengan sumber dalil di setiap bacaan. Disusun untuk penggunaan pribadi.</p>
      </section>

      <section className="set-card">
        <p className="set-label">Sumber data</p>
        <ul className="set-bullets">
          <li>Teks ayat dicocokkan dengan mushaf Tanzil (api.alquran.cloud). Teks hadis dicocokkan dengan kitab hadis yang dirujuk di tiap bacaan.</li>
          <li>Jadwal salat: Kementerian Agama RI (Bimas Islam), lewat api.myquran.com. Untuk lokasi GPS, waktu dihitung di perangkat dengan kriteria Kemenag. Nama daerah dari BigDataCloud dan OpenStreetMap.</li>
          <li>Audio: rekaman bacaan dari sumber terbuka. Bacaan yang memakai suara sintetis diberi tanda.</li>
        </ul>
      </section>

      <section className="set-card">
        <p className="set-label">Privasi</p>
        <ul className="set-bullets">
          <li>Progres, posisi bacaan, lokasi, dan pengaturan hanya disimpan di perangkat Anda. Tidak ada akun pengunjung.</li>
          <li>Posisi GPS hanya dibaca saat Anda menekan tombol GPS. Waktu salat dihitung di perangkat. Untuk mendapatkan nama daerah, koordinat (dibulatkan sekitar 100 m) dikirim sekali ke layanan BigDataCloud, dengan Nominatim OpenStreetMap sebagai cadangan; Wiridku tidak menyimpannya di server.</li>
          <li>Saat pertama kali membuka situs lewat https, browser meminta izin lokasi satu kali. Jika diizinkan, kartu jadwal langsung memakai daerah Anda, dan nama daerahnya (mis. Jakarta Pusat, tanpa koordinat) dicatat di statistik kunjungan admin. Jika ditolak, tidak ditanya lagi dan Anda bisa memilih kota sendiri.</li>
          <li>Untuk mengetahui pemakaian, situs mencatat kunjungan dan pemutaran audio dengan ID acak, tanpa alamat IP.</li>
        </ul>
      </section>
    </SubPage>
  );
}
