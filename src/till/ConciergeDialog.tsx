import { useState } from "react";
import { Sparkles } from "lucide-react";
import { ApiError, liveMode } from "../api/client";
import { toKobo } from "../api/money";
import { posApi } from "../api/pos";
import { useDb, useTill } from "../data/store";
import type { ConciergeRequest, Product } from "../data/types";
import { Button, Dialog, Field, Input, Select, Segmented, toast } from "../ui/kit";
import { auditHere, useRegister } from "./common";

/** The categories on the website's "Start your request" form (DesktopStartRequest.tsx). */
const CATEGORIES = ["Footwear", "Clothing", "Accessories", "Fragrance", "Watches", "Eyewear", "Bags", "Jewellery", "Other"];

/**
 * Starts a concierge request from the till, for something the boutique can't sell today.
 * It lands in the admin's Concierge → Requests Inbox like a request from the website or app,
 * with the boutique and the staff member on it.
 */
export function ConciergeDialog({ product, size, onClose }: { product?: Product; size?: string; onClose: () => void }) {
  const customerId = useTill((s) => s.cart.customerId);
  const customer = useDb((s) => s.customers.find((c) => c.id === customerId));
  const staffId = useTill((s) => s.staffId) ?? "";
  const { store } = useRegister();
  const [item, setItem] = useState(product ? `${product.brand} ${product.name}` : "");
  const [category, setCategory] = useState(product ? { Fragrances: "Fragrance" }[product.category as string] ?? product.category : "Footwear");
  const [sz, setSz] = useState(size ?? "");
  const [budget, setBudget] = useState(product ? String(product.price) : "");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState<ConciergeRequest["priority"]>(customer?.tier === "Signature" ? "VIP" : customer?.tier === "Gold" ? "Priority" : "Standard");
  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [email, setEmail] = useState(customer?.email ?? "");
  const [busy, setBusy] = useState(false);

  const ok =
    item.trim().length > 2 &&
    name.trim() &&
    phone.replace(/\D/g, "").length >= 10 &&
    (!liveMode() || !!customer?.id || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()));
  return (
    <Dialog
      title="Start a concierge request"
      sub="For a piece the boutique doesn't have. It goes to the concierge team's Requests Inbox, and they reply within 24–48 hours with a quote."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            icon={<Sparkles size={16} />}
            disabled={!ok || busy}
            onClick={async () => {
              setBusy(true);
              try {
                if (liveMode()) {
                  const budgetNaira = Number(budget.replace(/\D/g, "")) || undefined;
                  const r = (await posApi.concierge({
                    customerId: customer?.id,
                    contactName: name.trim(),
                    contactPhone: phone.trim(),
                    contactEmail: customer?.email || email.trim() || undefined,
                    itemName: item.trim(),
                    category,
                    brand: product?.brand,
                    size: sz.trim() || undefined,
                    budget: budgetNaira != null ? toKobo(budgetNaira) : undefined,
                    notes: notes.trim() || undefined,
                    description: notes.trim() || undefined,
                    locationId: store.id,
                    qty: 1,
                  })) as { id: string; number?: string };
                  const ref = r.number ?? r.id;
                  auditHere("concierge", `Concierge request ${ref} for ${item.trim()}`, { ref });
                  useDb.getState().log(`${store.name}: concierge request ${ref} (${item.trim()})`, "online");
                  toast(`${ref} sent to the concierge team. ${name.split(" ")[0]} gets updates by email.`);
                } else {
                  const r = useDb.getState().addConciergeRequest({
                    customerId: customer?.id,
                    customerName: name.trim(),
                    phone: phone.trim(),
                    item: item.trim(),
                    category,
                    size: sz.trim() || undefined,
                    budget: Number(budget.replace(/\D/g, "")) || undefined,
                    notes: notes.trim(),
                    priority,
                    productId: product?.id,
                    storeId: store.id,
                    staffId,
                    createdAt: new Date().toISOString(),
                    status: "New",
                  });
                  auditHere("concierge", `Concierge request ${r.id} for ${r.item}`, { ref: r.id });
                  useDb.getState().log(`${store.name}: concierge request ${r.id} (${r.item})`, "online");
                  toast(`${r.id} sent to the concierge team. ${name.split(" ")[0]} gets updates by WhatsApp.`);
                }
                onClose();
              } catch (e) {
                toast(e instanceof ApiError ? e.message : "Could not send concierge request");
              } finally {
                setBusy(false);
              }
            }}
          >
            Send to concierge
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Item" className="sm:col-span-2">
          <Input value={item} onChange={(e) => setItem(e.target.value)} placeholder="Brand and name, e.g. Nike Dunk Low 'Panda'" />
        </Field>
        <Field label="Category">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Size">
          <Input value={sz} onChange={(e) => setSz(e.target.value)} placeholder="e.g. EU 43, M" />
        </Field>
        <Field label="Budget">
          <Input className="tnum" inputMode="numeric" prefix="₦" value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^\d]/g, ""))} />
        </Field>
        <Field label="Priority" hint="Set from the ASL Club tier. Signature clients have a dedicated concierge line.">
          <Segmented value={priority} onChange={setPriority} options={[{ value: "Standard", label: "Standard" }, { value: "Priority", label: "Priority" }, { value: "VIP", label: "VIP" }]} />
        </Field>
        <Field label="Client name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Phone (WhatsApp)">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
        </Field>
        {liveMode() && !customer?.id && (
          <Field label="Email" className="sm:col-span-2" hint="Needed so concierge can send the quote.">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" placeholder="client@email.com" />
          </Field>
        )}
        <Field label="Notes" className="sm:col-span-2">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full rounded-lg border border-line p-3 text-sm outline-none focus:border-ink" placeholder="Colour, condition, link, deadline" />
        </Field>
      </div>
      <p className="mt-4 text-xs text-muted">As on the website, payment is taken before the item is secured. The concierge team sends the quote and deposit link.</p>
    </Dialog>
  );
}
