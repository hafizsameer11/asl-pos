# POS ↔ ASL ORIGINALS: how the POS fits the existing app

> **Backend build status:** Phase plan lives in `asl-backend/docs/POS_PLAN.md`.  
> **Phases 1–3 (till):** `/api/v1/pos/*` — PIN auth, sell, returns, pickups, gift cards, promos, layaway, ship-to, alterations, transfers, counts/GRN, concierge-from-till. Money is **kobo**.  
> **Phase 4 (admin):** `/api/v1/admin/pos/*` — overview, transactions, reports, registers, audit, promotions, gift cards, settings.  
> **Phase 5 (later):** SMS/WhatsApp/email/push providers. Outbounds stay `pending` until then.

This is for the developers building the POS into the existing ASL ORIGINALS website, app and admin. The reference for "existing" is the Lovable prototype (`asl-orginals`, TanStack Start). File paths below point into that codebase, for example `src/lib/club-store.ts`.

The POS prototype in this repo uses the app's data wherever the app has it. It does not invent its own versions. Where the app has nothing, the POS adds it, and this document lists each addition.

## 1. What the POS reuses from the app (no rebuild)

| Area | In the app | How the POS uses it |
| --- | --- | --- |
| Brand | "ASL ORIGINALS". Inter Tight. Ink `#0f0f0f`, burnt orange `#cc5000`, admin canvas `#f7f5ef` (`src/styles.css`) | Same name, font and colours on the till, receipts and admin pages |
| Admin layout | Black sidebar, 12 groups, white active pill, `PageHeader` 28px bold (`components/admin/*`) | The POS admin copies the sidebar, groups, labels and routes. **POS** is one new group after **Sales**. |
| Products | `shopProducts`, `bestSellerProducts`, `trendingProducts` (`lib/shop-data.ts`): 65 products with ids `c1`, `f1`, `a1`, `fr1`, `bs1`, `tr1`… | Same ids, names, brands, prices, sale prices (`getSaleInfo`), sizes, size labels, photos, and availability (In Stock, Pre Order, Limited Pieces, Restocked). "On Request" and out-of-stock items are flagged the same way. |
| SKUs | `${productId}-${size}`, e.g. `F1-42`, `A1-ONESIZE` (`lib/inventory-store.ts`) | Same SKU format. The till adds a barcode per SKU. |
| Categories | Clothing, Footwear, Accessories, Fragrances | Same four, with subcategories |
| Boutiques | Pickup locations LOC-1001 ASL Ikoyi Flagship, LOC-1002 ASL Lekki Lounge, LOC-1003 ASL Abuja Salon (Maitama) (`lib/pickups-store.ts`) | The same three, with the same ids, addresses, phones and hours, are the POS stores. Warehouse `lag` is Lagos Flagship DC (LAG-01). |
| Customers | `cus_1000`…`cus_1041` (`lib/customers-store.ts`) | The same 42 customers, generated the same way, with the same tiers, wallet balances and points |
| ASL Club | Standard / Silver / Gold / Signature by lifetime spend (0 / ₦500k / ₦1.5M / ₦3.5M). Multipliers 1 / 1.25 / 1.75 / 3. 1 point per ₦1,000, 1 point = ₦25, birthday bonus 500 (`lib/club-store.ts`) | Same rules. The till shows tier perks word for word. **Loyalty at the till** shows the rules read-only, with a link to edit them in ASL Club. |
| ASL Wallet | `Customer.walletBalance`. Admin wallet ledger (`lib/wallets-store.ts`). Settings method "ASL Wallet". | A till payment method. Refunds and cancelled deposits can go back to the wallet. |
| Coupons | WELCOME10, VIP25, SNEAKER15, CONCIERGE10, LOEWE5K, RAMADAN30 with min spend, max discount and channels (`lib/coupons-store.ts`) | Same codes and rules, including the max discount cap. The POS adds a fourth channel, `store`. |
| Shipping | ZN-1001 Lagos Metro (same day ₦4,500, standard ₦2,500); ZN-1002 Nigeria (DHL ₦8,500, GIG ₦3,500) (`lib/shipping-zones-store.ts`) | Used as the delivery zones for "Ship to customer" |
| Order numbers | `ASL-ORD-` + 6 digits (`lib/orders-store.ts`) | Till sales use the same sequence, so one order list covers every channel |
| VAT | Nigeria VAT 7.5%, inclusive (`lib/tax-store.ts` TX-01) | Same rate. Prices include VAT. |
| Returns | Reasons from `components/admin/Returns.tsx`. Fragrances, underwear and swimwear are final sale (`returnsInnerData.ts`). | Same reasons and final-sale list. The in-store window is 7 days. |
| Gift card expiry | The FAQ says 1 year | 12 months |
| Reservations | Drops take a 50% deposit (`lib/coming-soon.ts` `DEPOSIT_RATE`) | The minimum in-store reservation deposit is 50% |
| Size guides | Clothing XS–XXL, jeans by waist, footwear EU 39–46 | The customer's saved sizes use the same runs |
| Concierge | Requests `ASL-REQ-00421`, statuses New → Sourcing → Quoted → …, priority Standard / Priority / VIP (`lib/concierge-requests-store.ts`) | Staff can start a request from the till. It uses the same id format and statuses, and priority is set from the ASL Club tier. |

