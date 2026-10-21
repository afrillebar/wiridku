// A short vibration. Android and desktop Chrome have navigator.vibrate; Safari on iPhone does not, but since iOS 17.4 it gives a small tap
// whenever an <input type="checkbox" switch> is toggled from a tap, so a hidden one is toggled instead (older iPhones simply feel nothing).
let hidden: HTMLLabelElement | null = null;

function tick() {
  if (!hidden) {
    hidden = document.createElement("label");
    hidden.setAttribute("aria-hidden", "true");
    hidden.style.display = "none";
    const box = document.createElement("input");
    box.type = "checkbox";
    box.setAttribute("switch", "");
    hidden.append(box);
    document.head.append(hidden);
  }
  hidden.click();
}

// number = one buzz of that many ms; array = buzz, pause, buzz, ... like navigator.vibrate
export function buzz(pattern: number | number[]) {
  if (typeof navigator === "undefined") return;
  if (typeof navigator.vibrate === "function") {
    navigator.vibrate(pattern);
    return;
  }
  if (!Array.isArray(pattern)) return tick();
  let at = 0;
  pattern.forEach((ms, i) => {
    if (i % 2 === 0) setTimeout(tick, at);
    at += ms;
  });
}
