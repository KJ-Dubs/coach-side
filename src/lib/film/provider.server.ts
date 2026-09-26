/**
 * Film processor interface. The real computer-vision worker is a separate
 * service; CoachSide only knows this contract. Until FILM_WORKER_URL and
 * FILM_WORKER_SECRET are configured, the NoneProcessor is active and jobs
 * honestly report that automatic analysis is not connected.
 */
import { createHmac } from "crypto";

export type FilmJobPayload = {
  jobId: string;
  teamId: string;
  gameId: string | null;
  videoUrl: string | null;
  sourceUrl: string | null;
  config: {
    ourColor: string | null;
    oppColor: string | null;
    attackBasketFirstHalf: string;
    periods: number;
    roster: { jersey: string; player_id: string; name?: string }[];
  };
  callbackBase: string;
};

export interface FilmProcessor {
  readonly kind: "none" | "http";
  /** Submit a queued job to the worker. Returns a provider job id or null. */
  submit(job: FilmJobPayload): Promise<{ providerJobId: string | null; detail: string }>;
  cancel(providerJobId: string): Promise<void>;
}

class NoneProcessor implements FilmProcessor {
  readonly kind = "none" as const;
  async submit() {
    return {
      providerJobId: null,
      detail:
        "Automatic film analysis is not connected yet. You can still tag this film manually in the review workspace.",
    };
  }
  async cancel() {}
}

class HttpWorkerProcessor implements FilmProcessor {
  readonly kind = "http" as const;
  constructor(
    private url: string,
    private secret: string,
  ) {}
  private sign(body: string) {
    return createHmac("sha256", this.secret).update(body).digest("hex");
  }
  async submit(job: FilmJobPayload) {
    const body = JSON.stringify({ type: "submit", job });
    const res = await fetch(`${this.url.replace(/\/$/, "")}/jobs`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-film-signature": this.sign(body) },
      body,
    });
    if (!res.ok) throw new Error(`Film worker rejected job (${res.status})`);
    const data = (await res.json().catch(() => ({}))) as { provider_job_id?: string };
    return { providerJobId: data.provider_job_id ?? null, detail: "Submitted to analysis worker." };
  }
  async cancel(providerJobId: string) {
    const body = JSON.stringify({ type: "cancel", provider_job_id: providerJobId });
    await fetch(`${this.url.replace(/\/$/, "")}/jobs/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-film-signature": this.sign(body) },
      body,
    }).catch(() => {});
  }
}

export function filmWorkerConfigured() {
  return Boolean(process.env["FILM_WORKER_URL"] && process.env["FILM_WORKER_SECRET"]);
}

export function getFilmProcessor(): FilmProcessor {
  const url = process.env["FILM_WORKER_URL"];
  const secret = process.env["FILM_WORKER_SECRET"];
  if (url && secret) return new HttpWorkerProcessor(url, secret);
  return new NoneProcessor();
}

/** Verify an inbound worker callback. Throws when the worker is not configured. */
export function verifyWorkerRequest(rawBody: string, signature: string | null) {
  const secret = process.env["FILM_WORKER_SECRET"];
  if (!secret) {
    const err = new Error("Film worker is not configured");
    (err as { status?: number }).status = 503;
    throw err;
  }
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signature ?? "");
  const b = Buffer.from(expected);
  if (a.length !== b.length || !a.equals(b)) {
    const err = new Error("Invalid signature");
    (err as { status?: number }).status = 401;
    throw err;
  }
}
