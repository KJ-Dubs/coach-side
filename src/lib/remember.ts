const KEY = "coachside.remember-device";

/** Devices are remembered by default: the session persists and the coach is
 *  signed straight back in next visit. Turning it off signs out on close. */
export function rememberDevice() {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(KEY) !== "0";
}

export function setRememberDevice(on: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, on ? "1" : "0");
}
