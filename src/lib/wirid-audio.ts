import type { DoaClip } from "./doa";
import data from "./wirid-audio.json";

// Where a card of Wirid Salat is heard from: streamed from online sources (scripts/build-wirid-audio.mjs); lines when the card is read one sentence at a time
export type WiridAudio = { clips: DoaClip[]; lines?: { ar: string; la: string; ti: string }[] };
export const wiridAudio = data as Record<string, WiridAudio>;