## 2. What the existing app needs for the POS (data and backend changes)

These are the changes to make in the existing app so till sales flow through it. Each has the file it touches.

### Orders (`lib/orders-store.ts`, `components/account/ordersData.ts`)

The order needs these new fields:

- `channel`: `"web" | "mobile" | "concierge" | "store"`. There is no channel on orders today.
- `locationId`: the boutique (LOC-…).
- `registerId`, `sessionId`, `staffId`.
- `customerId`. Orders only hold `contact.email` today.
- `payments: { method, amount, reference }[]`, so one order can be paid several ways, plus `change`. Today there is a single `payment`.
- `paymentStatus`. Today OrderDetail works it out from the order status.

Each line needs `productId`, `sku`, `size` and `colour` as fields. Today they are folded into the `variant` string.

Each line also needs:

- `lineDiscount`, plus `promo` (the automatic-promotion part of it)
- `soldBy`: who gets the sales credit

The order also needs:

- `promos[]`, `couponCode`, `couponAmount`, `manualDiscount {amount, reason}`
- `pointsEarned`, `pointsRedeemed`
- `vat`, worked out as inclusive: `total × 7.5 / 107.5`. Today `OrderDetail.tsx` calculates `total × 0.075`, which is wrong for inclusive prices.
- `returns[]`, `reservation`, `delivery`, `extras[]` (gift cards sold, alteration fees, delivery fee)

Admin changes:

- **Orders:** a channel filter (Web / App / Concierge / In store) and a Store filter.
- **Order detail:** show the boutique, the cashier and the tenders.

### Payments (`lib/settings-store.ts`, `lib/checkout-store.ts`)

Add these payment methods:

| Method | Notes |
| --- | --- |
| `cash` | |
| `card_terminal` | Provider name, e.g. Moniepoint, plus the terminal ID per register |
| `transfer` | Already exists as `bank` |
| `wallet` | Already listed as "ASL Wallet" but never used at checkout |
| `giftcard` | |
| `points` | |

The orders filter, the settings and the checkout each use a different list of method values today. Use one list everywhere.

### Inventory (`lib/inventory-store.ts`, `components/admin/AdminInventory.tsx`)

- `WAREHOUSES` is a fixed list. Make stock locations a table, and add the three boutiques as locations with their LOC ids, so the same id means the same place in Pickups and Inventory.
- Post movements for sales, returns, transfers, counts and supplier deliveries. The `sale` and `return` movement types already exist but nothing writes them.
- The movement's `user` should be the real staff member. It is hard-coded to "Admin" today.
- Hold stock for reservations and pickup orders (`reserved`).

