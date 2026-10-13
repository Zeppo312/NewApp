import React from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { useLocale } from '@/contexts/LocaleContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTrackingSync } from '@/contexts/TrackingSyncContext';
import { acceptOwnTrackingChange, discardTrackingOperation, retryTrackingOperation } from '@/lib/trackingOutbox';

const copy = {
  de: { offline: 'Du bist gerade offline. Du kannst weiter starten und speichern. Deine Einträge werden bei Verbindung automatisch mit deinem Partner synchronisiert.',
    pending: 'Auf diesem Gerät gespeichert. Wird bei Verbindung automatisch mit deinem Partner synchronisiert.', conflict: 'Ein Eintrag wartet auf Klärung, weil sich der gemeinsame Stand geändert hat.',
    blocked: 'Ein Eintrag konnte noch nicht synchronisiert werden. Bitte prüfe Verbindung und Zugriff.', server: 'Lokal gespeichert. Für den Abgleich benötigt der Server noch das Offline-Update.',
    own: 'Eigene Änderung übernehmen', finished: 'Meinen abgeschlossenen Schlaf speichern', shared: 'Gemeinsamer Stand', ownLabel: 'Dein lokaler Eintrag',
    retry: 'Erneut abgleichen', inspect: 'Eintrag prüfen', discard: 'Lokalen Eintrag verwerfen', cancel: 'Zurück', storage: 'Die lokale Speicherung ist gerade nicht verfügbar. Deine Eingabe bleibt im Formular.' },
  en: { offline: 'You are offline. You can still start and save entries. They will sync with your partner when connected.',
    pending: 'Saved on this device. Will sync with your partner automatically when connected.', conflict: 'An entry needs review because the shared state changed.',
    blocked: 'An entry could not sync yet. Please check connection and access.', server: 'Saved locally. The server needs the offline update to sync.',
    own: 'Use my change', finished: 'Save my completed sleep', shared: 'Shared state', ownLabel: 'Your local entry',
    retry: 'Retry sync', inspect: 'Review entry', discard: 'Discard local entry', cancel: 'Back', storage: 'Local saving is unavailable. Your input stays in the form.' },
  es: { offline: 'Estás sin conexión. Puedes iniciar y guardar entradas. Se sincronizarán con tu pareja al volver la conexión.',
    pending: 'Guardado en este dispositivo. Se sincronizará automáticamente con tu pareja al volver la conexión.', conflict: 'Una entrada necesita revisión porque cambió el estado compartido.',
    blocked: 'Una entrada no pudo sincronizarse. Revisa la conexión y el acceso.', server: 'Guardado localmente. El servidor necesita la actualización sin conexión para sincronizar.',
    own: 'Usar mi cambio', finished: 'Guardar mi sueño terminado', shared: 'Estado compartido', ownLabel: 'Tu entrada local',
    retry: 'Reintentar sincronización', inspect: 'Revisar entrada', discard: 'Descartar entrada local', cancel: 'Volver', storage: 'El guardado local no está disponible. Tus datos siguen en el formulario.' },
};
export function TrackingSyncStatus({ babyId, offline = false }: { babyId?: string | null; offline?: boolean }) {
  const { locale } = useLocale(); const { user } = useAuth(); const sync = useTrackingSync();
  const t = copy[locale === 'en' ? 'en' : locale === 'es' ? 'es' : 'de'];
  const pending = sync.operations.filter(v => v.scope.babyId === babyId && v.state !== 'confirmed');
  const blocked = pending.find(v => v.state === 'blocked');
  const latest = blocked ? pending.filter(v=>v.kind===blocked.kind && v.entryId===blocked.entryId).at(-1) : undefined;
  const canTakeOwn = blocked?.action === 'update' && !!blocked.conflictRow?.updated_at || blocked?.reason==='active_sleep' && !!latest?.row?.end_time && latest.action!=='delete';
  const describe = (row: any) => row ? `${row.start_time ? new Date(row.start_time).toLocaleString(locale) : ''}${row.end_time ? ' – ' + new Date(row.end_time).toLocaleTimeString(locale) : ''}\n${row.notes ?? ''}` : '';
  if (!offline && pending.length === 0 && !sync.storageError) return null;
  const message = sync.storageError ? t.storage : blocked ? blocked.reason === 'conflict' || blocked.reason === 'active_sleep' ? t.conflict : t.blocked
    : pending.some(v => v.reason === 'server_upgrade_required') ? t.server : offline || pending.some(v => v.reason === 'connection') ? t.offline : t.pending;
  return <View accessibilityLiveRegion="polite" style={{ marginHorizontal: 16, marginBottom: 12, padding: 14, borderRadius: 16, backgroundColor: '#302A25', borderWidth: 1, borderColor: '#836747' }}>
    <Text style={{ color: '#F7EDE0', lineHeight: 21 }}>{message}{pending.length ? ` (${pending.length})` : ''}</Text>
    {blocked && <TouchableOpacity accessibilityRole="button" onPress={() => Alert.alert(t.inspect,
      `${t.ownLabel}\n${describe(latest?.row ?? blocked.row)}${blocked.conflictRow ? '\n\n'+t.shared+'\n'+describe(blocked.conflictRow) : ''}\n\n${message}`,
      [{ text: t.cancel, style: 'cancel' }, { text: canTakeOwn ? blocked.reason==='active_sleep' ? t.finished : t.own : t.retry, onPress: () => { if (user?.id) void (canTakeOwn ? acceptOwnTrackingChange(user.id,blocked.operationId,blocked.conflictRow?.updated_at) : retryTrackingOperation(user.id, blocked.operationId)).catch(() => {}); } },
        { text: t.discard, style: 'destructive', onPress: () => { if (user?.id) void discardTrackingOperation(user.id, blocked.operationId).then(sync.refresh).catch(() => {}); } }])}>
      <Text style={{ color: '#F7EDE0', fontWeight: '700', marginTop: 10 }}>{t.inspect}</Text>
    </TouchableOpacity>}
  </View>;
}
