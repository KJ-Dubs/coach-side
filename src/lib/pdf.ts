import { jsPDF } from "jspdf";
import { statColor } from "./statColors";
import { ZONE_LABEL, type Zone } from "./court";
import type { GameEvent, Player } from "./types";

type BoxRow = {
  jersey: string;
  name: string;
  pts: number;
  fgm: number;
  fga: number;
  threes: number;
  ftm: number;
  fta: number;
  reb: number;
  ast: number;
  stl: number;
  to: number;
  blk: number;
  pf: number;
};

export function boxRow(p: Player, events: GameEvent[]): BoxRow {
  const own = events.filter((e) => e.player_id === p.id);
  return {
    jersey: p.jersey,
    name: p.name,
    pts: own.reduce((s, e) => s + (e.points || 0), 0),
    fgm: own.filter((e) => e.event_type === "MADE").length,
    fga: own.filter((e) => e.event_type === "MADE" || e.event_type === "MISS").length,
    threes: own.filter((e) => e.event_type === "MADE" && e.points === 3).length,
    ftm: own.filter((e) => e.event_type === "FT_MADE").length,
    fta: own.filter((e) => e.event_type === "FT_MADE" || e.event_type === "FT_MISS").length,
    reb: own.filter((e) => e.event_type === "REBOUND").length,
    ast: own.filter((e) => e.event_type === "ASSIST").length,
    stl: own.filter((e) => e.event_type === "STEAL").length,
    to: own.filter((e) => e.event_type === "TURNOVER").length,
    blk: own.filter((e) => e.event_type === "BLOCK").length,
    pf: own.filter((e) => e.event_type === "FOUL").length,
  };
}

/** Draws a half court (basket left) inside the given rect. */
function drawCourt(doc: jsPDF, x: number, y: number, w: number) {
  const h = (w * 500) / 470;
  const sx = w / 470;
  const sy = h / 500;
  const px = (v: number) => x + v * sx;
  const py = (v: number) => y + v * sy;

  doc.setFillColor(245, 241, 234);
  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.6);
  doc.rect(x, y, w, h, "FD");

  // paint
  doc.rect(px(0), py(190), 190 * sx, 120 * sy);
  // free throw circle
  doc.circle(px(190), py(250), 60 * sx);
  // rim + backboard
  doc.setDrawColor(200, 90, 30);
  doc.line(px(40), py(220), px(40), py(280));
  doc.circle(px(52.5), py(250), 9 * sx);
  doc.setDrawColor(120, 120, 120);

  // three point line: straight corners + arc
  doc.line(px(0), py(52.5), px(52.5), py(52.5));
  doc.line(px(0), py(447.5), px(52.5), py(447.5));
  const r = 197.5;
  const cx = 52.5;
  const cy = 250;
  let prev: [number, number] | null = null;
  for (let a = -90; a <= 90; a += 3) {
    const rad = (a * Math.PI) / 180;
    const p: [number, number] = [px(cx + r * Math.cos(rad)), py(cy + r * Math.sin(rad))];
    if (prev) doc.line(prev[0], prev[1], p[0], p[1]);
    prev = p;
  }
  // half court line
  doc.line(px(468), py(0), px(468), py(500));
  return h;
}

function hexToRgb(hex: string): [number, number, number] {
  const v = hex.replace("#", "");
  return [
    parseInt(v.slice(0, 2), 16),
    parseInt(v.slice(2, 4), 16),
    parseInt(v.slice(4, 6), 16),
  ];
}

function plot(doc: jsPDF, x: number, y: number, w: number, h: number, events: GameEvent[]) {
  for (const e of events) {
    if (e.x == null || e.y == null) continue;
    const [r, g, b] = hexToRgb(statColor(String(e.event_type)));
    doc.setFillColor(r, g, b);
    doc.setDrawColor(r, g, b);
    const cx = x + e.x * w;
    const cy = y + e.y * h;
    if (e.event_type === "MISS" || e.event_type === "FT_MISS") {
      doc.setLineWidth(0.8);
      doc.circle(cx, cy, 2.2, "S");
    } else {
      doc.circle(cx, cy, 2.2, "F");
    }
  }
}

function legend(doc: jsPDF, x: number, y: number, types: string[]) {
  let cx = x;
  doc.setFontSize(8);
  for (const t of types) {
    const [r, g, b] = hexToRgb(statColor(t));
    doc.setFillColor(r, g, b);
    doc.circle(cx, y - 1, 2, "F");
    doc.setTextColor(40, 40, 40);
    doc.text(t.replace("_", " "), cx + 3.5, y);
    cx += 12 + doc.getTextWidth(t.replace("_", " "));
  }
}

