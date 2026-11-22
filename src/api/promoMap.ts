import { fromKobo } from "./money";
import type { Channel, Promotion } from "../data/types";

export type ApiPromo = {
  id: string;
  name: string;
  label: string;
  kind: Promotion["kind"];
  buy: number | null;
  get: number | null;
  value: number;
  minSpend: number | null;
  scope: Promotion["scope"];
  channels: string[];
  stores: string[];
  startsAt: string;
  endsAt: string;
  active: boolean;
};

export function mapPromo(p: ApiPromo): Promotion {
  return {
    id: p.id,
    name: p.name,
    label: p.label,
    kind: p.kind,
    buy: p.buy ?? undefined,
    get: p.get ?? undefined,
    value: p.kind === "spend" ? fromKobo(p.value) : p.value,
    minSpend: p.minSpend != null ? fromKobo(p.minSpend) : undefined,
    scope: p.scope,
    channels: p.channels.map((c) => (c === "store" || c === "pos" ? "pos" : c === "web" || c === "app" ? c : "web")) as Channel[],
    stores: p.stores ?? [],
    starts: typeof p.startsAt === "string" ? p.startsAt : new Date(p.startsAt).toISOString(),
    ends: typeof p.endsAt === "string" ? p.endsAt : new Date(p.endsAt).toISOString(),
    active: p.active,
  };
}