### Customers and ASL Club (`lib/customers-store.ts`, `lib/club-store.ts`, `lib/wallets-store.ts`)

- In-store sales add to `spend` and `orders` and can move the tier. Points earned and used go to the ASL Club ledger with a reason like `Order #ASL-ORD-021093 · in store`.
- Wallet entries from the till:
  - Paying from the wallet is `kind: "spend"`.
  - Refunds and cancelled deposits are `kind: "refund"`.
  - Both need a new channel value, `pos`.
- New optional customer fields:
  - `sizes { top, bottom, shoe }`, for clienteling.
  - A link to the app wishlist, which `lib/wishlist.ts` keeps today.
  - `birthday`, which the app collects as Date of Birth on account details.

### Coupons (`lib/coupons-store.ts`, `components/admin/AdminCoupons.tsx`)

- Add `"store"` to `channels`, with an **In store** toggle next to Web, Mobile and Concierge. The till accepts a code only when it is on.
- The website checkout ignores these rules today: it has its own fixed list `{ASL20OFF, WELCOME10, VIP30, APP10}` in `checkout-store.ts`. The POS applies the admin's rules (min spend, max discount, channel, active), and the website should too.

### Team and roles (`lib/admin-role-store.ts`, `lib/team-store.ts`, `nav-config.ts`)

Add three roles:

| New `AdminRole` | Shown as | POS prototype role |
| --- | --- | --- |
| `store_manager` | Store Manager | Manager |
| `store_supervisor` | Supervisor | Supervisor |
| `store_cashier` | Cashier / Sales associate | Cashier |

- `TeamMember` gets `locationIds: string[]` and a till `pin`, stored hashed on the server.
- New `PermissionKey`s for a **POS** group in `PERMISSION_GROUPS`:
  - `pos.sell`, `pos.discount`, `pos.price_override`, `pos.refund`, `pos.refund_no_receipt`, `pos.void`, `pos.cash_moves`, `pos.open_close`, `pos.stock_adjust`, `pos.reports`
  - Discount limits per role: Cashier 10%, Supervisor 25%, Manager 100%

### Admin menu (`components/admin/nav-config.ts`)

Add a group after `sales`. The POS prototype has 20 pages. Either nest them in sub-groups as the prototype does (Operate / Selling / Set up), or put the settings pages behind one **POS Settings** page with tabs.

```ts
{
  id: "pos",
  label: "POS",
  items: [
    { id: "pos-overview", label: "Overview", to: "/admin/pos", icon: Gauge, roles: ["super_admin", "ops_manager", "store_manager"] },
    { id: "pos-transactions", label: "Transactions", to: "/admin/pos/transactions", icon: ReceiptText, roles: ["super_admin", "ops_manager", "finance", "store_manager"] },
    { id: "pos-reports", label: "Reports", to: "/admin/pos/reports", icon: BarChart3, roles: ["super_admin", "finance", "analyst", "store_manager"] },
    { id: "pos-registers", label: "Registers & sessions", to: "/admin/pos/registers", icon: MonitorSmartphone, roles: ["super_admin", "ops_manager", "finance", "store_manager"] },
    { id: "pos-stock", label: "Stock movements", to: "/admin/pos/stock", icon: ArrowLeftRight, roles: ["super_admin", "ops_manager", "catalog_manager", "store_manager"] },
    { id: "pos-audit", label: "Audit log", to: "/admin/pos/audit", icon: ShieldCheck, roles: ["super_admin", "store_manager"] },
    { id: "pos-promotions", label: "Automatic promotions", to: "/admin/pos/promotions", icon: Sparkles, roles: ["super_admin", "marketing"] },
    { id: "pos-giftcards", label: "Gift cards", to: "/admin/pos/gift-cards", icon: Gift, roles: ["super_admin", "finance", "store_manager"] },
    { id: "pos-settings", label: "POS settings", to: "/admin/pos/settings", icon: Settings, roles: ["super_admin", "ops_manager"] },
  ],
},
```

