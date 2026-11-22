import { useEffect, useState } from "react";
import { CheckCircle2, PackageCheck, PackageOpen, Phone } from "lucide-react";
import { ApiError, liveMode } from "../api/client";
import { posApi } from "../api/pos";
import { useDb, useTill } from "../data/store";
import { sameDay } from "../data/seed";
import type { Order } from "../data/types";
import { naira } from "../lib/pricing";
import { Avatar, Badge, Button, ChannelBadge, Dialog, Empty, Input, Segmented, timeAgo, toast } from "../ui/kit";
import { useRegister } from "./common";

type PickupRow = Order & { bookingId?: string };

function mapApiPickup(b: any): PickupRow {
  const status = b.status === "scheduled" ? "processing" : b.status === "ready" ? "ready" : b.status === "collected" ? "collected" : "processing";
  return {
    id: b.orderId,
    bookingId: b.id,
    number: b.orderNumber,
    channel: "web",
    storeId: b.locationId,
    customerName: b.customerName,
    lines: (b.items ?? []).map((i: any) => ({
      productId: "",
      variantId: "",
      name: i.name,
      brand: i.brand,
      image: i.imageUrl ?? "",
      variantLabel: [i.size, i.color].filter(Boolean).join(" / "),
      sku: i.sku ?? "",
      qty: i.qty,
      unitPrice: 0,
      lineDiscount: 0,
      net: 0,
      returnedQty: 0,
    })),
    subtotal: 0,
    discountTotal: 0,
    pointsRedeemed: 0,
    total: 0,
    vat: 0,
    payments: [],
    change: 0,
    status,
    fulfilment: "pickup",
    pickupStoreId: b.locationId,
    pickupCode: b.pickupCode ?? undefined,
    createdAt: typeof b.scheduledAt === "string" ? b.scheduledAt : new Date(b.scheduledAt).toISOString(),
    collectedAt: b.collectedAt ? (typeof b.collectedAt === "string" ? b.collectedAt : new Date(b.collectedAt).toISOString()) : undefined,
    returns: [],
    pointsEarned: 0,
    synced: true,
  };
}

