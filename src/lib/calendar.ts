/**
 * Agenda externa: Google Agenda (link pronto), Apple/Outlook (.ics) e,
 * por consequência, TimeTree — que exibe os calendários do Google/iPhone
 * vinculados no próprio app.
 */
export type CalendarLecture = {
  id: string;
  title: string;
  scheduled_at: string | null;
  scheduled_time?: string | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  theme?: string | null;
  company?: string | null;
  notes?: string | null;
};

const DEFAULT_HOURS = 2;

function startOf(l: CalendarLecture): Date | null {
  if (!l.scheduled_at) return null;
  const d = new Date(l.scheduled_at);
  if (l.scheduled_time && /^\d{2}:\d{2}/.test(l.scheduled_time)) {
    const [h, m] = l.scheduled_time.split(":").map(Number);
    const local = new Date(d);
    local.setHours(h, m, 0, 0);
    return local;
  }
  return d;
}

const utcStamp = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
const location = (l: CalendarLecture) =>
  [l.address, [l.city, l.state].filter(Boolean).join(" / ")].filter(Boolean).join(" · ");
const details = (l: CalendarLecture, url?: string) =>
  [
    l.company && `Empresa: ${l.company}`,
    l.theme && `Tema: ${l.theme}`,
    l.notes,
    url && `GBS: ${url}`,
  ]
    .filter(Boolean)
    .join("\n");

/** Abre o Google Agenda já preenchido (não precisa de login no GBS nem de chave). */
export function googleCalendarUrl(l: CalendarLecture, appUrl?: string) {
  const start = startOf(l);
  if (!start) return null;
  const end = new Date(start.getTime() + DEFAULT_HOURS * 3_600_000);
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: `Palestra: ${l.title}`,
    dates: `${utcStamp(start)}/${utcStamp(end)}`,
    details: details(l, appUrl),
    location: location(l),
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

const esc = (v: string) =>
  v
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/[,;]/g, (c) => `\\${c}`);

/** Arquivo .ics com uma ou várias palestras (iPhone, Outlook, Google “importar”). */
export function buildICS(lectures: CalendarLecture[], appOrigin?: string) {
  const now = utcStamp(new Date());
  const events = lectures
    .map((l) => {
      const start = startOf(l);
      if (!start) return null;
      const end = new Date(start.getTime() + DEFAULT_HOURS * 3_600_000);
      const url = appOrigin ? `${appOrigin}/app/palestras/${l.id}` : undefined;
      return [
        "BEGIN:VEVENT",
        `UID:gbs-palestra-${l.id}@gbs`,
        `DTSTAMP:${now}`,
        `DTSTART:${utcStamp(start)}`,
        `DTEND:${utcStamp(end)}`,
        `SUMMARY:${esc(`Palestra: ${l.title}`)}`,
        location(l) && `LOCATION:${esc(location(l))}`,
        details(l) && `DESCRIPTION:${esc(details(l, url))}`,
        url && `URL:${url}`,
        "BEGIN:VALARM",
        "TRIGGER:-P1D",
        "ACTION:DISPLAY",
        "DESCRIPTION:Palestra amanhã",
        "END:VALARM",
        "END:VEVENT",
      ]
        .filter(Boolean)
        .join("\r\n");
    })
    .filter(Boolean);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//GBS//Agenda de Palestras//PT-BR",
    "CALSCALE:GREGORIAN",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadICS(lectures: CalendarLecture[], filename: string) {
  const blob = new Blob([buildICS(lectures, window.location.origin)], {
    type: "text/calendar;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
