import type { AskLottiLocale } from "./guardrails.ts";
import type { AskLottiPlan } from "./planner.ts";

export type Evidence = { id: string; title: string; detail: string };

export type SleepRow = {
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
};
export type CareRow = {
  entry_type: string;
  start_time: string;
  end_time: string | null;
  feeding_type: string | null;
  feeding_volume_ml: number | null;
  diaper_type: string | null;
};
export type PlannerRow = {
  start_at: string | null;
  end_at: string | null;
  due_at: string | null;
  entry_type: string | null;
};
export type GrowthRow = { date: string; value: number };
export type MilestoneRow = {
  is_completed: boolean | null;
  completion_date: string | null;
  title: string | null;
  position: number | null;
};

export type FamilyRows = {
  profile: { birth_date: string | null };
  sleep: SleepRow[];
  care: CareRow[];
  planner: PlannerRow[];
  weights: GrowthRow[];
  sizes: GrowthRow[];
  milestones: MilestoneRow[];
};

const tags: Record<AskLottiLocale, string> = {
  de: "de-DE",
  en: "en-US",
  es: "es-ES",
};
const DAY_MS = 86_400_000;

const copy = (locale: AskLottiLocale) => ({
  sleepAverageDay:
    locale === "de"
      ? "Ø Schlaf pro dokumentiertem Tag"
      : locale === "es"
        ? "Sueño medio por día registrado"
        : "Average sleep per documented day",
  sleepAverageSession:
    locale === "de"
      ? "Ø Dauer je Schlafphase"
      : locale === "es"
        ? "Duración media por fase"
        : "Average duration per sleep session",
  sleepTotal:
    locale === "de"
      ? "Schlaf gesamt"
      : locale === "es"
        ? "Sueño total"
        : "Total sleep",
  sleepLongest:
    locale === "de"
      ? "Längste Schlafphase"
      : locale === "es"
        ? "Fase de sueño más larga"
        : "Longest sleep session",
  sleepDistribution:
    locale === "de"
      ? "Nacht- und Tagschlaf"
      : locale === "es"
        ? "Sueño nocturno y diurno"
        : "Night and daytime sleep",
  wakeups:
    locale === "de"
      ? "Nächtliche Unterbrechungen"
      : locale === "es"
        ? "Interrupciones nocturnas"
        : "Nightly interruptions",
  feedingAverageDay:
    locale === "de"
      ? "Ø Fütterungen pro dokumentiertem Tag"
      : locale === "es"
        ? "Tomas medias por día registrado"
        : "Average feeds per documented day",
  feedingAverageVolume:
    locale === "de"
      ? "Ø erfasste Menge pro dokumentiertem Tag"
      : locale === "es"
        ? "Cantidad media registrada por día"
        : "Average recorded volume per documented day",
  feedingAverageFeed:
    locale === "de"
      ? "Ø Menge je Fütterung mit Mengenangabe"
      : locale === "es"
        ? "Cantidad media por toma con volumen"
        : "Average volume per feed with an amount",
  feedingTotal:
    locale === "de"
      ? "Fütterungen gesamt"
      : locale === "es"
        ? "Tomas totales"
        : "Total feeds",
  diapersAverage:
    locale === "de"
      ? "Ø Windeln pro dokumentiertem Tag"
      : locale === "es"
        ? "Pañales medios por día registrado"
        : "Average diapers per documented day",
  diapersTotal:
    locale === "de"
      ? "Windeln gesamt"
      : locale === "es"
        ? "Pañales totales"
        : "Total diapers",
  diaperTypes:
    locale === "de"
      ? "Nach Windeltyp"
      : locale === "es"
        ? "Por tipo de pañal"
        : "By diaper type",
  coverage:
    locale === "de" ? "Abdeckung" : locale === "es" ? "Cobertura" : "Coverage",
  comparison:
    locale === "de"
      ? "Vorheriger Zeitraum"
      : locale === "es"
        ? "Periodo anterior"
        : "Previous period",
  profileAge:
    locale === "de"
      ? "Alter laut Babyprofil"
      : locale === "es"
        ? "Edad según el perfil"
        : "Age from baby profile",
  nextMonth:
    locale === "de"
      ? "Nächster Monatsgeburtstag"
      : locale === "es"
        ? "Próximo cumplemés"
        : "Next monthly birthday",
  latestWeight:
    locale === "de"
      ? "Letztes erfasstes Gewicht"
      : locale === "es"
        ? "Último peso registrado"
        : "Latest recorded weight",
  latestSize:
    locale === "de"
      ? "Letzte erfasste Größe"
      : locale === "es"
        ? "Última altura registrada"
        : "Latest recorded height",
  latestMilestone:
    locale === "de"
      ? "Zuletzt erreichter Meilenstein"
      : locale === "es"
        ? "Último hito alcanzado"
        : "Latest completed milestone",
  nextMilestone:
    locale === "de"
      ? "Nächster offener Meilenstein"
      : locale === "es"
        ? "Siguiente hito abierto"
        : "Next open milestone",
  appointment:
    locale === "de"
      ? "Geplanter Zeitpunkt"
      : locale === "es"
        ? "Hora prevista"
        : "Planned time",
  sessions:
    locale === "de"
      ? "Schlafphasen"
      : locale === "es"
        ? "fases de sueño"
        : "sleep sessions",
  feeds: locale === "de" ? "Fütterungen" : locale === "es" ? "tomas" : "feeds",
  diapers:
    locale === "de" ? "Windeln" : locale === "es" ? "pañales" : "diapers",
  wet: locale === "de" ? "nass" : locale === "es" ? "mojados" : "wet",
  dirty: locale === "de" ? "Stuhlgang" : locale === "es" ? "sucios" : "dirty",
  both: locale === "de" ? "beides" : locale === "es" ? "ambos" : "both",
});