Route titles follow the existing pattern, e.g. `"Registers & sessions · ASL Admin"`.

### Audit (`lib/audit-store.ts`)

- Add `AuditCategory` `"pos"`.
- Map the POS prototype's audit actions to `action` strings:
  - `pos.discount.approve`
  - `pos.price.change`
  - `pos.refund`
  - `pos.sale.void`
  - `pos.cash.in` / `pos.cash.out`
  - `pos.drawer.open`
  - `pos.stock.adjust`
  - `pos.count`
  - `pos.transfer`
  - `pos.giftcard.issue`
  - `pos.reservation`
  - `pos.concierge.create`
- `useAudit().log()` exists, but nothing calls it yet.

### Ledger (`lib/ledger-store.ts`)

Add these accounts:

- **1030 Cash in tills.** Floats, cash sales, pay in and out, and bank deposits.
- **1040 Card terminal settlement.** For the terminal provider.

**2200 Gift card liability** already exists. Gift cards sold at the till credit it, and redemptions debit it. **2000 Wallet liabilities** is used for ASL Wallet payments and refunds.

### Pickups (`lib/pickups-store.ts`, `checkout.information.tsx`)

- **Collection code.** Bookings have no collection code; staff type "Received by…" as free text. The till uses a 6-digit pickup code, or an ID check when there is no code. Add `pickupCode` to `PickupBooking`, and send it in the order confirmation.
- **Which boutique.** Checkout offers only "ASL ORIGINALS Lekki, The Lennox Mall", which isn't one of the LOC locations. The customer should choose a boutique from the active pickup locations, and the order should store `locationId`.
- **Statuses.** Map the till's statuses to the booking statuses:

  | Till | Booking |
  | --- | --- |
  | Processing | `scheduled` |
  | Ready | `ready` |
  | Collected | `collected` |

  A booking not collected by its date becomes `no_show`.

### Customer messages: email, SMS, WhatsApp, push (`lib/messaging-store.ts`, `components/admin/AdminMessaging.tsx`, `lib/notification-settings-store.ts`)

The admin already has a messaging system:

- **Marketing → Push & Email** has templates on four channels (`MsgChannel = "email" | "push" | "sms" | "whatsapp"`), each with a trigger and a preview, plus push blasts.
- **Marketing → Campaigns** sends to segments.

The till's messages should go through this same system, not a separate one. The till's receipt buttons (email, SMS, WhatsApp) and every in-store event below become template sends.

**New templates**, in the same shape as the existing ones (`Template { code, name, channel, category, trigger, … }`). Each event gets one template per channel it uses, because a template has one channel.