export default function Pickups() {
  const orders = useDb((s) => s.orders);
  const { store } = useRegister();
  const [tab, setTab] = useState<"processing" | "ready" | "collected">("ready");
  const [liveRows, setLiveRows] = useState<PickupRow[] | null>(null);
  const [handover, setHandover] = useState<PickupRow | null>(null);

  const refresh = async () => {
    if (!liveMode()) return;
    try {
      const raw = await posApi.pickups({ status: undefined });
      const list = Array.isArray(raw) ? raw : [];
      // also fetch ready + scheduled separately if default filter is narrow
      const ready = await posApi.pickups({ status: "ready" });
      const scheduled = await posApi.pickups({ status: "scheduled" });
      const collected = await posApi.pickups({ status: "collected" });
      const merged = [...(Array.isArray(scheduled) ? scheduled : []), ...(Array.isArray(ready) ? ready : []), ...(Array.isArray(collected) ? collected : []), ...list];
      const byId = new Map<string, PickupRow>();
      for (const b of merged) byId.set(b.id, mapApiPickup(b));
      setLiveRows([...byId.values()]);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not load pickups");
    }
  };

  useEffect(() => {
    void refresh();
  }, [store.id]);

  const mine = (liveRows ?? orders.filter((o) => o.fulfilment === "pickup" && o.pickupStoreId === store.id)) as PickupRow[];
  const lists = {
    processing: mine.filter((o) => o.status === "processing"),
    ready: mine.filter((o) => o.status === "ready"),
    collected: mine.filter((o) => o.status === "collected" && sameDay(o.collectedAt ?? o.createdAt, new Date())),
  };

  return (
    <div className="thin-scroll h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Pickups</h1>
            <p className="mt-1 text-sm text-muted">Website and app orders that customers collect at {store.name}.</p>
          </div>
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: "processing", label: `To pack (${lists.processing.length})` },
              { value: "ready", label: `Ready (${lists.ready.length})` },
              { value: "collected", label: `Collected today (${lists.collected.length})` },
            ]}
          />
        </div>
        <div className="mt-6 grid gap-3 lg:grid-cols-2">
          {lists[tab].map((o) => (
            <div key={o.bookingId ?? o.id} className="rounded-xl border border-line bg-white p-5 shadow-card" data-testid="pickup-card">
              <div className="flex items-start gap-3">
                <Avatar name={o.customerName ?? "Guest"} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{o.customerName}</p>
                  <p className="text-[13px] text-muted">
                    {o.number} · ordered {timeAgo(o.createdAt)}
                  </p>
                </div>
                <ChannelBadge channel={o.channel} />
              </div>
              <div className="mt-4 flex gap-2">
                {o.lines.map((l, i) => (
                  <div key={i} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-canvas p-2">
                    {l.image ? <img src={l.image} alt="" className="h-12 w-12 rounded object-cover" /> : <div className="h-12 w-12 rounded bg-line" />}
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium">
                        {l.qty}× {l.name}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {l.variantLabel} · {l.sku}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="tnum text-sm">
                  {o.total > 0 && (
                    <>
                      <span className="font-semibold">{naira(o.total)}</span>{" "}
                    </>
                  )}
                  <Badge tone="good">Paid online</Badge>
                </span>
                {o.status === "processing" && (
                  <Button
                    variant="primary"
                    icon={<PackageOpen size={16} />}
                    onClick={async () => {
                      try {
                        if (liveMode() && o.bookingId) {
                          await posApi.pickupReady(o.bookingId);
                          await refresh();
                        } else {
                          useDb.getState().patchOrder(o.id, { status: "ready" });
                        }
                        useDb.getState().log(`${o.number} packed and ready at ${store.name}. Customer notified.`, "pickup");
                        toast(`${o.customerName?.split(" ")[0]} has been told ${o.number} is ready`);
                      } catch (e) {
                        toast(e instanceof ApiError ? e.message : "Could not mark ready");
                      }
                    }}
                  >
                    Mark ready
                  </Button>
                )}
                {o.status === "ready" && (
                  <Button variant="primary" icon={<PackageCheck size={16} />} onClick={() => setHandover(o)}>
                    Hand over
                  </Button>
                )}
                {o.status === "collected" && (
                  <Badge tone="good">
                    <CheckCircle2 size={13} />
                    Collected
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
        {!lists[tab].length && <Empty icon={<PackageCheck size={20} />} title={tab === "processing" ? "Nothing to pack" : tab === "ready" ? "No orders waiting" : "None collected yet today"} body="New pickup orders from the website and app appear here straight away." />}
      </div>
      {handover && (
        <Handover
          order={handover}
          onClose={() => setHandover(null)}
          onDone={async () => {
            await refresh();
          }}
        />
      )}
    </div>
  );
}

function Handover({ order, onClose, onDone }: { order: PickupRow; onClose: () => void; onDone: () => void }) {
  const [code, setCode] = useState("");
  const [idChecked, setIdChecked] = useState(false);
  const offline = useTill((s) => s.offline);
  const allowOffline = useDb((s) => s.settings.offline.pickupsOffline);
  const customer = useDb((s) => s.customers.find((c) => c.id === order.customerId));
  const ok = !order.pickupCode || code === order.pickupCode || idChecked;
  const blocked = offline && !allowOffline;
  return (
    <Dialog
      title={`Hand over ${order.number}`}
      sub="Check the pickup code from the customer's confirmation, or their photo ID."
      onClose={onClose}
      footer={
        <Button
          variant="primary"
          disabled={!ok || blocked}
          onClick={async () => {
            try {
              if (liveMode() && order.bookingId) {
                await posApi.pickupCollect(order.bookingId, { code: code || undefined, idChecked });
              } else {
                useDb.getState().patchOrder(order.id, { status: "collected", collectedAt: new Date().toISOString(), staffId: useTill.getState().staffId ?? undefined });
              }
              useDb.getState().log(`${order.number} collected in store`, "pickup");
              toast(`${order.number} handed over`);
              onDone();
              onClose();
            } catch (e) {
              toast(e instanceof ApiError ? e.message : "Handover failed");
            }
          }}
        >
          Confirm handover
        </Button>
      }
    >
      <Input aria-label="Pickup code" inputMode="numeric" maxLength={6} className="tnum h-14 text-center text-2xl tracking-[0.4em]" placeholder="••••••" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
      {order.pickupCode && code.length === 6 && code !== order.pickupCode && <p className="mt-2 text-[13px] text-bad">That code doesn't match this order.</p>}
      {order.pickupCode && code === order.pickupCode && <p className="mt-2 text-[13px] text-good">Code matches.</p>}
      <label className="mt-4 flex items-center gap-3 rounded-lg border border-line p-3 text-sm">
        <input type="checkbox" className="h-5 w-5 accent-[#17171a]" checked={idChecked} onChange={(e) => setIdChecked(e.target.checked)} />I checked photo ID for {order.customerName}
      </label>
      {customer && (
        <p className="mt-3 flex items-center gap-2 text-[13px] text-muted">
          <Phone size={14} />
          {customer.phone}
        </p>
      )}
    </Dialog>
  );
}
