import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import CustomActivityEntryModal from '@/components/CustomActivityEntryModal';
import ActivityCard from '@/components/ActivityCard';
import ActivityInputModal from '@/components/ActivityInputModal';
import SleepQuickAddModal from '@/components/SleepQuickAddModal';
import { SleepTimerFace } from '@/components/tracking/SleepTimerFace';
import { SleepCaptureButton } from '@/components/tracking/SleepCaptureButton';
import { DailyQuickAction } from '@/components/tracking/DailyQuickAction';
import { translateDailyText } from '@/lib/dailyTranslations';
import { translateSleepTrackerText } from '@/lib/sleepTrackerTranslations';
import { caretakerCopy } from '@/lib/caretaker-copy';
import type { DailyEntry } from '@/lib/baby';
import type { CaretakerActivity, CaretakerCommand, CaretakerEntry, CaretakerSnapshot } from '@/lib/caretaker-access';

const actions = [
  { command: 'bottle', subtype: 'feeding_bottle', emoji: '🍼', label: 'feeding.bottle' },
  { command: 'solids', subtype: 'feeding_solids', emoji: '🥄', label: 'feeding.solids' },
  { command: 'diaper_wet', subtype: 'diaper_wet', emoji: '💧', label: 'diaper.wet' },
  { command: 'diaper_dirty', subtype: 'diaper_dirty', emoji: '💩', label: 'diaper.dirty' },
  { command: 'diaper_both', subtype: 'diaper_both', emoji: '💧💩', label: 'diaper.both' },
] as const;
type Action = typeof actions[number];
const hiddenGuestSubTypes = ['feeding_breast', 'feeding_pump', 'feeding_water'];
const dayStart = (value: string | number) => { const d = new Date(value); d.setHours(0, 0, 0, 0); return d.getTime(); };
const asDailyEntry = (entry: CaretakerEntry, sleep: boolean): DailyEntry => ({
  ...entry, entry_type: sleep ? 'sleep' : entry.entry_type as DailyEntry['entry_type'], entry_date: entry.start_time.slice(0, 10),
  end_time: entry.end_time ?? undefined, notes: entry.notes ?? undefined,
  feeding_type: entry.feeding_type as DailyEntry['feeding_type'], diaper_type: entry.diaper_type as DailyEntry['diaper_type'],
  custom_quantity: entry.custom_quantity ? Number(entry.custom_quantity) : null,
});

