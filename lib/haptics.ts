// Light haptic tick for the double-tap like gesture. Guarded behind a
// feature check since navigator.vibrate only exists on some mobile browsers.
export function vibrateLight() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(12);
  }
}
