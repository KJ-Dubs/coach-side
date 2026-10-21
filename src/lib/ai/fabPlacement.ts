export type FabMode = "normal" | "edge" | "hidden";

/**
 * Where the floating CoachSide AI button may sit. Live tracking and the
 * whiteboard keep every pixel for the court; court-first editors get a slim
 * edge tab so the controls under the court stay clear.
 */
export function fabModeFor(pathname: string): FabMode {
  if (pathname.startsWith("/game/") || pathname.startsWith("/board")) return "hidden";
  if (
    pathname.startsWith("/plays/new") ||
    /^\/plays\/[^/]+\/?$/.test(pathname) ||
    pathname.startsWith("/drills/new") ||
    pathname.startsWith("/film/")
  )
    return "edge";
  return "normal";
}