/** Shared tracker presentation; every read and write remains in the guest gateway. */
export function CaretakerTrackingView({ snapshot, tab, locale, dark, foreground, busy, onWrite }: {
  snapshot: CaretakerSnapshot; tab: 'sleep' | 'daily'; locale: string; dark: boolean; foreground: string; busy: boolean;
  onWrite: (command: CaretakerCommand, payload?: Record<string, unknown>) => Promise<void>;
}) {
  const language = locale === 'en' ? 'en' : locale === 'es' ? 'es' : 'de';
  const t = caretakerCopy(language);
  const sleepText = (key: Parameters<typeof translateSleepTrackerText>[1]) => translateSleepTrackerText(language, key);
  const { width } = useWindowDimensions();
  const [clock, setClock] = useState(Date.now());
  const [day, setDay] = useState(() => dayStart(snapshot.server_now));
  const [input, setInput] = useState<{ action: Action; date: Date; entry?: CaretakerEntry } | null>(null);
  const [customInput, setCustomInput] = useState<{ definition: CaretakerActivity; date: Date; entry?: CaretakerEntry } | null>(null);
  const initialCustomData = useMemo(() => customInput?.entry ? asDailyEntry(customInput.entry, false) : undefined, [customInput]);
  const [sleepInput, setSleepInput] = useState<{ date: Date; entry?: CaretakerEntry } | null>(null);
  const initialDailyData = useMemo(() => input?.entry ? {
    id: input.entry.id, start_time: input.entry.start_time, end_time: input.entry.end_time,
    notes: input.entry.notes, feeding_type: input.entry.feeding_type as DailyEntry['feeding_type'],
    feeding_volume_ml: input.entry.feeding_volume_ml, diaper_type: input.entry.diaper_type as DailyEntry['diaper_type'],
  } : undefined, [input?.entry]);
  useEffect(() => { const tick = setInterval(() => setClock(Date.now()), 1000); return () => clearInterval(tick); }, []);
  const earliest = dayStart(snapshot.visible_from);
  const latest = dayStart(snapshot.server_now);
  const selected = Math.max(earliest, Math.min(day, latest));
  const moveDay = (offset: number) => { const d = new Date(selected); d.setDate(d.getDate() + offset); setDay(d.getTime()); };
  const running = snapshot.sleep.find(e => !e.end_time);
  const elapsed = running ? Math.max(0, Math.floor((clock - Date.parse(running.start_time)) / 1000)) : 0;
  const duration = [Math.floor(elapsed / 3600), Math.floor(elapsed / 60) % 60, elapsed % 60].map(v => String(v).padStart(2, '0')).join(':');
  const entries = snapshot[tab].filter(e => dayStart(e.start_time) === selected);
  const historicalDay = selected < dayStart(snapshot.starts_at);
  const canWrite = snapshot.allow_entries && !historicalDay;
  const openDate = () => new Date(selected === latest ? Date.parse(snapshot.server_now) : Math.max(selected, Date.parse(snapshot.starts_at)));
  const canModify = (entry: CaretakerEntry) => snapshot.allow_entries && entry.can_edit === true && !busy;
  const editEntry = (entry: CaretakerEntry) => {
    if (!canModify(entry)) return;
    if (tab === 'sleep') setSleepInput({ date: new Date(entry.start_time), entry });
    else if (entry.entry_type === 'custom') {
      if (!entry.custom_tracking_mode) return;
      setCustomInput({ date: new Date(entry.start_time), entry, definition: {
        id: entry.custom_activity_type_id ?? entry.id, name: entry.custom_name ?? '', emoji: entry.custom_emoji ?? '✨',
        color: entry.custom_color ?? '#9B7BB5', tracking_mode: entry.custom_tracking_mode,
        unit: entry.custom_unit ?? null, default_quantity: null,
      } });
    } else {
      const action = actions.find(a => a.command === (entry.entry_type === 'diaper'
        ? entry.diaper_type === 'WET' ? 'diaper_wet' : entry.diaper_type === 'DIRTY' ? 'diaper_dirty' : 'diaper_both'
        : entry.feeding_type === 'BOTTLE' ? 'bottle' : 'solids'))!;
      setInput({ action, date: new Date(entry.start_time), entry });
    }
  };
  const deleteEntry = (entry: CaretakerEntry) => {
    if (!canModify(entry)) return;
    Alert.alert(t.deleteTitle, t.deleteBody, [
      { text: t.cancel, style: 'cancel' },
      { text: t.deleteEntry, style: 'destructive', onPress: () => {
        void onWrite(tab === 'sleep' ? 'sleep_delete' : 'daily_delete', { entry_id: entry.id })
          .then(() => { setInput(null); setSleepInput(null); setCustomInput(null); }).catch(() => {});
      } },
    ]);
  };
  return <>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 4 }}>
      <TouchableOpacity accessibilityLabel={t.previousDay} disabled={selected <= earliest} onPress={() => moveDay(-1)} style={{ padding: 16, opacity: selected <= earliest ? .3 : 1 }}><Text style={{ color: foreground, fontSize: 30 }}>‹</Text></TouchableOpacity>
      <Text style={{ flex: 1, textAlign: 'center', color: foreground, fontSize: 16, fontWeight: '600' }}>{new Date(selected).toLocaleDateString(language, { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
      <TouchableOpacity accessibilityLabel={t.nextDay} disabled={selected >= latest} onPress={() => moveDay(1)} style={{ padding: 16, opacity: selected >= latest ? .3 : 1 }}><Text style={{ color: foreground, fontSize: 30 }}>›</Text></TouchableOpacity>
    </View>
    {tab === 'sleep' ? <>
      <View style={{ alignItems: 'center', paddingVertical: 12 }}>
        <SleepTimerFace size={width * .6} active={Boolean(running)} progress={running ? elapsed / (8 * 3600) * 100 : 0}
          textColor={foreground} timeLabel={running ? duration : new Date(clock).toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' })}>
          <Text style={{ color: foreground, fontWeight: '600' }}>{running ? t.running : sleepText('prediction.ready')}</Text>
        </SleepTimerFace>
      </View>
      {canWrite && <>
        <Text style={{ color: foreground, fontSize: 18, fontWeight: '600' }}>{sleepText('day.capture')}</Text>
        {running && Date.parse(running.start_time) < Date.parse(snapshot.starts_at) ? <Text style={{ color: foreground }}>{t.existingSleep}</Text> :
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <SleepCaptureButton kind={running ? 'stop' : 'start'} title={running ? t.stopSleep : t.startSleep}
              hint={sleepText(running ? 'timer.stop' : 'timer.startHint')} textColor={foreground} disabled={busy} style={{ flex: 1 }}
              onPress={() => void onWrite(running ? 'sleep_stop' : 'sleep_start', { entry_id: running?.id }).catch(() => {})} />
            {!running && <SleepCaptureButton kind="manual" title={sleepText('timer.manual')} hint={sleepText('timer.add')}
              textColor={foreground} disabled={busy} style={{ flex: 1 }} onPress={() => setSleepInput({ date: openDate() })} />}
          </View>}
      </>}
    </> : canWrite && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 12 }}>
      {actions.map(action => <DailyQuickAction key={action.command} emoji={action.emoji} label={translateDailyText(language, action.label)}
        textColor={foreground} disabled={busy} dimmed={busy} onPress={() => setInput({ action, date: openDate() })} />)}
      {(snapshot.custom_activities ?? []).map(definition => <DailyQuickAction key={definition.id} emoji={definition.emoji} label={definition.name}
        textColor={foreground} disabled={busy} dimmed={busy} onPress={() => setCustomInput({ definition, date: openDate() })} />)}
    </ScrollView>}
    {historicalDay && <Text style={{ color: foreground }}>{t.readOnly}</Text>}
    <Text style={{ color: foreground, fontSize: 18, fontWeight: '600', marginTop: 10 }}>{tab === 'sleep' ? sleepText('day.timeline') : t.daily}</Text>
    {!entries.length && <Text style={{ color: foreground }}>{t.empty}</Text>}
    {entries.map(entry => <ActivityCard key={entry.id} entry={asDailyEntry(entry, tab === 'sleep')} readOnly={!canModify(entry)} appearance={dark ? 'dark' : 'light'} marginHorizontal={0}
      onEdit={canModify(entry) ? () => editEntry(entry) : undefined} onDelete={() => deleteEntry(entry)} />)}
    {input && canWrite && <ActivityInputModal visible restricted saving={busy} activityType={input.action.command.startsWith('diaper') ? 'diaper' : 'feeding'}
      initialSubType={input.action.subtype} hiddenSubTypes={hiddenGuestSubTypes} date={input.date} forceDarkMode={dark}
      initialData={initialDailyData}
      onDelete={input.entry ? () => deleteEntry(input.entry!) : undefined}
      onClose={() => { if (!busy) setInput(null); }} onSave={async data => {
        const command: CaretakerCommand = data.entry_type === 'diaper'
          ? data.diaper_type === 'WET' ? 'diaper_wet' : data.diaper_type === 'DIRTY' ? 'diaper_dirty' : 'diaper_both'
          : data.feeding_type === 'BOTTLE' ? 'bottle' : 'solids';
        await onWrite(input.entry ? 'daily_update' : command, { entry_id: input.entry?.id, entry_type: data.entry_type, feeding_type: data.feeding_type, diaper_type: data.diaper_type, start_time: data.start_time, end_time: data.end_time, volume_ml: data.feeding_volume_ml, notes: data.notes });
        setInput(null);
      }} />}
    {customInput && canWrite && <CustomActivityEntryModal visible useExactDate startTimerByDefault definition={customInput.definition} date={customInput.date}
      initialData={initialCustomData} onClose={() => { if (!busy) setCustomInput(null); }}
      onDelete={customInput.entry ? () => deleteEntry(customInput.entry!) : undefined}
      onSave={async payload => {
        try {
          await onWrite(customInput.entry ? 'custom_update' : 'custom', { ...payload,
            custom_activity_type_id: customInput.definition.id, entry_id: customInput.entry?.id });
          return true;
        } catch { return false; }
      }} />}
    {sleepInput && canWrite && <SleepQuickAddModal visible initialStart={sleepInput.date} saving={busy}
      initialEntry={sleepInput.entry ? { start: new Date(sleepInput.entry.start_time), end: sleepInput.entry.end_time ? new Date(sleepInput.entry.end_time) : null, quality: sleepInput.entry.quality ?? null, notes: sleepInput.entry.notes ?? '' } : undefined}
      onDelete={sleepInput.entry ? () => deleteEntry(sleepInput.entry!) : undefined} onClose={() => { if (!busy) setSleepInput(null); }}
      onSave={entry => { void onWrite(sleepInput.entry ? 'sleep_update' : 'sleep_add', { entry_id: sleepInput.entry?.id, start_time: entry.start.toISOString(), end_time: entry.end?.toISOString(), quality: entry.quality, notes: entry.notes })
        .then(() => setSleepInput(null)).catch(() => {}); }} />}
  </>;
}
