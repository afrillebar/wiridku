export type AudioSource = "mp3" | "tts" | "youtube" | "off";

export const AUDIO_SOURCE_LABEL: Record<AudioSource, string> = {
  mp3: "MP3 rekaman asli",
  tts: "MP3 suara sintetis (TTS)",
  youtube: "Pemutar YouTube",
  off: "Nonaktif (tanpa audio)",
};

export const DEFAULT_AUDIO_SOURCE: AudioSource = "mp3";

export function parseAudioSource(value: unknown): AudioSource {
  const mode = (value as { mode?: string } | null)?.mode;
  return isAudioSource(mode) ? mode : DEFAULT_AUDIO_SOURCE;
}

export function isAudioSource(value: unknown): value is AudioSource {
  return value === "mp3" || value === "tts" || value === "youtube" || value === "off";
}

// null means the card follows the site-wide choice
export function resolveAudioSource(card: unknown, site: AudioSource): AudioSource {
  return isAudioSource(card) ? card : site;
}
