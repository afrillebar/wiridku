import { getReadingRows } from "@/lib/content";
import { textReading, type Reading } from "@/lib/reading";

// The shalawat of the Shalawat menu: written in the admin (table readings)
export async function getShalawat(): Promise<Reading[]> {
  return (await getReadingRows("shalawat")).map(textReading);
}
