// Shared read-only helpers over docs/contacts, used by HomeView and
// CategoriesView (and anywhere else that needs the same aggregations)
// so the two don't drift into subtly different filter logic.

function normalizeSenderName(s) {
  return (s || "").trim().toLowerCase();
}

// Core predicate behind all sender<->contact matching in the app: does a
// document's sender line refer to this contact? Substring containment,
// case-insensitive, whitespace-trimmed on both sides. Exported so callers
// matching a proposed contact name (e.g. a full letterhead name) against
// existing contacts (e.g. a shorter stored name) use the exact same rule
// as the rest of the app, rather than a separate, stricter comparison.
export function senderMatchesContactName(sender, contactName) {
  const normSender = normalizeSenderName(sender);
  const normContact = normalizeSenderName(contactName);
  if (!normSender || !normContact) return false;
  return normSender.includes(normContact);
}

// Docs whose sender refers to this contact (used by ContactDetailModal).
export function getDocsForContact(docs, contact) {
  if (!contact?.name) return [];
  return docs.filter((d) => senderMatchesContactName(d.sender, contact.name));
}

// IBAN is a much more reliable identity key than name-substring matching —
// used to dedupe GiroCode-derived contact suggestions against contacts that
// already exist (possibly under a slightly different name spelling).
export function findContactByIban(contacts, iban) {
  const normalized = (iban || "").replace(/\s/g, "").toUpperCase();
  if (!normalized) return null;
  return (
    contacts.find(
      (c) => (c.iban || "").replace(/\s/g, "").toUpperCase() === normalized
    ) || null
  );
}

// Contacts whose name matches this sender string (used by CategoriesView
// to show "verknüpfte Kontakte" for a category — opposite direction of
// getDocsForContact, same underlying predicate).
export function findContactsForSender(contacts, senderName) {
  if (!senderName) return [];
  return contacts.filter((c) => senderMatchesContactName(senderName, c.name));
}

// Status is 4-state: "Offen" | "Laufend" | "Erledigt" | null ("Kein
// Status"). Only "Offen"/"Laufend" count as an active, unresolved document
// — an allowlist rather than `status !== "Erledigt"`, since that blocklist
// form would silently also count null (no status at all) as active.
export function isActive(status) {
  return status === "Offen" || status === "Laufend";
}

// "Laufend" docs with no deadline to anchor them to — otherwise invisible
// everywhere on Home (Laufend WITH a deadline already surfaces fine via
// getOpenDeadlines, which counts it as active). docs is already
// newest-first; filter preserves that order, no re-sort needed.
export function getOngoingWithoutDeadline(docs) {
  return docs.filter((d) => d.status === "Laufend" && !d.deadline);
}

// Open deadlines, soonest first — same filter+sort HomeView already used.
export function getOpenDeadlines(docs) {
  return docs
    .filter((d) => d.deadline && isActive(d.status))
    .sort((a, b) => a.deadline.localeCompare(b.deadline));
}

// Open amounts (pending payments), soonest deadline first (no deadline
// sorts last) — same filter+sort HomeView already used.
export function getOpenAmounts(docs) {
  return docs
    .filter((d) => d.amount != null && isActive(d.status))
    .sort((a, b) => (a.deadline || "9").localeCompare(b.deadline || "9"));
}

// Doc counts per category, most active first — same grouping
// CategoriesView already used for its overview grid.
export function getCategoryGroups(docs) {
  const map = new Map();
  for (const d of docs) {
    const cat = d.category || "Sonstiges";
    if (!map.has(cat)) map.set(cat, { total: 0, open: 0 });
    const g = map.get(cat);
    g.total += 1;
    if (isActive(d.status)) g.open += 1;
  }
  return [...map.entries()]
    .map(([name, counts]) => ({ name, ...counts }))
    .sort(
      (a, b) =>
        b.open - a.open ||
        b.total - a.total ||
        a.name.localeCompare(b.name)
    );
}

// Doc ids considered "wahrscheinlich wiederkehrend". doc.recurring is a
// tri-state: null means the user never explicitly decided (Claude's own
// guess doesn't count as a decision either) — only then does the heuristic
// (same sender, deadlineType "zahlung", appearing 2+ times) get to weigh in.
// An explicit true/false is binding and skips the heuristic entirely, in
// both directions — a document the user explicitly marked "not recurring"
// must not be pulled back in just because a sibling invoice matches the
// pattern.
// contact.iban is treated as a supporting signal by callers, not part of
// this gate — plenty of one-off invoices carry an IBAN too (see the Telekom
// test scan), so IBAN alone would over-flag.
export function getRecurringPaymentDocIds(docs) {
  const groups = new Map();
  for (const d of docs) {
    if (d.recurring != null) continue;
    if (d.deadlineType !== "zahlung" || !d.sender) continue;
    const key = normalizeSenderName(d.sender);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(d);
  }
  const recurring = new Set();
  for (const group of groups.values()) {
    if (group.length >= 2) {
      for (const d of group) recurring.add(d.id);
    }
  }
  for (const d of docs) {
    if (d.recurring === true) recurring.add(d.id);
  }
  return recurring;
}

// Most recently scanned docs. `docs` is already newest-first (prepended on
// scan, and fetched with `ORDER BY created_at DESC`) — no re-sort needed.
export function getRecentDocs(docs, n = 5) {
  return docs.slice(0, n);
}