function table(doc: jsPDF, x: number, y: number, headers: string[], rows: string[][], widths: number[]) {
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  headers.forEach((h, i) => doc.text(h, x + widths.slice(0, i).reduce((a, b) => a + b, 0), y));
  let cy = y + 4;
  doc.setTextColor(20, 20, 20);
  for (const row of rows) {
    row.forEach((c, i) =>
      doc.text(c, x + widths.slice(0, i).reduce((a, b) => a + b, 0), cy),
    );
    cy += 5;
  }
  return cy;
}

export function buildGamePdf(opts: {
  title: string;
  subtitle: string;
  players: Player[];
  events: GameEvent[];
  teamScore: number;
  oppScore: number;
  zones: Zone[];
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const M = 14;
  const courtW = 120;

  const header = (line1: string, line2: string) => {
    doc.setFillColor(24, 22, 30);
    doc.rect(0, 0, 210, 22, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15);
    doc.text(line1, M, 11);
    doc.setFontSize(9);
    doc.setTextColor(210, 200, 230);
    doc.text(line2, M, 17);
    doc.setTextColor(20, 20, 20);
  };

  /* ---- team page ---- */
  header(opts.title, opts.subtitle);
  doc.setFontSize(11);
  doc.text(`Team ${opts.teamScore} — Opponent ${opts.oppScore}`, M, 32);

  const ch = drawCourt(doc, M, 36, courtW);
  plot(doc, M, 36, courtW, ch, opts.events);
  legend(doc, M, 36 + ch + 6, ["MADE", "MISS", "REBOUND", "ASSIST", "STEAL", "TURNOVER", "BLOCK", "FOUL"]);

  // zone splits beside the court
  const zx = M + courtW + 8;
  doc.setFontSize(9);
  doc.text("Shooting by zone", zx, 40);
  let zy = 46;
  for (const z of opts.zones) {
    const shots = opts.events.filter(
      (e) => e.zone === z && (e.event_type === "MADE" || e.event_type === "MISS"),
    );
    const made = shots.filter((e) => e.event_type === "MADE").length;
    doc.setFontSize(8);
    doc.text(
      `${ZONE_LABEL[z]}: ${made}/${shots.length}${shots.length ? ` (${Math.round((made / shots.length) * 100)}%)` : ""}`,
      zx,
      zy,
    );
    zy += 5;
  }

  const rows = opts.players
    .map((p) => boxRow(p, opts.events))
    .map((r) => [
      `#${r.jersey}`,
      r.name.slice(0, 16),
      String(r.pts),
      `${r.fgm}/${r.fga}`,
      String(r.threes),
      `${r.ftm}/${r.fta}`,
      String(r.reb),
      String(r.ast),
      String(r.stl),
      String(r.to),
      String(r.blk),
      String(r.pf),
    ]);
  doc.setFontSize(10);
  doc.text("Box score", M, 36 + ch + 18);
  table(
    doc,
    M,
    36 + ch + 24,
    ["#", "NAME", "PTS", "FG", "3P", "FT", "REB", "AST", "STL", "TO", "BLK", "PF"],
    rows,
    [10, 34, 12, 16, 10, 16, 12, 12, 12, 12, 12, 12],
  );

  /* ---- one page per player ---- */
  for (const p of opts.players) {
    const own = opts.events.filter((e) => e.player_id === p.id);
    if (!own.length) continue;
    doc.addPage();
    header(`#${p.jersey} ${p.name}`, `${opts.title} · ${opts.subtitle}`);
    const r = boxRow(p, opts.events);
    doc.setFontSize(10);
    doc.text(
      `PTS ${r.pts}   FG ${r.fgm}/${r.fga}   3P ${r.threes}   FT ${r.ftm}/${r.fta}   REB ${r.reb}   AST ${r.ast}   STL ${r.stl}   TO ${r.to}   BLK ${r.blk}   PF ${r.pf}`,
      M,
      32,
    );
    const h2 = drawCourt(doc, M, 36, courtW);
    plot(doc, M, 36, courtW, h2, own);
    legend(doc, M, 36 + h2 + 6, ["MADE", "MISS", "REBOUND", "STEAL", "TURNOVER", "FOUL"]);
  }

  return doc;
}
