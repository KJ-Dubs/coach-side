/**
 * Minimal in-memory stand-in for the token-scoped database client used by
 * connector actions. Supports only the query shapes the service uses.
 */
import type { Db } from "./service";

type Row = Record<string, unknown>;
type Filter = (r: Row) => boolean;

export type FakeState = {
  tables: Record<string, Row[]>;
  access: Record<string, unknown>;
  connection: { permissions: string[]; revoked: boolean; calls: number; limit: number } | null;
  audit: Row[];
  rpcCalls: string[];
};

let idn = 0;
export const uid = () => {
  idn += 1;
  return `00000000-0000-4000-8000-${String(idn).padStart(12, "0")}`;
};

class Query implements PromiseLike<{ data: unknown; error: unknown }> {
  private filters: Filter[] = [];
  private mode: "select" | "insert" | "update" = "select";
  private payload: Row[] | Row | null = null;
  private single: "one" | "maybe" | null = null;
  private orderKey: string | null = null;
  private max: number | null = null;
  constructor(
    private state: FakeState,
    private table: string,
  ) {}
  select() {
    return this;
  }
  insert(rows: Row[] | Row) {
    this.mode = "insert";
    this.payload = rows;
    return this;
  }
  update(patch: Row) {
    this.mode = "update";
    this.payload = patch;
    return this;
  }
  eq(k: string, v: unknown) {
    this.filters.push((r) => r[k] === v);
    return this;
  }
  in(k: string, vs: unknown[]) {
    this.filters.push((r) => vs.includes(r[k]));
    return this;
  }
  gte(k: string, v: string) {
    this.filters.push((r) => Date.parse(String(r[k])) >= Date.parse(v));
    return this;
  }
  lt(k: string, v: string) {
    this.filters.push((r) => Date.parse(String(r[k])) < Date.parse(v));
    return this;
  }
  order(k: string) {
    this.orderKey = k;
    return this;
  }
  limit(n: number) {
    this.max = n;
    return this;
  }
  maybeSingle() {
    this.single = "maybe";
    return this;
  }
  // `single` collides with the field name; expose via defineProperty below.
  run(): { data: unknown; error: unknown } {
    const rows = (this.state.tables[this.table] ??= []);
    let out: Row[];
    if (this.mode === "insert") {
      const list = Array.isArray(this.payload) ? this.payload : [this.payload as Row];
      out = list.map((r) => ({ id: uid(), active: true, source: "coachside", status: "scheduled", ...r }));
      rows.push(...out);
    } else if (this.mode === "update") {
      out = rows.filter((r) => this.filters.every((f) => f(r)));
      out.forEach((r) => Object.assign(r, this.payload));
    } else {
      out = rows.filter((r) => this.filters.every((f) => f(r)));
    }
    if (this.orderKey) {
      const k = this.orderKey;
      out = [...out].sort((a, b) => String(a[k]).localeCompare(String(b[k])));
    }
    if (this.max != null) out = out.slice(0, this.max);
    const copy = out.map((r) => ({ ...r }));
    if (this.single === "maybe") return { data: copy[0] ?? null, error: null };
    if (this.single === "one") return copy[0] ? { data: copy[0], error: null } : { data: null, error: { message: "no rows" } };
    return { data: copy, error: null };
  }
  then<A, B>(ok?: ((v: { data: unknown; error: unknown }) => A | PromiseLike<A>) | null, bad?: ((e: unknown) => B | PromiseLike<B>) | null) {
    return Promise.resolve(this.run()).then(ok, bad);
  }
}
Object.defineProperty(Query.prototype, "single", {
  value(this: Query & { single: unknown }) {
    (this as unknown as { single: string }).single = "one";
    return this;
  },
  writable: true,
});

export function fakeDb(state: FakeState): Db {
  return {
    from: (table: string) => new Query(state, table),
    rpc: async (name: string, args: Record<string, unknown>) => {
      state.rpcCalls.push(name);
      if (name === "my_access") return { data: state.access, error: null };
      if (name === "mcp_log_action") {
        state.audit.push(args);
        return { data: null, error: null };
      }
      if (name === "mcp_begin_call") {
        const c = state.connection;
        if (!c) return { data: { ok: false, code: "NOT_CONNECTED" }, error: null };
        if (c.revoked) return { data: { ok: false, code: "CONNECTION_REVOKED" }, error: null };
        if (!c.permissions.includes(String(args["p_permission"]))) {
          return { data: { ok: false, code: "PERMISSION_NOT_GRANTED" }, error: null };
        }
        if (c.calls >= c.limit) return { data: { ok: false, code: "RATE_LIMITED" }, error: null };
        c.calls += 1;
        return { data: { ok: true }, error: null };
      }
      return { data: null, error: { message: `unknown rpc ${name}` } };
    },
  } as unknown as Db;
}
