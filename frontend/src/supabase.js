import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const SUPABASE_CONFIGURED = !!(url && anonKey);

export const supabase = SUPABASE_CONFIGURED
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

// ---- Row ⇄ App-object mappers ----

export function docToRow(doc, userId) {
  return {
    id: doc.id,
    user_id: userId,
    title: doc.title || "",
    sender: doc.sender || null,
    category: doc.category || null,
    document_type: doc.documentType || doc.document_type || null,
    summary: doc.summary || null,
    full_text: doc.fullText || doc.full_text || null,
    deadline: doc.deadline || null,
    deadline_type: doc.deadlineType || doc.deadline_type || null,
    reply_draft: doc.replyDraft || doc.reply_draft || null,
    amount: doc.amount ?? null,
    status: doc.status || "Offen",
    notes: doc.notes || null,
    manual: !!doc.manual,
    // Tri-state: null = never explicitly decided by the user (heuristic in
    // getRecurringPaymentDocIds applies), true/false = binding decision —
    // must not collapse null to false here.
    recurring: doc.recurring == null ? null : !!doc.recurring,
    qr_codes: Array.isArray(doc.qrCodes) ? doc.qrCodes : [],
    filename: doc.filename || null,
    scan_date: doc.date || null,
  };
}

export function rowToDoc(row) {
  return {
    id: row.id,
    title: row.title,
    sender: row.sender || "",
    category: row.category || "Sonstiges",
    documentType: row.document_type,
    summary: row.summary,
    fullText: row.full_text,
    deadline: row.deadline,
    deadlineType: row.deadline_type,
    replyDraft: row.reply_draft,
    amount: row.amount,
    status: row.status || "Offen",
    notes: row.notes,
    manual: !!row.manual,
    recurring: row.recurring == null ? null : !!row.recurring,
    qrCodes: Array.isArray(row.qr_codes) ? row.qr_codes : [],
    filename: row.filename,
    date: row.scan_date || (row.created_at ? row.created_at.slice(0, 10) : null),
  };
}

export function contactToRow(c, userId) {
  return {
    id: c.id,
    user_id: userId,
    name: c.name || "",
    type: c.type || null,
    iban: c.iban || null,
    bic: c.bic || null,
    email: c.email || null,
    phone: c.phone || null,
    street: c.street || null,
    zip: c.zip || null,
    city: c.city || null,
    notes: c.notes || null,
  };
}

export function rowToContact(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    iban: row.iban,
    bic: row.bic,
    email: row.email,
    phone: row.phone,
    street: row.street,
    zip: row.zip,
    city: row.city,
    notes: row.notes,
  };
}

export function reminderToRow(r, userId) {
  return {
    id: r.id,
    user_id: userId,
    doc_id: r.docId || null,
    title: r.title || "",
    date: r.date || null,
    days_before: r.daysBefore ?? 0,
    notes: r.notes || null,
    done: !!r.done,
    kind: r.kind || null,
    orphaned: !!r.orphaned,
  };
}

export function rowToReminder(row) {
  return {
    id: row.id,
    docId: row.doc_id,
    title: row.title,
    date: row.date,
    daysBefore: row.days_before ?? 0,
    notes: row.notes,
    done: !!row.done,
    kind: row.kind,
    orphaned: !!row.orphaned,
  };
}

export function eventToRow(e, userId) {
  return {
    id: e.id,
    user_id: userId,
    doc_id: e.docId || null,
    title: e.title || "",
    date: e.date || null,
    time: e.time || null,
    contact_id: e.contactId || null,
    notes: e.notes || null,
  };
}

export function rowToEvent(row) {
  return {
    id: row.id,
    docId: row.doc_id,
    title: row.title,
    date: row.date,
    time: row.time,
    contactId: row.contact_id,
    notes: row.notes,
  };
}

export function savedTemplateToRow(t, userId) {
  return {
    id: t.id,
    user_id: userId,
    template_type: t.templateType || "",
    title: t.title || "",
    body: t.body || "",
  };
}

export function rowToSavedTemplate(row) {
  return {
    id: row.id,
    templateType: row.template_type,
    title: row.title,
    body: row.body,
  };
}

// ---- CRUD helpers ----

export async function fetchAll(userId) {
  const [docs, contacts, reminders, events, savedTemplates] = await Promise.all([
    supabase
      .from("documents")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("contacts")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("reminders")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("events")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("saved_templates")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  for (const r of [docs, contacts, reminders, events, savedTemplates]) {
    if (r.error) throw r.error;
  }

  return {
    docs: (docs.data || []).map(rowToDoc),
    contacts: (contacts.data || []).map(rowToContact),
    reminders: (reminders.data || []).map(rowToReminder),
    events: (events.data || []).map(rowToEvent),
    savedTemplates: (savedTemplates.data || []).map(rowToSavedTemplate),
  };
}

const TABLE_MAP = {
  documents: docToRow,
  contacts: contactToRow,
  reminders: reminderToRow,
  events: eventToRow,
  saved_templates: savedTemplateToRow,
};

export async function syncDiff(table, prev, current, userId, onError) {
  if (!supabase || !userId) return;
  const toRow = TABLE_MAP[table];
  if (!toRow) return;

  const prevMap = new Map(prev.map((x) => [x.id, x]));
  const currentMap = new Map(current.map((x) => [x.id, x]));

  const toDelete = prev.filter((x) => !currentMap.has(x.id));
  const toUpsert = current.filter((x) => {
    if (!prevMap.has(x.id)) return true;
    const p = prevMap.get(x.id);
    return JSON.stringify(toRow(p, userId)) !== JSON.stringify(toRow(x, userId));
  });

  const ops = [];
  if (toDelete.length > 0) {
    ops.push(
      supabase
        .from(table)
        .delete()
        .in(
          "id",
          toDelete.map((x) => x.id)
        )
    );
  }
  if (toUpsert.length > 0) {
    ops.push(
      supabase.from(table).upsert(toUpsert.map((x) => toRow(x, userId)))
    );
  }

  const results = await Promise.all(ops);
  for (const r of results) {
    if (r.error) {
      console.error(`syncDiff(${table}) failed:`, r.error);
      onError?.(table, r.error);
    }
  }
}

export async function bulkInsert(table, items, userId) {
  if (!supabase || !userId || items.length === 0) return;
  const toRow = TABLE_MAP[table];
  const rows = items.map((x) => toRow(x, userId));
  const { error } = await supabase.from(table).upsert(rows);
  if (error) throw error;
}
