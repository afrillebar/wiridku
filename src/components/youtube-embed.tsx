"use client";

import { useState } from "react";
import { youtubeEmbedUrl } from "@/lib/youtube";
import { usePlayer } from "./audio";

// ponytail: YouTube's rules require the official player to stay visible (min 200x200) and forbid playing only its audio, so the video is shown, never hidden
export function YoutubeEmbed({ id, start, end, title }: { id: string; start: number | null; end: number | null; title: string }) {
  const [open, setOpen] = useState(false);
  const { stop } = usePlayer();

  if (!open)
    return (
      <div className="yt-row">
        <button
          type="button"
          className="offline-btn"
          onClick={() => {
            stop();
            setOpen(true);
          }}
        >
          Dengarkan dari YouTube
        </button>
      </div>
    );

  return (
    <div className="yt-box">
      <iframe
        className="yt-frame"
        src={youtubeEmbedUrl(id, start, end)}
        title={`Pemutar YouTube: ${title}`}
        allow="encrypted-media; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
      <div className="yt-foot">
        <span className="offline-status">Pemutar resmi YouTube, butuh internet.</span>
        <button type="button" className="offline-btn subtle" onClick={() => setOpen(false)}>
          Tutup
        </button>
      </div>
    </div>
  );
}
