import React, { useEffect, useState } from 'react';
import { Modal, Platform, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import DateTimePicker from '@/components/ui/DateTimePicker';
import { useLocale } from '@/contexts/LocaleContext';
import { offlineText } from '@/lib/offlineTranslations';
import type { PendingSleepStop } from '@/lib/sleepOfflineActions';
import { decideSleepStop, editPendingSleepStop } from '@/lib/sleepOfflineRecovery';
export function SleepSyncConflictModal({ action, babyName, onClose }: { action: PendingSleepStop | null; babyName?: string; onClose: () => void }) {
  const { locale } = useLocale(); const [busy, setBusy] = useState(false); const [picker, setPicker] = useState(false); const [correctedAt, setCorrectedAt] = useState<Date | null>(null); const [error, setError] = useState(false);
  const [fields, setFields] = useState({ takeQuality:false, takeNotes:false });
  useEffect(() => { setPicker(false); setCorrectedAt(null); setError(false); setFields({ takeQuality: !!action?.current?.original && action.current.original.quality === action.baseEntry.entry.quality && action.proposedQuality !== action.current.original.quality, takeNotes: !!action?.current?.original && action.current.original.notes === action.baseEntry.entry.notes && action.proposedNotes !== action.current.original.notes }); }, [action?.operationId, action?.localRevision]);
  if (!action) return null;
  const t = (key: Parameters<typeof offlineText>[1]) => offlineText(locale, key);
  const format = (value: string) => new Date(value).toLocaleString(locale);
  const duration = (start: string, end: string) => `${Math.round((Date.parse(end)-Date.parse(start))/60000)} min`;
  const quality = (v: string | null) => v === 'good' ? t('qualityGood') : v === 'medium' ? t('qualityMedium') : v === 'bad' ? t('qualityBad') : '—';
  const original = action.baseEntry.entry; const shared = action.current?.original;
  const uncertain = !!action.frozen || ['checking','sending','confirmation_unknown'].includes(action.state);
  const take = async (choice: 'own' | 'shared' | 'later') => {
    setBusy(true); setError(false);
    try { if (await decideSleepStop(action, choice, fields)) onClose(); } catch { setError(true); } finally { setBusy(false); }
  };
  const button = (label: string, run: () => void, disabled = false) => <TouchableOpacity accessibilityRole="button" disabled={busy || disabled} onPress={run} style={{ padding: 12, opacity: busy || disabled ? 0.4 : 1 }}><Text style={{ color: '#704A36' }}>{label}</Text></TouchableOpacity>;
  return <Modal visible transparent onRequestClose={onClose} animationType="slide"><View style={{ flex: 1, justifyContent: 'center', backgroundColor: '#0008', padding: 20 }}>
    <View style={{ backgroundColor: '#FFF9F3', borderRadius: 20, padding: 18, maxHeight: '90%' }}>
      <ScrollView><Text style={{ color: '#44352C', fontSize: 20 }}>{t('conflict')} · {babyName ?? action.scope.babyId}</Text>
        <Text style={{ color: '#44352C', marginTop: 12 }}>{format(original.start_time)} · {original.notes ?? ''} · {quality(original.quality)}</Text>
        <Text style={{ color: '#44352C', marginTop: 12 }}>{t('own')}: {format(action.chosenStopAt)} · {duration(original.start_time, action.chosenStopAt)}</Text>
        {action.chosenStopAt !== action.originalStopAt && <Text>{t('own')} ({format(action.originalStopAt)})</Text>}
        <Text style={{ color: '#44352C' }}>{action.proposedNotes ?? ''} · {quality(action.proposedQuality)}</Text>
        <Text style={{ color: '#44352C', marginTop: 12 }}>{t('shared')}: {shared ? `${format(shared.start_time)} → ${shared.end_time ? `${format(shared.end_time)} · ${duration(shared.start_time, shared.end_time)}` : t('active')}` : t('unavailable')}</Text>
        {shared && <Text style={{ color: '#44352C' }}>{shared.notes ?? ''} · {quality(shared.quality)}</Text>}
        {action.current?.entries.filter(entry => entry.id !== original.id && (entry.end_time === null || Math.abs(Date.parse(entry.start_time)-Date.parse(original.start_time)) <= 86400000)).map(entry => <Text key={entry.id} style={{ color: '#44352C', marginTop: 6 }}>{entry.end_time ? t('shared') : t('newActive')}: {format(entry.start_time)} → {entry.end_time ? format(entry.end_time) : t('active')} · {entry.notes ?? ''} · {quality(entry.quality)}</Text>)}
        {action.outcome === 'structure' && <Text style={{ color: '#44352C' }}>{t('details')}</Text>}
        {uncertain && <Text style={{ color: '#44352C' }}>{t('unknown')}</Text>}
        {error && <Text style={{ color: '#8A3B2E' }}>{t('blocked')}</Text>}
        {shared && shared.quality !== action.proposedQuality && button(`${fields.takeQuality ? '✓ ' : ''}${t('takeQuality')}`, () => setFields(v => ({...v,takeQuality:!v.takeQuality})), uncertain)}
        {shared && shared.notes !== action.proposedNotes && button(`${fields.takeNotes ? '✓ ' : ''}${t('takeNotes')}`, () => setFields(v => ({...v,takeNotes:!v.takeNotes})), uncertain)}
        {button(t('takeOwn'), () => void take('own'), uncertain || !shared || !action.current?.canWrite || Date.parse(action.chosenStopAt)<Date.parse(shared.start_time) || !!shared && Date.parse(action.chosenStopAt)-Date.parse(shared.start_time)>86400000 || Date.parse(action.chosenStopAt)>Date.now()+300000)}
        {button(t('keepShared'), () => void take('shared'), uncertain || !action.current)}
        {button(t('later'), onClose)}
        {!uncertain && !['confirmed','discarded'].includes(action.state) && <>
          {button(t('askAlways'), () => void editPendingSleepStop(action, { reconcilePolicy: 'ask_always' }).then(onClose).catch(() => setError(true)))}
          {button(t('correct'), () => { setCorrectedAt(new Date(action.chosenStopAt)); setPicker(true); })}
          {button(t('discard'), () => void editPendingSleepStop(action, { discard: true }).then(onClose).catch(() => setError(true)))}
        </>}
        {picker && correctedAt && <DateTimePicker value={correctedAt} mode="datetime" display="spinner" onChange={(event, date) => {
          if (event.type !== 'set' || !date) { setPicker(false); setCorrectedAt(null); return; }
          setCorrectedAt(date);
          if (Platform.OS === 'android') setPicker(false);
        }} />}
        {correctedAt && <>
          <Text style={{ color: '#44352C' }}>{format(correctedAt.toISOString())}</Text>
          {button(t('applyCorrection'), () => {
            setBusy(true);
            void editPendingSleepStop(action, { chosenStopAt: correctedAt.toISOString(), reconcilePolicy: 'ask_always' })
              .then(() => { setPicker(false); setCorrectedAt(null); }).catch(() => setError(true)).finally(() => setBusy(false));
          }, uncertain || (Platform.OS === 'android' && picker))}
          {button(t('back'), () => { setPicker(false); setCorrectedAt(null); })}
        </>}
      </ScrollView>
    </View>
  </View></Modal>;
}
