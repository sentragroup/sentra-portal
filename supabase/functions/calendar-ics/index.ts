import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SECRET_TOKEN = "sntr-cal-f8k2";

function toIcsDate(dateStr: string): string {
  // Accepts YYYY-MM-DD or ISO string, returns YYYYMMDD
  const d = dateStr.substring(0, 10).replace(/-/g, "");
  return d;
}

function icsEscape(s: string): string {
  return (s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function makeEvent(uid: string, dtstart: string, summary: string, description: string): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  return [
    "BEGIN:VEVENT",
    `UID:${uid}@sentra-portal`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${dtstart}`,
    `DTEND;VALUE=DATE:${dtstart}`,
    `SUMMARY:${icsEscape(summary)}`,
    description ? `DESCRIPTION:${icsEscape(description)}` : "",
    "END:VEVENT",
  ].filter(Boolean).join("\r\n");
}

Deno.serve(async (req) => {
  // Token check
  const url = new URL(req.url);
  if (url.searchParams.get("token") !== SECRET_TOKEN) {
    return new Response("Unauthorized", { status: 401 });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const events: string[] = [];

  // 1. Projects (due dates, not done)
  const { data: projects } = await sb
    .from("projects")
    .select("id,title,due_date,status")
    .not("due_date", "is", null)
    .neq("status", "done");
  for (const r of projects || []) {
    events.push(makeEvent(`proj-${r.id}`, toIcsDate(r.due_date), `📌 ${r.title}`, `Project Board · Status: ${r.status}`));
  }

  // 2. Collections (release dates)
  const { data: cols } = await sb
    .from("collections")
    .select("id,collection_name,release_date,ip_related")
    .not("release_date", "is", null);
  for (const r of cols || []) {
    events.push(makeEvent(`col-${r.id}`, toIcsDate(r.release_date), `🎨 ${r.collection_name}`, `Collection Release${r.ip_related ? " · " + r.ip_related : ""}`));
  }

  // 3. Collection items (deadlines)
  const { data: colItems } = await sb
    .from("collection_items")
    .select("id,sku_name,deadline,collection_id")
    .not("deadline", "is", null);
  for (const r of colItems || []) {
    events.push(makeEvent(`ci-${r.id}`, toIcsDate(r.deadline), `🧵 ${r.sku_name}`, "Collection Item Deadline"));
  }

  // 4. Leads (follow-up dates)
  const { data: leads } = await sb
    .from("leads")
    .select("id,lead_name,follow_up_date,stage")
    .not("follow_up_date", "is", null);
  for (const r of leads || []) {
    events.push(makeEvent(`ld-${r.id}`, toIcsDate(r.follow_up_date), `🎯 ${r.lead_name}`, `Leads Follow-up · Stage: ${r.stage}`));
  }

  // 5. Pop-up booths (event dates)
  const { data: booths } = await sb
    .from("popup_booths")
    .select("id,event_name,event_date,location,event_status")
    .not("event_date", "is", null);
  for (const r of booths || []) {
    const desc = [r.location, r.event_status ? `Status: ${r.event_status}` : ""].filter(Boolean).join(" · ");
    events.push(makeEvent(`pb-${r.id}`, toIcsDate(r.event_date), `🎪 ${r.event_name}`, desc));
  }

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Sentra Internal Tools//Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Sentra Calendar",
    "X-WR-CALDESC:Semua deadline & event penting dari Sentra Internal Tools",
    "X-WR-TIMEZONE:Asia/Jakarta",
    "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
    "X-PUBLISHED-TTL:PT12H",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="sentra-calendar.ics"',
      "Cache-Control": "no-cache",
    },
  });
});