| Code | Name | Channels | Category | Fires when |
| --- | --- | --- | --- | --- |
| `pos.receipt` | In-store receipt | email, sms, whatsapp | transactional | Staff tap Email, SMS or WhatsApp on the till's receipt screen. Has the order lines, totals, payments, ASL Club points and a link to the order. |
| `pos.gift_receipt` | Gift receipt | email, whatsapp | transactional | The same, with prices hidden |
| `pos.return_slip` | Refund or exchange slip | email, sms | transactional | A return or exchange is completed at the till. Says where the refund went (card, ASL Wallet, cash). |
| `pickup.ready` | Ready to collect | push, sms, whatsapp | transactional | Staff mark a website or app pickup order ready. Includes the boutique, opening hours and the 6-digit pickup code. |
| `pickup.collected` | Collected | push | transactional | The order is handed over at the till |
| `pickup.reminder` | Pickup reminder | sms, whatsapp | transactional | Ready and not collected after 3 days, before it becomes a no-show |
| `reservation.created` | Items reserved | email, whatsapp | transactional | A deposit is taken at the till. Has the deposit paid, the balance and the collect-by date. |
| `reservation.reminder` | Reservation balance due | sms, whatsapp | transactional | 3 days before the collect-by date (the admin "Hold items for" setting) |
| `reservation.cancelled` | Reservation cancelled | email | transactional | Says where the deposit went, as set in the admin |
| `alteration.received` | Alteration booked | sms, whatsapp | transactional | Ticket created, with the ALT- number and ready-by date |
| `alteration.ready` | Alteration ready | push, sms, whatsapp | transactional | Staff mark the alteration ready |
| `giftcard.issued` | Your gift card | email, sms | transactional | A gift card is sold at the till. Has the code, balance and expiry. Can go to the recipient, not the buyer. |
| `delivery.dispatched` | On its way | push, sms | transactional | A ship-to-customer sale from the till is dispatched. Reuse `order.shipped` if the content fits. |
| `concierge.store_request` | Request received | whatsapp | concierge | A concierge request is started at the till. Says when the team will reply (24–48h). |
| `customer.welcome_store` | Welcome to ASL Club | email | lifecycle | A new customer is signed up at the till |

Variables available from the POS:

- order: `order.number`, `order.total`, `order.lines`
- `store.name`, `store.address`, `store.hours`
- `staff.first_name`
- `pickup.code`
- `club.points_earned`, `club.points_balance`, `club.tier`
- `wallet.balance`
- `reservation.balance`, `reservation.until`
- `alteration.number`
- `giftcard.code`, `giftcard.balance`, `giftcard.expires`

**Providers.** Settings for these are missing today:

- **WhatsApp.** Templates and campaigns offer WhatsApp, but there's nowhere to connect a WhatsApp Business account.
  - Add a `whatsapp` block to the notification settings: `{ provider: "meta_cloud" | "twilio" | "360dialog"; phoneNumberId; businessAccountId; enabled }`.
  - Every WhatsApp template has to be approved by Meta before it can be sent. Store the approval status on the template: `waStatus: "pending" | "approved" | "rejected"`.
  - The admin should only let an approved template go live.
  - Messages outside a 24-hour customer reply window must use an approved template.
- **Push.** There's no push provider setting.
  - Add `{ provider: "fcm" | "expo"; enabled }` for the app.
  - Store device tokens per customer.
  - Push goes only to customers with the app and notifications allowed. Fall back to SMS or WhatsApp for the till's messages.
- **SMS.** Twilio or Africa's Talking is already there, but switched off (`enabled: false`). In-store messages need it on, with the "ASL" sender ID registered with Nigerian networks.
- **Email.** Already set up: Resend, from `no-reply@asloriginals.online`.

**Customer consent and choice:**

- The till shows the customer's phone and email and only offers channels they have.
- Transactional messages (receipts, pickups, reservations, alterations) don't need marketing opt-in. Campaigns respect `marketingOptIn`.
- The customer's preferred channel (e.g. "Prefers WhatsApp updates" in admin notes) should become a field, `preferredChannel`, which the till picks by default.

**Sending.** Sends go through a server-side queue, never straight from the till, so a till that goes offline sends them once it syncs. Log each send (template, channel, status, provider message id) against the order, so staff can see "Receipt sent by WhatsApp, delivered" on the order in the till and in the admin.

### Reports and notifications (`lib/reports-store.ts`, `lib/notification-settings-store.ts`)

- **New reports:**
  - Z report per session
  - Daily cash reconciliation
  - Sales by boutique and staff, with commission
  - Gift card liability
- **Analytics:** the `Channel` type (`lib/analytics-sales-store.ts`) gets `"store"`.
- **New notification rules:**
  - Cash difference at close over the limit
  - In-store sale over ₦2M (same as `order_high_value`)
  - Till offline with unsynced sales
  - Transfer waiting for approval

