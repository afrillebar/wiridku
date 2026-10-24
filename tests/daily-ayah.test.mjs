import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { dailyAyahIndex, localDayKey, millisecondsUntilLocalMidnight } from "../src/lib/local-day.ts";

const ayahs = JSON.parse(readFileSync(new URL("../src/lib/daily-ayahs.json", import.meta.url), "utf8"));

function inTimezone(zone, fn) {
  const previous = process.env.TZ;
  process.env.TZ = zone;
  try { fn(); }
  finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
}

test("curation contains 30 unique complete entries with only the requested fields", () => {
  assert.equal(ayahs.length, 30);
  assert.equal(new Set(ayahs.map((a) => a.surah)).size, 30);
  for (const ayah of ayahs) {
    assert.deepEqual(Object.keys(ayah).sort(), ["surah", "text"]);
    assert.match(ayah.surah, /^QS\. .+: \d+$/);
    assert.ok(ayah.text.trim().split(/\s+/).length <= 35, ayah.surah);
    assert.ok(ayah.text.length > 0);
    assert.doesNotMatch(ayah.text, /<[^>]*>|\.\.\.|…/);
  }
});

test("selection uses the user's local calendar date, not the UTC date", () => {
  const instant = new Date("2026-10-23T17:01:00Z");
  inTimezone("Asia/Bangkok", () => assert.equal(localDayKey(instant), "2026-10-24"));
  inTimezone("America/Los_Angeles", () => assert.equal(localDayKey(instant), "2026-10-23"));
});

test("the verse is stable during the day and rotates through all 30 entries", () => {
  const indices = [];
  for (let day = 0; day < 30; day++) {
    const key = new Date(Date.UTC(2026, 9, 24 + day)).toISOString().slice(0, 10);
    indices.push(dailyAyahIndex(key, ayahs.length));
  }
  assert.equal(new Set(indices).size, 30);
  assert.equal(dailyAyahIndex("2026-10-24", 30), dailyAyahIndex("2026-11-23", 30));
  inTimezone("Asia/Bangkok", () => {
    const morning = localDayKey(new Date(2026, 9, 24, 0, 1));
    const evening = localDayKey(new Date(2026, 9, 24, 23, 59));
    assert.equal(dailyAyahIndex(morning, 30), dailyAyahIndex(evening, 30));
    assert.equal(millisecondsUntilLocalMidnight(new Date(2026, 9, 24, 23, 59, 59)), 1100);
  });
});

test("rotation continues across leap days and year boundaries", () => {
  for (const dates of [["2028-02-28", "2028-02-29", "2028-03-01"], ["2026-12-31", "2027-01-01", "2027-01-02"]]) {
    const indices = dates.map((day) => dailyAyahIndex(day, 30));
    assert.equal(indices[1], (indices[0] + 1) % 30);
    assert.equal(indices[2], (indices[1] + 1) % 30);
  }
});

test("the next local midnight accounts for 23-hour and 25-hour DST days", () => {
  inTimezone("America/New_York", () => {
    assert.equal(millisecondsUntilLocalMidnight(new Date(2026, 2, 8)), 23 * 3_600_000 + 100);
    assert.equal(millisecondsUntilLocalMidnight(new Date(2026, 10, 1)), 25 * 3_600_000 + 100);
  });
});