const durationMinutes = (row: SleepRow) => {
  if (typeof row.duration_minutes === "number" && row.duration_minutes >= 0)
    return row.duration_minutes;
  if (!row.end_time) return 0;
  return Math.max(
    0,
    Math.round(
      (Date.parse(row.end_time) - Date.parse(row.start_time)) / 60_000,
    ),
  );
};

const localDateKey = (iso: string, timezoneOffsetMinutes: number) =>
  new Date(Date.parse(iso) - timezoneOffsetMinutes * 60_000)
    .toISOString()
    .slice(0, 10);

const localHour = (iso: string, timezoneOffsetMinutes: number) =>
  new Date(Date.parse(iso) - timezoneOffsetMinutes * 60_000).getUTCHours();

const within = (iso: string, start: number, end: number) => {
  const time = Date.parse(iso);
  return Number.isFinite(time) && time >= start && time < end;
};

const sum = (values: number[]) =>
  values.reduce((total, value) => total + value, 0);
const roundOne = (value: number) => Math.round(value * 10) / 10;
const decimal = (value: number, locale: AskLottiLocale) =>
  new Intl.NumberFormat(tags[locale], {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(roundOne(value));
const hours = (minutes: number, locale: AskLottiLocale) =>
  `${decimal(minutes / 60, locale)} ${locale === "de" ? "Std." : "h"}`;
const date = (value: string | Date, locale: AskLottiLocale) =>
  new Date(value).toLocaleDateString(tags[locale], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
const time = (
  iso: string | null,
  locale: AskLottiLocale,
  timezoneOffsetMinutes: number,
) =>
  iso
    ? new Date(
        Date.parse(iso) - timezoneOffsetMinutes * 60_000,
      ).toLocaleTimeString(tags[locale], {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      })
    : "–";

const coverageDetail = (
  documentedDays: number,
  timeframeDays: number,
  locale: AskLottiLocale,
) =>
  locale === "de"
    ? `An ${documentedDays} von ${timeframeDays} Tagen dokumentiert · Durchschnitte beziehen sich auf dokumentierte Tage`
    : locale === "es"
      ? `Registrado en ${documentedDays} de ${timeframeDays} días · Las medias usan solo días registrados`
      : `Recorded on ${documentedDays} of ${timeframeDays} days · Averages use documented days only`;

const periodBounds = (now: number, days: number, previous = false) => ({
  start: now - days * (previous ? 2 : 1) * DAY_MS,
  end: previous ? now - days * DAY_MS : now,
});

const selectPeriod = <T>(
  rows: T[],
  getIso: (row: T) => string,
  bounds: { start: number; end: number },
) => rows.filter((row) => within(getIso(row), bounds.start, bounds.end));

const sleepEvidence = (
  rows: SleepRow[],
  plan: AskLottiPlan,
  now: number,
  locale: AskLottiLocale,
  timezoneOffsetMinutes: number,
): Evidence[] => {
  const text = copy(locale);
  const selected = selectPeriod(
    rows,
    (row) => row.start_time,
    periodBounds(now, plan.timeframe_days),
  );
  if (selected.length === 0) return [];
  const documentedDays = new Set(
    selected.map((row) => localDateKey(row.start_time, timezoneOffsetMinutes)),
  ).size;
  const minutes = selected.map(durationMinutes);
  const total = sum(minutes);
  const result: Evidence[] = [];

  if (plan.metric === "average_per_day") {
    result.push(
      {
        id: "sleep_average_day",
        title: text.sleepAverageDay,
        detail: `${hours(total / documentedDays, locale)} · ${documentedDays} ${locale === "de" ? "dokumentierte Tage" : locale === "es" ? "días registrados" : "documented days"}`,
      },
      {
        id: "sleep_average_session",
        title: text.sleepAverageSession,
        detail: `${hours(total / selected.length, locale)} · ${selected.length} ${text.sessions}`,
      },
    );
  } else if (plan.metric === "longest") {
    const longest = [...selected].sort(
      (a, b) => durationMinutes(b) - durationMinutes(a),
    )[0];
    result.push({
      id: "sleep_longest",
      title: text.sleepLongest,
      detail: `${hours(durationMinutes(longest), locale)} · ${time(longest.start_time, locale, timezoneOffsetMinutes)}–${time(longest.end_time, locale, timezoneOffsetMinutes)}`,
    });
  } else if (plan.metric === "distribution") {
    const night = selected.filter((row) => {
      const hour = localHour(row.start_time, timezoneOffsetMinutes);
      return hour >= 19 || hour < 7;
    });
    const nightMinutes = sum(night.map(durationMinutes));
    const dayMinutes = total - nightMinutes;
    const nightGroups = new Map<string, number>();
    for (const row of night) {
      const shifted = new Date(
        Date.parse(row.start_time) - timezoneOffsetMinutes * 60_000,
      );
      if (shifted.getUTCHours() < 12)
        shifted.setUTCDate(shifted.getUTCDate() - 1);
      const key = shifted.toISOString().slice(0, 10);
      nightGroups.set(key, (nightGroups.get(key) ?? 0) + 1);
    }
    const interruptions = [...nightGroups.values()].map((count) =>
      Math.max(0, count - 1),
    );
    result.push(
      {
        id: "sleep_distribution",
        title: text.sleepDistribution,
        detail: `${hours(nightMinutes, locale)} ${locale === "de" ? "nachts" : locale === "es" ? "por la noche" : "at night"} · ${hours(dayMinutes, locale)} ${locale === "de" ? "tagsüber" : locale === "es" ? "durante el día" : "during the day"}`,
      },
      {
        id: "sleep_interruptions",
        title: text.wakeups,
        detail: `${decimal(interruptions.length ? sum(interruptions) / interruptions.length : 0, locale)} ${locale === "de" ? "Ø pro dokumentierter Nacht" : locale === "es" ? "de media por noche registrada" : "average per documented night"}`,
      },
    );
  } else {
    result.push({
      id: "sleep_total",
      title: text.sleepTotal,
      detail: `${hours(total, locale)} · ${selected.length} ${text.sessions}`,
    });
  }

  if (plan.compare_previous) {
    const previous = selectPeriod(
      rows,
      (row) => row.start_time,
      periodBounds(now, plan.timeframe_days, true),
    );
    const previousDays = new Set(
      previous.map((row) =>
        localDateKey(row.start_time, timezoneOffsetMinutes),
      ),
    ).size;
    const previousTotal = sum(previous.map(durationMinutes));
    result.push({
      id: "sleep_previous",
      title: text.comparison,
      detail:
        plan.metric === "average_per_day" && previousDays > 0
          ? `${hours(previousTotal / previousDays, locale)} ${locale === "de" ? "Ø pro dokumentiertem Tag" : locale === "es" ? "de media por día registrado" : "average per documented day"}`
          : `${hours(previousTotal, locale)} · ${previous.length} ${text.sessions}`,
    });
  }
  result.push({
    id: "sleep_coverage",
    title: text.coverage,
    detail: coverageDetail(documentedDays, plan.timeframe_days, locale),
  });
  return result;
};

const feedingEvidence = (
  rows: CareRow[],
  plan: AskLottiPlan,
  now: number,
  locale: AskLottiLocale,
  timezoneOffsetMinutes: number,
): Evidence[] => {
  const text = copy(locale);
  const selected = selectPeriod(
    rows.filter((row) => row.entry_type === "feeding"),
    (row) => row.start_time,
    periodBounds(now, plan.timeframe_days),
  );
  if (selected.length === 0) return [];
  const documentedDays = new Set(
    selected.map((row) => localDateKey(row.start_time, timezoneOffsetMinutes)),
  ).size;
  const withVolume = selected.filter(
    (row) =>
      typeof row.feeding_volume_ml === "number" &&
      Number(row.feeding_volume_ml) >= 0,
  );
  const volume = sum(withVolume.map((row) => Number(row.feeding_volume_ml)));
  const result: Evidence[] =
    plan.metric === "average_per_day"
      ? [
          {
            id: "feeding_average_day",
            title: text.feedingAverageDay,
            detail: `${decimal(selected.length / documentedDays, locale)} ${text.feeds}`,
          },
          {
            id: "feeding_average_volume_day",
            title: text.feedingAverageVolume,
            detail: `${Math.round(volume / documentedDays)} ml`,
          },
          {
            id: "feeding_average_feed",
            title: text.feedingAverageFeed,
            detail:
              withVolume.length > 0
                ? `${Math.round(volume / withVolume.length)} ml · ${withVolume.length} ${locale === "de" ? "Einträge mit Menge" : locale === "es" ? "registros con cantidad" : "entries with an amount"}`
                : locale === "de"
                  ? "Keine Mengenangaben"
                  : locale === "es"
                    ? "Sin cantidades registradas"
                    : "No recorded amounts",
          },
        ]
      : [
          {
            id: "feeding_total",
            title: text.feedingTotal,
            detail: `${selected.length} ${text.feeds} · ${volume} ml ${locale === "de" ? "erfasst" : locale === "es" ? "registrados" : "recorded"}`,
          },
        ];
  if (plan.compare_previous) {
    const previous = selectPeriod(
      rows.filter((row) => row.entry_type === "feeding"),
      (row) => row.start_time,
      periodBounds(now, plan.timeframe_days, true),
    );
    const previousVolume = sum(
      previous.map((row) => Number(row.feeding_volume_ml ?? 0)),
    );
    result.push({
      id: "feeding_previous",
      title: text.comparison,
      detail: `${previous.length} ${text.feeds} · ${previousVolume} ml`,
    });
  }
  result.push({
    id: "feeding_coverage",
    title: text.coverage,
    detail: coverageDetail(documentedDays, plan.timeframe_days, locale),
  });
  return result;
};

const diaperEvidence = (
  rows: CareRow[],
  plan: AskLottiPlan,
  now: number,
  locale: AskLottiLocale,
  timezoneOffsetMinutes: number,
): Evidence[] => {
  const text = copy(locale);
  const selected = selectPeriod(
    rows.filter((row) => row.entry_type === "diaper"),
    (row) => row.start_time,
    periodBounds(now, plan.timeframe_days),
  );
  if (selected.length === 0) return [];
  const documentedDays = new Set(
    selected.map((row) => localDateKey(row.start_time, timezoneOffsetMinutes)),
  ).size;
  const typeCount = (type: string) =>
    selected.filter((row) => row.diaper_type?.toUpperCase() === type).length;
  const result: Evidence[] = [
    plan.metric === "average_per_day"
      ? {
          id: "diaper_average_day",
          title: text.diapersAverage,
          detail: `${decimal(selected.length / documentedDays, locale)} ${text.diapers}`,
        }
      : {
          id: "diaper_total",
          title: text.diapersTotal,
          detail: `${selected.length} ${text.diapers}`,
        },
    {
      id: "diaper_types",
      title: text.diaperTypes,
      detail: `${typeCount("WET")} ${text.wet} · ${typeCount("DIRTY")} ${text.dirty} · ${typeCount("BOTH")} ${text.both}`,
    },
  ];
  result.push({
    id: "diaper_coverage",
    title: text.coverage,
    detail: coverageDetail(documentedDays, plan.timeframe_days, locale),
  });
  return result;
};

const profileEvidence = (
  birthDate: string | null,
  now: Date,
  locale: AskLottiLocale,
): Evidence[] => {
  if (!birthDate) return [];
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime()) || birth > now) return [];
  let months =
    (now.getUTCFullYear() - birth.getUTCFullYear()) * 12 +
    now.getUTCMonth() -
    birth.getUTCMonth();
  if (now.getUTCDate() < birth.getUTCDate()) months -= 1;
  const weeks = Math.floor((now.getTime() - birth.getTime()) / (7 * DAY_MS));
  const targetMonth = months + 1;
  const year =
    birth.getUTCFullYear() +
    Math.floor((birth.getUTCMonth() + targetMonth) / 12);
  const month = (birth.getUTCMonth() + targetMonth) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const nextMonthly = new Date(
    Date.UTC(year, month, Math.min(birth.getUTCDate(), lastDay)),
  );
  const text = copy(locale);
  return [
    {
      id: "profile_age",
      title: text.profileAge,
      detail:
        locale === "de"
          ? `${months} Monate · ${weeks} Wochen`
          : locale === "es"
            ? `${months} meses · ${weeks} semanas`
            : `${months} months · ${weeks} weeks`,
    },
    {
      id: "profile_next_month",
      title: text.nextMonth,
      detail:
        locale === "de"
          ? `${targetMonth} Monate am ${date(nextMonthly, locale)}`
          : locale === "es"
            ? `${targetMonth} meses el ${date(nextMonthly, locale)}`
            : `${targetMonth} months on ${date(nextMonthly, locale)}`,
    },
  ];
};

const growthEvidence = (
  weights: GrowthRow[],
  sizes: GrowthRow[],
  locale: AskLottiLocale,
): Evidence[] => {
  const text = copy(locale);
  const latest = (rows: GrowthRow[]) =>
    [...rows]
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
      .slice(0, 2);
  const result: Evidence[] = [];
  const weight = latest(weights);
  if (weight[0]) {
    const delta = weight[1]
      ? Number(weight[0].value) - Number(weight[1].value)
      : null;
    result.push({
      id: "growth_weight",
      title: text.latestWeight,
      detail: `${decimal(Number(weight[0].value), locale)} kg · ${date(weight[0].date, locale)}${delta === null ? "" : ` · ${delta >= 0 ? "+" : ""}${decimal(delta, locale)} kg`}`,
    });
  }
  const size = latest(sizes);
  if (size[0]) {
    const delta = size[1]
      ? Number(size[0].value) - Number(size[1].value)
      : null;
    result.push({
      id: "growth_size",
      title: text.latestSize,
      detail: `${decimal(Number(size[0].value), locale)} cm · ${date(size[0].date, locale)}${delta === null ? "" : ` · ${delta >= 0 ? "+" : ""}${decimal(delta, locale)} cm`}`,
    });
  }
  return result;
};

const milestoneEvidence = (
  rows: MilestoneRow[],
  locale: AskLottiLocale,
): Evidence[] => {
  const text = copy(locale);
  const completed = rows
    .filter((row) => row.is_completed && row.completion_date)
    .sort(
      (a, b) => Date.parse(b.completion_date!) - Date.parse(a.completion_date!),
    )[0];
  const open = rows
    .filter((row) => !row.is_completed)
    .sort((a, b) => Number(a.position ?? 999) - Number(b.position ?? 999))[0];
  return [
    ...(completed?.title
      ? [
          {
            id: "milestone_latest",
            title: text.latestMilestone,
            detail: `${completed.title} · ${date(completed.completion_date!, locale)}`,
          },
        ]
      : []),
    ...(open?.title
      ? [
          {
            id: "milestone_next",
            title: text.nextMilestone,
            detail: open.title,
          },
        ]
      : []),
  ];
};

const plannerEvidence = (
  rows: PlannerRow[],
  locale: AskLottiLocale,
  timezoneOffsetMinutes: number,
): Evidence[] => {
  const text = copy(locale);
  return rows.slice(0, 5).flatMap((row, index) => {
    const value = row.start_at ?? row.due_at;
    if (!value) return [];
    return [
      {
        id: `planner_${index + 1}`,
        title: `${text.appointment} ${index + 1}`,
        detail: `${time(value, locale, timezoneOffsetMinutes)}${row.end_at ? `–${time(row.end_at, locale, timezoneOffsetMinutes)}` : ""}`,
      },
    ];
  });
};

export const computeMetrics = (
  plan: AskLottiPlan,
  rows: FamilyRows,
  nowIso: string,
  timezoneOffsetMinutes = 0,
): Evidence[] => {
  const now = new Date(nowIso);
  const nowMs = now.getTime();
  const locale = plan.answer_language;
  const evidence: Evidence[] = [];
  for (const domain of plan.domains) {
    if (domain === "sleep")
      evidence.push(
        ...sleepEvidence(
          rows.sleep,
          plan,
          nowMs,
          locale,
          timezoneOffsetMinutes,
        ),
      );
    if (domain === "feeding")
      evidence.push(
        ...feedingEvidence(
          rows.care,
          plan,
          nowMs,
          locale,
          timezoneOffsetMinutes,
        ),
      );
    if (domain === "diaper")
      evidence.push(
        ...diaperEvidence(
          rows.care,
          plan,
          nowMs,
          locale,
          timezoneOffsetMinutes,
        ),
      );
    if (domain === "profile")
      evidence.push(...profileEvidence(rows.profile.birth_date, now, locale));
    if (domain === "growth")
      evidence.push(...growthEvidence(rows.weights, rows.sizes, locale));
    if (domain === "milestones")
      evidence.push(...milestoneEvidence(rows.milestones, locale));
    if (domain === "planner")
      evidence.push(
        ...plannerEvidence(rows.planner, locale, timezoneOffsetMinutes),
      );
  }
  return evidence;
};