## 3. New in the POS: not in the app at all

These need new tables, API endpoints and admin pages:

| Feature | What it is | Where the app would show it |
| --- | --- | --- |
| Registers and sessions | Tills per boutique, floats, pay in and out, blind close, Z report | POS → Registers & sessions |
| Gift cards | Sold at the till (and later online), redeemed as a payment, 12-month expiry, balance check | POS → Gift cards. The app should also add gift cards to checkout and the account wallet. Ledger 2200 and tax class TC-04 already exist. |
| Automatic promotions | Buy 2 get 1, brand or category %, spend and save, birthday month, per channel and boutique, with dates | The app has fixed sale prices (`saleDiscountById`) and coupons only. Coupon `autoApply` exists but checkout never uses it. Either make this the shared promotions engine for web and store, or keep it POS-only. |
| Reservations at the till | Deposit (≥50%), hold days, pay the balance, cancel to wallet or original method | The same entity as drop reservations (`lib/reservations-store.ts`, RSV- ids). Store `channel` and `locationId` on it. |
| Alterations | Tickets for hemming and fitting, tailor, status, fee | New. Show on the customer and the order. |
| Ship to customer from the till | Sell an item the boutique doesn't have, ship from Lagos Flagship DC or another boutique | Creates a normal shipment (`lib/shipments-store.ts`) |
| Transfers between locations | Request → approve → in transit → received | Today Inventory has only an instant transfer |
| Stock counts and supplier deliveries | Count by scanning, receive by scanning against a PO | New |
| Sales credit and commission | Credit per line to an associate, rate per role, monthly targets | New |
| Offline selling | Queue sales and sync later, with a limit on offline sale size | Till only |
| Concierge from the till | Request with `source: "store"`, `locationId`, `staffId` | Add those three fields to `ConciergeRequest` |

## 4. Things in the app to settle first

The app disagrees with itself in a few places. The POS picked one answer for each. Confirm these before building.

1. **Loyalty has two models.**
   - The admin's ASL Club (Standard / Silver / Gold / Signature by spend, 1 point = ₦25) is in `club-store.ts`.
   - The customer Rewards pages use Bronze / Silver / Gold / Platinum by points with ₦10 a point (`components/account/rewardsData.ts`).
   - Checkout confirmation says 1 point per ₦100 (`checkout.confirmation.tsx`).
   - **The POS follows ASL Club.** The customer pages should read from it too.
2. **Coupons.** The website checkout doesn't use the admin's coupons (see above).
3. **VAT.**
   - The tax settings say 7.5% inclusive.
   - Store settings say `taxesIncluded: false`.
   - A ledger memo says 5%.
   - **The POS uses 7.5% inclusive.** Two VAT/TIN numbers also exist (`NG-VAT-018472920` and `NG-VAT-2026-441290`).
4. **Return window.**
   - The customer policy says 3–7 days from delivery.
   - Store settings say 14 days.
   - **The POS uses 7 days from purchase.** Admins can change it.
5. **Refund method.** The policy says "original payment method", but a sample return and the audit log refund to the wallet. **The POS offers original, ASL Wallet or cash**, set in the admin.
6. **ID formats.**
   - Orders: `ASL-ORD-…` vs `ORD-…` (pickups, shipments, payouts).
   - Warehouses: `lag` vs `WH-LAG-01`.
   - Pick one of each.
7. **Free shipping.**
   - Checkout trust copy says over ₦50,000.
   - The Silver perk says over ₦100k.
   - Zones say over ₦200k (standard) or ₦750k (same day).
   - Checkout charges a flat ₦4,000 / ₦5,000 / ₦6,000 regardless.
   - **The POS uses the zones.**
8. **Referrals.** The customer page says ₦5,000 each way. The admin says ₦15,000 credit and 10% off. ASL Club says 1,000 points.
9. **Small data fixes.**
   - `fr5` "Bleu de Chanel" is listed under brand DIOR.
   - `tr3` has brand "CARGO TROUSERS".
   - Brand case mixes "Nike" and "NIKE". The POS uppercases all brands.
10. **Email domains.** `asloriginals.com` (team), `aslorig.co` (ledger), `asloriginals.online` (referral links).

## 5. Field names: POS prototype → app

| POS prototype | App |
| --- | --- |
| `Customer.loyaltyPoints`, `walletBalance`, `spend`, `tier` | Same names (`customers-store.ts`) |
| `Tier` | `CustomerTier` |
| `Store.id` (LOC-1001…) | `PickupLocation.id` |
| `Variant.sku` | `StockRow.sku` |
| `Product.id`, `availability`, `sizeLabels` | `shop-data.ts` `Product` |
| `Coupon.channels` (+ `store`) | `Coupon.channels` |
| `PayMethod "wallet"` | Settings `wallet` "ASL Wallet" |
| `Order.number` (ASL-ORD-…) | `PlacedOrder.id` |
| `Order.reservation` | `OrderReservation` / `Reservation` |
| `ConciergeRequest` | `concierge-requests-store.ts` request |
| `Staff.role` Manager / Supervisor / Cashier | New `AdminRole`s (above) |

## 6. Nest API map (replace `useDb`)

**Live mode (wired):** copy `.env.example` → `.env.development.local`, set `VITE_POS_LIVE=1`, run backend on `:3000`, then `npm run dev` (Vite proxies `/api` → backend).

Wired today: PIN login, open/close register, cash moves, catalog hydrate, customer search/create, complete sale (incl. layaway/ship extras), returns, pickups, receipt email, offline sync queue. Demo Zustand remains when `VITE_POS_LIVE` is off.

Point the till at `VITE_API_BASE=/api/v1/pos` (staff JWT from `POST /auth/pin`). Admin console at `/api/v1/admin/pos` (admin JWT). Money is **kobo** on the wire (prototype UI still shows naira — multiply/divide by 100 at the edge).

| Prototype (`useDb`) | Till API | Admin API |
| --- | --- | --- |
| PIN login / me | `POST /auth/pin`, `GET /me` | — |
| Open/close register, cash moves, Z | `POST /registers/:id/open`, `/sessions/:id/*` | `GET /registers`, `/sessions` |
| Catalog + local stock | `GET /catalog` (+ `X-Pos-Register`) | — |
| Customers | `GET/POST /customers` | — |
| Quote / complete / sync | `POST /sales/quote`, `/sales`, `/sales/sync` | `GET /transactions`, `/overview`, `/reports` |
| Returns / pickups | `/sales/:id/returns`, `/pickups/*` | — |
| Gift cards | `/gift-cards/*` | `/gift-cards/*` |
| Promotions | `GET /promotions` (auto-applied in quote) | `GET/POST/PATCH /promotions` |
| Layaway | `fulfilment: layaway` on sale; `/sales/:id/layaway/*` | filter transactions |
| Ship-to | `fulfilment: ship` + `/sales/shipping-quote` | — |
| Alterations | `/alterations/*` | — |
| Transfers / counts / GRN | `/transfers/*`, `/stock-counts/*`, `/grn/*` | `GET /stock-moves` |
| Concierge from till | `POST /concierge` | existing `/admin/concierge/*` |
| Audit / settings | (events written server-side) | `GET /audit`, `GET/PATCH /settings` |

## 7. Assets

The zip had the logos only as Lovable asset pointers (`src/assets/ASL_*.png.asset.json`), not the image files. The POS uses the "ASL ORIGINALS" wordmark as text, in the admin's style. Swap in `ASL_wordmark_black.png` / `ASL_wordmark_white.png` and `ASL_logo_emblem_black.png` for the receipt and app icon when building.

The product photos in `public/products` are the app's own product images, resized to 400px.
