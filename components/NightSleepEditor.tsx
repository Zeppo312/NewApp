import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { RADIUS } from '@/constants/DesignGuide';
import type { NightGroup, ClassifiedSleepEntry } from '@/app/(tabs)/sleep-tracker';

// ─── Constants ──────────────────────────────────────────────
const NIGHT_WINDOW_MINUTES = 990;
const NIGHT_WINDOW_START_HOUR = 17;
const NIGHT_WINDOW_START_MINUTES = 30;

const ACCENT_LIGHT = '#8E4EC6';
const ACCENT_DARK = '#A26BFF';
// Wachphasen: warmes Terrakotta passend zur App-Palette
const WAKE_COLOR_LIGHT = '#B07252';   // Terrakotta, harmoniert mit #C89F81 & #5C4033
const WAKE_COLOR_DARK  = '#D4956A';   // Etwas heller für Dark Mode
const WAKE_BG_LIGHT = 'rgba(200, 159, 129, 0.12)';
const WAKE_BG_DARK  = 'rgba(200, 159, 129, 0.10)';

// ─── Types ──────────────────────────────────────────────────
type NightSleepEditorProps = {
  visible: boolean;
  nightGroup: NightGroup;
  onClose: () => void;
  onSplit: (params: {
    targetEntry: ClassifiedSleepEntry;
    splitTime: Date;
    wakeMinutes: number;
  }) => Promise<boolean>;
  onMerge: (entryA: ClassifiedSleepEntry, entryB: ClassifiedSleepEntry) => Promise<boolean>;
  onAdjustBoundary: (
    entry: ClassifiedSleepEntry,
    field: 'start_time' | 'end_time',
    newTime: Date
  ) => Promise<void>;
  onDeleteNightGroup: (entryIds: string[]) => Promise<boolean>;
  isSaving: boolean;
};

// ─── Helpers ────────────────────────────────────────────────
const formatClockTime = (date: Date) =>
  date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

const minutesToHMM = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h <= 0) return `${m} Min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
};

const formatWakeDuration = (seconds: number) => {
  if (seconds < 60) return `${seconds} Sek`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes} Min ${remainingSeconds} Sek` : `${minutes} Min`;
  }

  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (remainingSeconds > 0) {
    return m > 0
      ? `${h}h ${m.toString().padStart(2, '0')}m ${remainingSeconds} Sek`
      : `${h}h ${remainingSeconds} Sek`;
  }
  return m > 0 ? `${h}h ${m.toString().padStart(2, '0')}m` : `${h}h`;
};

const formatShortDayDate = (date: Date) =>
  date.toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });

const getNightAnchor = (group: NightGroup): Date => {
  const start = group.start;
  const anchor = new Date(start);
  const startTotalMin = start.getHours() * 60 + start.getMinutes();
  const anchorTotalMin = NIGHT_WINDOW_START_HOUR * 60 + NIGHT_WINDOW_START_MINUTES;
  if (startTotalMin < anchorTotalMin) {
    anchor.setDate(anchor.getDate() - 1);
  }
  anchor.setHours(NIGHT_WINDOW_START_HOUR, NIGHT_WINDOW_START_MINUTES, 0, 0);
  return anchor;
};

const minutesFromAnchor = (date: Date, anchor: Date): number =>
  Math.max(0, (date.getTime() - anchor.getTime()) / 60000);

const hapticLight = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
const withReferenceDate = (pickedTime: Date, referenceDate: Date): Date => {
  const normalized = new Date(referenceDate);
  normalized.setHours(pickedTime.getHours(), pickedTime.getMinutes(), 0, 0);
  return normalized;
};

const resolvePickerTimeNearReference = (
  pickedTime: Date,
  referenceDate: Date,
  options?: {
    minExclusive?: Date;
    maxExclusive?: Date;
  }
): Date | null => {
  const candidates = [-1, 0, 1].map((dayOffset) => {
    const candidate = withReferenceDate(pickedTime, referenceDate);
    candidate.setDate(candidate.getDate() + dayOffset);
    return candidate;
  });

  const minMs = options?.minExclusive?.getTime();
  const maxMs = options?.maxExclusive?.getTime();
  const referenceMs = referenceDate.getTime();

  const validCandidates = candidates.filter((candidate) => {
    const ts = candidate.getTime();
    if (typeof minMs === 'number' && ts <= minMs) return false;
    if (typeof maxMs === 'number' && ts >= maxMs) return false;
    return true;
  });

  if (validCandidates.length === 0) return null;

  validCandidates.sort((a, b) => {
    const distA = Math.abs(a.getTime() - referenceMs);
    const distB = Math.abs(b.getTime() - referenceMs);
    return distA - distB;
  });

  return validCandidates[0];
};

const ONE_MINUTE_MS = 60 * 1000;
const ONE_DAY_MINUTES = 24 * 60;
const ANOMALOUS_MULTI_DAY_MINUTES = ONE_DAY_MINUTES;
const PLAUSIBLE_NIGHT_TARGET_MINUTES = 10 * 60;
const minutesBucket = (date: Date) => Math.floor(date.getTime() / ONE_MINUTE_MS);

const getWakeMinutesWithMidnightWrap = (start: Date, end: Date): number => {
  const rawMinutes = Math.round((end.getTime() - start.getTime()) / ONE_MINUTE_MS);
  if (rawMinutes > 0) return rawMinutes;

  // Allow midnight wrap (e.g. 23:50 -> 00:00).
  const startMinutesOfDay = start.getHours() * 60 + start.getMinutes();
  const endMinutesOfDay = end.getHours() * 60 + end.getMinutes();
  return (endMinutesOfDay - startMinutesOfDay + 24 * 60) % (24 * 60);
};

const inferLikelyNightEndFromClock = (nightStart: Date, currentEnd: Date): Date => {
  const candidates: Array<{ date: Date; score: number }> = [];

  for (let dayOffset = 0; dayOffset <= 2; dayOffset++) {
    const candidate = new Date(nightStart);
    candidate.setDate(candidate.getDate() + dayOffset);
    candidate.setHours(currentEnd.getHours(), currentEnd.getMinutes(), 0, 0);

    if (candidate.getTime() <= nightStart.getTime()) continue;

    const spanMinutes = (candidate.getTime() - nightStart.getTime()) / ONE_MINUTE_MS;
    if (spanMinutes < 30) continue;

    // Prefer durations close to a typical night and penalize very long spans.
    const overWindowPenalty = Math.max(0, spanMinutes - NIGHT_WINDOW_MINUTES) * 2;
    const targetPenalty = Math.abs(spanMinutes - PLAUSIBLE_NIGHT_TARGET_MINUTES);
    const score = overWindowPenalty + targetPenalty;
    candidates.push({ date: candidate, score });
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => a.score - b.score);
    return candidates[0].date;
  }

  const fallback = new Date(nightStart);
  fallback.setDate(fallback.getDate() + 1);
  fallback.setHours(currentEnd.getHours(), currentEnd.getMinutes(), 0, 0);
  return fallback;
};

// ─── WakePhase type (derived from gaps between entries) ─────
type WakePhase = {
  start: Date;
  end: Date;
  durationSeconds: number;
  prevEntry: ClassifiedSleepEntry;
  nextEntry: ClassifiedSleepEntry;
};

// ─── MiniNightTimeline (exported for sleep-tracker) ─────────
const MINI_BAR_HEIGHT = 12;

export const MiniNightTimeline = ({
  nightGroup,
  width,
  isDark,
  showLabels = false,
}: {
  nightGroup: NightGroup;
  width: number;
  isDark: boolean;
  showLabels?: boolean;
}) => {
  const anchor = getNightAnchor(nightGroup);
  const segments = nightGroup.segments;
  if (segments.length === 0) return null;

  // Compute range: first start to last end
  const firstStart = segments[0].start;
  const lastEnd = segments[segments.length - 1].end;
  const rangeStartMin = minutesFromAnchor(firstStart, anchor);
  const rangeEndMin = minutesFromAnchor(lastEnd, anchor);
  const rangeMin = Math.max(rangeEndMin - rangeStartMin, 1);
  const ppm = width / rangeMin;

  // Sleep blocks (purple)
  const sleepBlocks = segments.map((segment) => {
    const s = segment.start;
    const e = segment.end;
    const x = (minutesFromAnchor(s, anchor) - rangeStartMin) * ppm;
    const w = Math.max(((e.getTime() - s.getTime()) / 60000) * ppm, 2);
    return { x, w };
  });

  // Wake gaps (beige cutouts)
  const wakeBlocks: { x: number; w: number }[] = [];
  for (let i = 1; i < segments.length; i++) {
    const gapStart = segments[i - 1].end;
    const gapEnd = segments[i].start;
    const gapDur = (gapEnd.getTime() - gapStart.getTime()) / 60000;
    if (gapDur > 0) {
      const x = (minutesFromAnchor(gapStart, anchor) - rangeStartMin) * ppm;
      const w = Math.max(gapDur * ppm, 3);
      wakeBlocks.push({ x, w });
    }
  }

  const purpleColor = isDark ? 'rgba(162, 107, 255, 0.65)' : 'rgba(142, 78, 198, 0.55)';
  const wakeColor = isDark ? 'rgba(212, 149, 106, 0.5)' : 'rgba(176, 114, 82, 0.45)';

  return (
    <View style={{ marginTop: 10, alignSelf: 'center' }}>
      <View style={[miniStyles.container, { width, height: MINI_BAR_HEIGHT }]}>
        {/* Full purple bar from first sleep to last sleep */}
        <View
          style={[
            miniStyles.fullBar,
            { width, backgroundColor: purpleColor },
          ]}
        />
        {/* Wake cutouts */}
        {wakeBlocks.map((wb, i) => (
          <View
            key={`wg-${i}`}
            style={[
              miniStyles.wakeCutout,
              {
                left: wb.x,
                width: wb.w,
                backgroundColor: wakeColor,
              },
            ]}
          />
        ))}
      </View>
      {/* Optional time labels */}
      {showLabels && (
        <View style={miniStyles.labelRow}>
          <Text style={[miniStyles.label, { color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.25)' }]}>
            {formatClockTime(firstStart)}
          </Text>
          <Text style={[miniStyles.label, { color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.25)' }]}>
            {formatClockTime(lastEnd)}
          </Text>
        </View>
      )}
    </View>
  );
};

const miniStyles = StyleSheet.create({
  container: {
    position: 'relative',
    borderRadius: MINI_BAR_HEIGHT / 2,
    overflow: 'hidden',
  },
  fullBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: MINI_BAR_HEIGHT,
    borderRadius: MINI_BAR_HEIGHT / 2,
  },
  wakeCutout: {
    position: 'absolute',
    top: 0,
    height: MINI_BAR_HEIGHT,
    borderRadius: 2,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    fontVariant: ['tabular-nums'] as any,
    opacity: 0.65,
  },
});

// ─── Time Picker Row ────────────────────────────────────────
const TimePickerRow = ({
  label,
  time,
  onChange,
  accentColor,
  isDark,
  textPrimary,
  textSecondary,
  heroMode = false,
  wakeMode = false,
  linkedDisplayTime,
}: {
  label: string;
  time: Date;
  onChange: (newTime: Date) => boolean;
  accentColor: string;
  isDark: boolean;
  textPrimary: string;
  textSecondary: string;
  /** Wenn true: große Hero-Darstellung mit Datum+Zeit-Picker (datetime-mode) */
  heroMode?: boolean;
  /** Wenn true: nur Uhrzeit-Button (groß), kein Label/Datum drumherum */
  wakeMode?: boolean;
  /**
   * Optionaler Override für die angezeigte Zeit — wird gesetzt wenn ein verlinkter Picker
   * (z.B. Eingeschlafen) die Endzeit mitverschieben muss, bevor der DB-Save zurückkommt.
   */
  linkedDisplayTime?: Date;
}) => {
  const [showAndroid, setShowAndroid] = useState(false);
  const [showIOS, setShowIOS] = useState(false);
  const [displayTime, setDisplayTime] = useState(time);
  const [iosDraftTime, setIosDraftTime] = useState(time);

  useEffect(() => {
    setDisplayTime(time);
  }, [time.getTime()]);

  // Wenn der Parent einen verlinkten Wert liefert (wegen linked-shift), sofort anzeigen
  useEffect(() => {
    if (linkedDisplayTime) {
      setDisplayTime(linkedDisplayTime);
    }
  }, [linkedDisplayTime?.getTime()]);

  useEffect(() => {
    if (!showIOS) {
      setIosDraftTime(displayTime);
    }
  }, [showIOS, displayTime]);

  const applyTimeChange = useCallback((nextTime: Date) => {
    const accepted = onChange(nextTime);
    if (accepted) {
      setDisplayTime(nextTime);
    }
  }, [onChange]);

  const commitIOSDraft = useCallback(() => {
    const currentMinute = Math.floor(displayTime.getTime() / 60000);
    const draftMinute = Math.floor(iosDraftTime.getTime() / 60000);
    if (currentMinute !== draftMinute) {
      applyTimeChange(iosDraftTime);
    }
  }, [applyTimeChange, displayTime, iosDraftTime]);

  // ── Hero-Darstellung (Aufgewacht / Eingeschlafen groß) ──────────────
  if (heroMode) {
    return (
      <View style={rowStyles.heroContainer}>
        <Text style={[rowStyles.heroDayText, { color: textSecondary }]}>
          {formatShortDayDate(displayTime)}
        </Text>
        {Platform.OS === 'ios' ? (
          <>
            <TouchableOpacity
              style={[
                rowStyles.heroTimeBtn,
                { backgroundColor: isDark ? 'rgba(162,107,255,0.14)' : 'rgba(142,78,198,0.07)' },
              ]}
              onPress={() => {
                setIosDraftTime(displayTime);
                setShowIOS(true);
              }}
              activeOpacity={0.7}
            >
              <Text style={[rowStyles.heroTimeBtnText, { color: accentColor }]}>
                {formatClockTime(displayTime)}
              </Text>
            </TouchableOpacity>

            <Modal
              visible={showIOS}
              transparent
              animationType="fade"
              onRequestClose={() => {
                commitIOSDraft();
                setShowIOS(false);
              }}
            >
              <View style={rowStyles.iosModalOverlayBottom}>
                <TouchableOpacity
                  style={StyleSheet.absoluteFill}
                  onPress={() => {
                    commitIOSDraft();
                    setShowIOS(false);
                  }}
                  activeOpacity={1}
                />
                <View
                  style={[
                    rowStyles.iosModalCard,
                    {
                      backgroundColor: isDark ? 'rgba(24,24,28,0.96)' : 'rgba(255,255,255,0.98)',
                      borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                    },
                  ]}
                >
                  <View style={rowStyles.iosModalHeader}>
                    <TouchableOpacity
                      onPress={() => setShowIOS(false)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={[rowStyles.iosActionText, { color: textSecondary }]}>Abbrechen</Text>
                    </TouchableOpacity>
                    <Text style={[rowStyles.iosModalTitle, { color: textPrimary }]}>{label}</Text>
                    <TouchableOpacity
                      onPress={() => {
                        commitIOSDraft();
                        setShowIOS(false);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={[rowStyles.iosActionText, { color: accentColor }]}>Fertig</Text>
                    </TouchableOpacity>
                  </View>
                  {/* datetime-Spinner: Datum + Uhrzeit in einem */}
                  <DateTimePicker
                    value={(() => { const d = new Date(iosDraftTime); d.setSeconds(0, 0); return d; })()}
                    mode="datetime"
                    display="spinner"
                    locale="de-DE"
                    onChange={(_, d) => {
                      if (d) setIosDraftTime(d);
                    }}
                    accentColor={accentColor}
                    themeVariant={isDark ? 'dark' : 'light'}
                    style={rowStyles.iosSpinnerDatetime}
                  />
                </View>
              </View>
            </Modal>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={[rowStyles.heroTimeBtn, { backgroundColor: isDark ? 'rgba(162,107,255,0.14)' : 'rgba(142,78,198,0.07)' }]}
              onPress={() => setShowAndroid(true)}
              activeOpacity={0.7}
            >
              <Text style={[rowStyles.heroTimeBtnText, { color: accentColor }]}>
                {formatClockTime(displayTime)}
              </Text>
            </TouchableOpacity>
            {showAndroid && (
              <DateTimePicker
                value={displayTime}
                mode="datetime"
                is24Hour
                onChange={(_, d) => {
                  setShowAndroid(false);
                  if (d) applyTimeChange(d);
                }}
              />
            )}
          </>
        )}
      </View>
    );
  }

  // ── Wake-Mode: nur großer Uhrzeit-Button (für Wachphasen-Karten) ──
  if (wakeMode) {
    return (
      <>
        {Platform.OS === 'ios' ? (
          <>
            <TouchableOpacity
              style={[rowStyles.wakeModeBtn, { backgroundColor: isDark ? 'rgba(232,160,130,0.15)' : 'rgba(232,160,130,0.1)' }]}
              onPress={() => { setIosDraftTime(displayTime); setShowIOS(true); }}
              activeOpacity={0.7}
            >
              <Text style={[rowStyles.wakeModeBtnText, { color: accentColor }]}>
                {formatClockTime(displayTime)}
              </Text>
            </TouchableOpacity>
            <Modal visible={showIOS} transparent animationType="fade" onRequestClose={() => { commitIOSDraft(); setShowIOS(false); }}>
              {/* Modal weiter unten positioniert — besser mit dem Daumen erreichbar */}
              <View style={rowStyles.iosModalOverlayBottom}>
                <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => { commitIOSDraft(); setShowIOS(false); }} activeOpacity={1} />
                <View style={[rowStyles.iosModalCard, { backgroundColor: isDark ? 'rgba(24,24,28,0.96)' : 'rgba(255,255,255,0.98)', borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }]}>
                  <View style={rowStyles.iosModalHeader}>
                    <TouchableOpacity onPress={() => setShowIOS(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={[rowStyles.iosActionText, { color: textSecondary }]}>Abbrechen</Text>
                    </TouchableOpacity>
                    <Text style={[rowStyles.iosModalTitle, { color: textPrimary }]}>{label}</Text>
                    <TouchableOpacity onPress={() => { commitIOSDraft(); setShowIOS(false); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={[rowStyles.iosActionText, { color: accentColor }]}>Fertig</Text>
                    </TouchableOpacity>
                  </View>
                  <DateTimePicker
                    value={(() => { const d = new Date(iosDraftTime); d.setSeconds(0, 0); return d; })()}
                    mode="datetime"
                    display="spinner"
                    locale="de-DE"
                    onChange={(_, d) => { if (d) setIosDraftTime(d); }}
                    accentColor={accentColor}
                    themeVariant={isDark ? 'dark' : 'light'}
                    style={rowStyles.iosSpinnerDatetime}
                  />
                </View>
              </View>
            </Modal>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={[rowStyles.wakeModeBtn, { backgroundColor: isDark ? 'rgba(232,160,130,0.15)' : 'rgba(232,160,130,0.1)' }]}
              onPress={() => setShowAndroid(true)}
              activeOpacity={0.7}
            >
              <Text style={[rowStyles.wakeModeBtnText, { color: accentColor }]}>{formatClockTime(displayTime)}</Text>
            </TouchableOpacity>
            {showAndroid && (
              <DateTimePicker value={displayTime} mode="datetime" is24Hour onChange={(_, d) => { setShowAndroid(false); if (d) applyTimeChange(d); }} />
            )}
          </>
        )}
      </>
    );
  }

  // ── Normale Zeile (Wachphasen etc.) ────────────────────────────────
  return (
    <View style={rowStyles.container}>
      <Text style={[rowStyles.label, { color: textSecondary }]}>{label}</Text>
      <View style={rowStyles.valueColumn}>
        <Text style={[rowStyles.dayText, { color: textSecondary }]}>
          {formatShortDayDate(displayTime)}
        </Text>
        {Platform.OS === 'ios' ? (
          <>
            <TouchableOpacity
              style={[
                rowStyles.timeBtn,
                { backgroundColor: isDark ? 'rgba(162,107,255,0.12)' : 'rgba(142,78,198,0.06)' },
              ]}
              onPress={() => {
                setIosDraftTime(displayTime);
                setShowIOS(true);
              }}
              activeOpacity={0.7}
            >
              <Text style={[rowStyles.timeBtnText, { color: accentColor }]}>
                {formatClockTime(displayTime)}
              </Text>
            </TouchableOpacity>

            <Modal
              visible={showIOS}
              transparent
              animationType="fade"
              onRequestClose={() => {
                commitIOSDraft();
                setShowIOS(false);
              }}
            >
              <View style={rowStyles.iosModalOverlay}>
                <TouchableOpacity
                  style={StyleSheet.absoluteFill}
                  onPress={() => {
                    commitIOSDraft();
                    setShowIOS(false);
                  }}
                  activeOpacity={1}
                />

                <View
                  style={[
                    rowStyles.iosModalCard,
                    {
                      backgroundColor: isDark ? 'rgba(24,24,28,0.96)' : 'rgba(255,255,255,0.98)',
                      borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                    },
                  ]}
                >
                  <View style={rowStyles.iosModalHeader}>
                    <TouchableOpacity
                      onPress={() => setShowIOS(false)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={[rowStyles.iosActionText, { color: textSecondary }]}>Abbrechen</Text>
                    </TouchableOpacity>
                    <Text style={[rowStyles.iosModalTitle, { color: textPrimary }]}>{label}</Text>
                    <TouchableOpacity
                      onPress={() => {
                        commitIOSDraft();
                        setShowIOS(false);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={[rowStyles.iosActionText, { color: accentColor }]}>Fertig</Text>
                    </TouchableOpacity>
                  </View>

                  <DateTimePicker
                    value={(() => { const d = new Date(iosDraftTime); d.setSeconds(0, 0); return d; })()}
                    mode="time"
                    display="spinner"
                    locale="de-DE"
                    onChange={(_, d) => {
                      if (d) setIosDraftTime(d);
                    }}
                    accentColor={accentColor}
                    themeVariant={isDark ? 'dark' : 'light'}
                    style={rowStyles.iosSpinner}
                  />
                </View>
              </View>
            </Modal>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={[rowStyles.timeBtn, { backgroundColor: isDark ? 'rgba(162,107,255,0.12)' : 'rgba(142,78,198,0.06)' }]}
              onPress={() => setShowAndroid(true)}
              activeOpacity={0.7}
            >
              <Text style={[rowStyles.timeBtnText, { color: accentColor }]}>
                {formatClockTime(displayTime)}
              </Text>
            </TouchableOpacity>
            {showAndroid && (
              <DateTimePicker
                value={displayTime}
                mode="time"
                is24Hour
                onChange={(_, d) => {
                  setShowAndroid(false);
                  if (d) applyTimeChange(d);
                }}
              />
            )}
          </>
        )}
      </View>
    </View>
  );
};

const rowStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  label: { fontSize: 15, fontWeight: '500' },
  valueColumn: {
    alignItems: 'flex-end',
    gap: 4,
  },
  dayText: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.75,
    textTransform: 'capitalize',
  },
  timeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  timeBtnText: { fontSize: 16, fontWeight: '700' },
  // Hero mode
  heroContainer: {
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  heroDayText: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.75,
    textTransform: 'capitalize',
    marginBottom: 6,
  },
  heroTimeBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  heroTimeBtnText: { fontSize: 28, fontWeight: '700', letterSpacing: 0.5, fontVariant: ['tabular-nums'] as any },
  // Wake mode (Uhrzeit-Button im Wachphasen-Formular)
  wakeModeBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  wakeModeBtnText: { fontSize: 24, fontWeight: '700', fontVariant: ['tabular-nums'] as any },
  iosModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  // Für wakeMode: Picker weiter unten — leichter mit dem Daumen erreichbar
  iosModalOverlayBottom: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 48 : 24,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  iosModalCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
  },
  iosModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iosModalTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  iosActionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  iosSpinner: {
    marginTop: 4,
    height: 180,
  },
  iosSpinnerDatetime: {
    marginTop: 4,
    height: 180,
  },
});

// ─── Main Editor Component ──────────────────────────────────
export default function NightSleepEditor({
  visible,
  nightGroup,
  onClose,
  onSplit,
  onMerge,
  onAdjustBoundary,
  onDeleteNightGroup,
  isSaving,
}: NightSleepEditorProps) {
  const router = useRouter();
  const adaptiveColors = useAdaptiveColors();
  const isDark = adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;
  const textPrimary = isDark ? Colors.dark.textPrimary : '#5C4033';
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';
  const accentColor = isDark ? ACCENT_DARK : ACCENT_LIGHT;
  const wakeColor = isDark ? WAKE_COLOR_DARK : WAKE_COLOR_LIGHT;
  const ghostColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';
  const overlayColor = isDark ? 'rgba(0,0,0,0.58)' : 'rgba(0,0,0,0.35)';
  const panelColor = isDark ? 'rgba(10,10,12,0.86)' : 'transparent';
  const panelBorderColor = isDark ? 'rgba(255,255,255,0.08)' : 'transparent';
  const cardBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)';
  const wakeBg = isDark ? WAKE_BG_DARK : WAKE_BG_LIGHT;

  const [addingWake, setAddingWake] = useState(false);
  const [newWakeStart, setNewWakeStart] = useState<Date | null>(null);
  const [newWakeDurationMin, setNewWakeDurationMin] = useState(5);
  const [isSubmittingWake, setIsSubmittingWake] = useState(false);
  const [showAutoFixInfoModal, setShowAutoFixInfoModal] = useState(false);
  // Linked-shift display overrides: wenn Eingeschlafen die Aufgewacht-Zeit mitschiebt
  // (oder umgekehrt), zeigen wir den neuen Wert sofort — bevor der DB-Save zurückkommt.
  const [linkedNightStartDisplay, setLinkedNightStartDisplay] = useState<Date | undefined>(undefined);
  const [linkedNightEndDisplay, setLinkedNightEndDisplay] = useState<Date | undefined>(undefined);
  // Optimistischer Entries-Override: wird sofort nach Split gesetzt, damit die neue Wachphase
  // direkt erscheint — bevor der Parent nach dem DB-Reload eine neue nightGroup liefert.
  const [optimisticEntries, setOptimisticEntries] = useState<ClassifiedSleepEntry[] | null>(null);
  // Debounce-Timer pro Boundary-Key (z.B. "night-end-<id>")
  const pendingAdjustTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});
  // Letzte akzeptierte Zeit pro Key – damit der nächste Picker-Interact richtig aufgelöst wird
  const boundaryReferenceTimesRef = useRef<Record<string, Date>>({});
  // Spiegel von `isSaving` als Ref, damit setTimeout-Callbacks den aktuellen Wert lesen können
  const isSavingRef = useRef(isSaving);
  useEffect(() => { isSavingRef.current = isSaving; }, [isSaving]);

  // Wenn der Parent neue Daten liefert (nach DB-Reload), optimistische Daten verwerfen
  useEffect(() => {
    setOptimisticEntries(null);
  }, [nightGroup]);

  const entries = optimisticEntries ?? nightGroup.entries;
  const firstEntry = useMemo(() => {
    return entries.reduce((earliest, entry) => {
      if (!earliest) return entry;
      return new Date(entry.start_time).getTime() < new Date(earliest.start_time).getTime()
        ? entry
        : earliest;
    }, entries[0]);
  }, [entries]);
  const lastEntry = useMemo(() => {
    return entries.reduce((latest, entry) => {
      if (!latest) return entry;
      // Aktive Einträge (kein end_time) gelten als "jetzt endend" — nicht als negative Unendlichkeit.
      // So gewinnt ein laufender Schlaf immer gegen jeden bereits beendeten Eintrag.
      const now = Date.now();
      const latestEnd = latest.end_time ? new Date(latest.end_time).getTime() : now;
      const currentEnd = entry.end_time ? new Date(entry.end_time).getTime() : now;
      if (currentEnd > latestEnd) return entry;
      if (currentEnd === latestEnd) {
        return new Date(entry.start_time).getTime() > new Date(latest.start_time).getTime()
          ? entry
          : latest;
      }
      return latest;
    }, entries[0]);
  }, [entries]);

  const nightStart = nightGroup.start;
  const nightEnd = nightGroup.end;
  const totalSleepMin = nightGroup.totalMinutes;
  const nightSpanMinutes = useMemo(
    () => Math.round((nightEnd.getTime() - nightStart.getTime()) / ONE_MINUTE_MS),
    [nightEnd, nightStart]
  );
  const hasMultiDayNightAnomaly = nightSpanMinutes > ANOMALOUS_MULTI_DAY_MINUTES;

  // Derive wake phases from gaps between entries
  const wakePhases: WakePhase[] = useMemo(() => {
    const phases: WakePhase[] = [];
    for (let i = 1; i < entries.length; i++) {
      const prev = entries[i - 1];
      const next = entries[i];
      if (!prev.end_time) continue;
      const start = new Date(prev.end_time);
      const end = new Date(next.start_time);
      const durationSeconds = Math.round((end.getTime() - start.getTime()) / 1000);
      if (durationSeconds > 0) {
        phases.push({ start, end, durationSeconds, prevEntry: prev, nextEntry: next });
      }
    }
    return phases;
  }, [entries]);
  const totalWakeSeconds = useMemo(
    () => wakePhases.reduce((sum, phase) => sum + phase.durationSeconds, 0),
    [wakePhases]
  );

  useEffect(() => {
    const nextReferenceTimes: Record<string, Date> = {};
    const nightStartKey = `night-start-${firstEntry.id ?? 'no-id'}`;
    const nightEndKey = `night-end-${lastEntry.id ?? 'no-id'}`;

    nextReferenceTimes[nightStartKey] = new Date(firstEntry.start_time);
    nextReferenceTimes[nightEndKey] = lastEntry.end_time ? new Date(lastEntry.end_time) : new Date();

    for (const phase of wakePhases) {
      const wakeStartKey = `wake-start-${phase.prevEntry.id ?? 'no-id'}-${phase.nextEntry.id ?? 'no-id'}`;
      const wakeEndKey = `wake-end-${phase.prevEntry.id ?? 'no-id'}-${phase.nextEntry.id ?? 'no-id'}`;
      nextReferenceTimes[wakeStartKey] = new Date(phase.start);
      nextReferenceTimes[wakeEndKey] = new Date(phase.end);
    }

    boundaryReferenceTimesRef.current = nextReferenceTimes;
  }, [
    firstEntry.id,
    firstEntry.start_time,
    lastEntry.id,
    lastEntry.end_time,
    wakePhases,
  ]);

  useEffect(() => {
    return () => {
      Object.values(pendingAdjustTimeoutsRef.current).forEach((timeoutId) => {
        if (timeoutId) clearTimeout(timeoutId);
      });
      pendingAdjustTimeoutsRef.current = {};
      boundaryReferenceTimesRef.current = {};
    };
  }, []);

  const scheduleBoundaryAdjust = useCallback(
    (key: string, entry: ClassifiedSleepEntry, field: 'start_time' | 'end_time', date: Date) => {
      const existingTimeout = pendingAdjustTimeoutsRef.current[key];
      if (existingTimeout) clearTimeout(existingTimeout);

      pendingAdjustTimeoutsRef.current[key] = setTimeout(() => {
        pendingAdjustTimeoutsRef.current[key] = null;
        if (isSavingRef.current) {
          // Wenn gerade gespeichert wird, noch einmal kurz warten und dann direkt speichern
          pendingAdjustTimeoutsRef.current[key] = setTimeout(() => {
            pendingAdjustTimeoutsRef.current[key] = null;
            void onAdjustBoundary(entry, field, date);
          }, 300);
          return;
        }
        void onAdjustBoundary(entry, field, date);
      }, 250);
    },
    [onAdjustBoundary]
  );

  // ─── Handlers ──────────────────────────────────────────
  // heroMode-Picker liefert absolutes Datum+Zeit (datetime-mode) → direkt verwenden, kein resolve nötig
  const handleChangeNightStart = useCallback((newTime: Date): boolean => {
    const key = `night-start-${firstEntry.id ?? 'no-id'}`;
    const endKey = `night-end-${lastEntry.id ?? 'no-id'}`;
    const fallbackOriginal = new Date(firstEntry.start_time);
    const fallbackNightEnd = lastEntry.end_time ? new Date(lastEntry.end_time) : nightEnd;
    const original = boundaryReferenceTimesRef.current[key] ?? fallbackOriginal;
    const currentNightEnd = boundaryReferenceTimesRef.current[endKey] ?? fallbackNightEnd;

    const resolved = new Date(newTime);
    resolved.setSeconds(0, 0);
    if (Math.floor(resolved.getTime() / 60000) === Math.floor(original.getTime() / 60000)) return false;

    // Wenn neue Startzeit hinter der Endzeit liegt: Endzeit um gleiche Differenz verschieben
    if (resolved.getTime() >= currentNightEnd.getTime()) {
      const delta = resolved.getTime() - original.getTime();
      const newEnd = new Date(currentNightEnd.getTime() + delta);
      newEnd.setSeconds(0, 0);
      boundaryReferenceTimesRef.current[endKey] = newEnd;
      scheduleBoundaryAdjust(endKey, lastEntry, 'end_time', newEnd);
      // Sofort visuell im Aufgewacht-Picker anzeigen (linked-shift)
      setLinkedNightEndDisplay(newEnd);
    } else {
      setLinkedNightEndDisplay(undefined);
    }

    boundaryReferenceTimesRef.current[key] = resolved;
    scheduleBoundaryAdjust(key, firstEntry, 'start_time', resolved);
    hapticLight();
    return true;
  }, [firstEntry, lastEntry, nightEnd, scheduleBoundaryAdjust]);

  const handleChangeNightEnd = useCallback((newTime: Date): boolean => {
    const key = `night-end-${lastEntry.id ?? 'no-id'}`;
    const startKey = `night-start-${firstEntry.id ?? 'no-id'}`;
    const fallbackNightStart = new Date(firstEntry.start_time);
    const fallbackOriginal = lastEntry.end_time ? new Date(lastEntry.end_time) : new Date();
    const original = boundaryReferenceTimesRef.current[key] ?? fallbackOriginal;
    const currentNightStart = boundaryReferenceTimesRef.current[startKey] ?? fallbackNightStart;

    const resolved = new Date(newTime);
    resolved.setSeconds(0, 0);
    if (Math.floor(resolved.getTime() / 60000) === Math.floor(original.getTime() / 60000)) return false;

    // Wenn neue Endzeit vor der Startzeit liegt: Startzeit um gleiche Differenz verschieben
    if (resolved.getTime() <= currentNightStart.getTime()) {
      const delta = resolved.getTime() - original.getTime();
      const newStart = new Date(currentNightStart.getTime() + delta);
      newStart.setSeconds(0, 0);
      boundaryReferenceTimesRef.current[startKey] = newStart;
      scheduleBoundaryAdjust(startKey, firstEntry, 'start_time', newStart);
      // Sofort visuell im Eingeschlafen-Picker anzeigen (linked-shift)
      setLinkedNightStartDisplay(newStart);
    } else {
      setLinkedNightStartDisplay(undefined);
    }

    boundaryReferenceTimesRef.current[key] = resolved;
    scheduleBoundaryAdjust(key, lastEntry, 'end_time', resolved);
    hapticLight();
    return true;
  }, [firstEntry, lastEntry, scheduleBoundaryAdjust]);

  const getAutoFixPreview = useCallback(() => {
    if (!lastEntry.end_time) return null;

    const startKey = `night-start-${firstEntry.id ?? 'no-id'}`;
    const endKey = `night-end-${lastEntry.id ?? 'no-id'}`;
    const startReference = boundaryReferenceTimesRef.current[startKey] ?? new Date(firstEntry.start_time);
    const endReference = boundaryReferenceTimesRef.current[endKey] ?? new Date(lastEntry.end_time);
    const fixedEnd = inferLikelyNightEndFromClock(startReference, endReference);
    return { endKey, endReference, fixedEnd };
  }, [firstEntry.id, firstEntry.start_time, lastEntry.id, lastEntry.end_time]);

  const handleAutoFixMultiDayNight = useCallback(() => {
    if (isSaving) return;
    const preview = getAutoFixPreview();
    if (!preview) return;

    const { endKey, endReference, fixedEnd } = preview;

    if (minutesBucket(fixedEnd) === minutesBucket(endReference)) return;

    Alert.alert(
      'Nachtschlaf korrigieren',
      `Aufgewacht wird auf ${formatShortDayDate(fixedEnd)} ${formatClockTime(fixedEnd)} gesetzt.`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Korrigieren',
          onPress: () => {
            boundaryReferenceTimesRef.current[endKey] = fixedEnd;
            scheduleBoundaryAdjust(endKey, lastEntry, 'end_time', fixedEnd);
            hapticLight();
          },
        },
      ]
    );
  }, [getAutoFixPreview, isSaving, lastEntry, scheduleBoundaryAdjust]);

  const handleShowAutoFixInfo = useCallback(() => {
    setShowAutoFixInfoModal(true);
  }, []);

  const handleChangeWakeStart = useCallback((phase: WakePhase, newTime: Date): boolean => {
    const startKey = `wake-start-${phase.prevEntry.id ?? 'no-id'}-${phase.nextEntry.id ?? 'no-id'}`;
    const endKey = `wake-end-${phase.prevEntry.id ?? 'no-id'}-${phase.nextEntry.id ?? 'no-id'}`;
    const original = boundaryReferenceTimesRef.current[startKey] ?? phase.start;
    const currentWakeEnd = boundaryReferenceTimesRef.current[endKey] ?? phase.end;
    const prevEntryStart = new Date(phase.prevEntry.start_time);

    // wakeMode verwendet datetime-Picker → absoluten Timestamp direkt verwenden
    const resolved = new Date(newTime);
    resolved.setSeconds(0, 0);
    if (resolved.getTime() <= prevEntryStart.getTime()) return false;
    if (resolved.getTime() >= currentWakeEnd.getTime()) return false;
    if (Math.floor(resolved.getTime() / 60000) === Math.floor(original.getTime() / 60000)) return false;

    boundaryReferenceTimesRef.current[startKey] = resolved;
    scheduleBoundaryAdjust(
      startKey,
      phase.prevEntry,
      'end_time',
      resolved
    );
    hapticLight();
    return true;
  }, [scheduleBoundaryAdjust]);

  const handleChangeWakeEnd = useCallback((phase: WakePhase, newTime: Date): boolean => {
    const endKey = `wake-end-${phase.prevEntry.id ?? 'no-id'}-${phase.nextEntry.id ?? 'no-id'}`;
    const startKey = `wake-start-${phase.prevEntry.id ?? 'no-id'}-${phase.nextEntry.id ?? 'no-id'}`;
    const original = boundaryReferenceTimesRef.current[endKey] ?? phase.end;
    const currentWakeStart = boundaryReferenceTimesRef.current[startKey] ?? phase.start;
    const nextEntryEnd = phase.nextEntry.end_time ? new Date(phase.nextEntry.end_time) : undefined;

    // wakeMode verwendet datetime-Picker → absoluten Timestamp direkt verwenden
    const resolved = new Date(newTime);
    resolved.setSeconds(0, 0);
    if (resolved.getTime() <= currentWakeStart.getTime()) return false;
    if (nextEntryEnd && resolved.getTime() >= nextEntryEnd.getTime()) return false;
    if (Math.floor(resolved.getTime() / 60000) === Math.floor(original.getTime() / 60000)) return false;

    boundaryReferenceTimesRef.current[endKey] = resolved;
    scheduleBoundaryAdjust(
      endKey,
      phase.nextEntry,
      'start_time',
      resolved
    );
    hapticLight();
    return true;
  }, [scheduleBoundaryAdjust]);

  const handleDeleteWake = useCallback((phase: WakePhase) => {
    Alert.alert(
      'Wachphase entfernen',
      `${formatShortDayDate(phase.start)} ${formatClockTime(phase.start)} – ${formatShortDayDate(phase.end)} ${formatClockTime(phase.end)} (${formatWakeDuration(phase.durationSeconds)}) entfernen und Schlaf verbinden?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Entfernen',
          style: 'destructive',
          onPress: async () => {
            const currentEntries = entries;
            let didApplyOptimisticMerge = false;

            const toMinuteBucket = (value: Date | string | null | undefined): number | null => {
              if (!value) return null;
              const ms = new Date(value).getTime();
              if (!Number.isFinite(ms)) return null;
              return Math.floor(ms / ONE_MINUTE_MS);
            };
            const hasSameBoundaries = (
              left: { start_time: Date | string; end_time?: Date | string | null },
              right: { start_time: Date | string; end_time?: Date | string | null }
            ): boolean => {
              const leftStartBucket = toMinuteBucket(left.start_time);
              const rightStartBucket = toMinuteBucket(right.start_time);
              if (leftStartBucket === null || rightStartBucket === null || leftStartBucket !== rightStartBucket) {
                return false;
              }
              return toMinuteBucket(left.end_time ?? null) === toMinuteBucket(right.end_time ?? null);
            };
            const isSameEntry = (
              candidate: ClassifiedSleepEntry,
              target: ClassifiedSleepEntry
            ): boolean => {
              if (candidate.id && target.id) return candidate.id === target.id;
              return hasSameBoundaries(candidate, target);
            };

            const prevIdx = currentEntries.findIndex((entry) => isSameEntry(entry, phase.prevEntry));
            const nextIdx = currentEntries.findIndex((entry, idx) => idx > prevIdx && isSameEntry(entry, phase.nextEntry));

            if (prevIdx >= 0 && nextIdx > prevIdx) {
              const mergedEntry: ClassifiedSleepEntry = {
                ...currentEntries[prevIdx],
                end_time: currentEntries[nextIdx].end_time ?? null,
              };
              const newEntries: ClassifiedSleepEntry[] = [
                ...currentEntries.slice(0, prevIdx),
                mergedEntry,
                ...currentEntries.slice(nextIdx + 1),
              ];
              setOptimisticEntries(newEntries);
              didApplyOptimisticMerge = true;
            }

            try {
              const didMerge = await onMerge(phase.prevEntry, phase.nextEntry);
              if (didMerge) {
                hapticLight();
                return;
              }
              if (didApplyOptimisticMerge) {
                setOptimisticEntries(currentEntries);
              }
              Alert.alert('Konnte nicht löschen', 'Die Wachphase konnte nicht entfernt werden.');
            } catch {
              if (didApplyOptimisticMerge) {
                setOptimisticEntries(currentEntries);
              }
              Alert.alert('Konnte nicht löschen', 'Die Wachphase konnte nicht entfernt werden.');
            }
          },
        },
      ]
    );
  }, [entries, onMerge]);

  const handleDeleteEntireNight = useCallback(() => {
    if (isSaving) return;

    const entryIds = entries
      .map((entry) => entry.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    if (entryIds.length === 0) {
      Alert.alert('Nicht möglich', 'Für diesen Nachtschlaf wurden keine gültigen Segmente gefunden.');
      return;
    }

    Alert.alert(
      'Nachtschlaf löschen',
      `Möchtest du den gesamten Nachtschlaf wirklich löschen? (${entryIds.length} Segment${entryIds.length === 1 ? '' : 'e'})`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Alles löschen',
          style: 'destructive',
          onPress: async () => {
            const didDelete = await onDeleteNightGroup(entryIds);
            if (!didDelete) return;
            hapticLight();
            onClose();
          },
        },
      ]
    );
  }, [entries, isSaving, onClose, onDeleteNightGroup]);

  // Add wake phase: find the longest sleep segment and split in the middle
  const handleStartAddWake = useCallback(() => {
    // Find longest entry
    let longestIdx = 0;
    let longestDur = 0;
    entries.forEach((entry, i) => {
      const start = new Date(entry.start_time);
      const end = entry.end_time ? new Date(entry.end_time) : new Date();
      const dur = end.getTime() - start.getTime();
      if (dur > longestDur) {
        longestDur = dur;
        longestIdx = i;
      }
    });

    const longest = entries[longestIdx];
    const mid = new Date(
      new Date(longest.start_time).getTime() + longestDur / 2
    );
    mid.setSeconds(0, 0);

    setNewWakeStart(mid);
    setNewWakeDurationMin(5);
    setAddingWake(true);
  }, [entries]);

  const handleConfirmAddWake = useCallback(async () => {
    if (!newWakeStart || isSubmittingWake) return;

    const wakeMinutes = Math.max(1, newWakeDurationMin);

    // newWakeStart ist ein absoluter Timestamp (aus handleStartAddWake oder resolvePickerTimeNearReference),
    // daher kein Datum-Kandidaten-Loop nötig — direkte Suche im passenden Eintrag.
    const wakeStartMs = newWakeStart.getTime();
    const targetEntry = entries.find((entry) => {
      const start = new Date(entry.start_time).getTime();
      const end = (entry.end_time ? new Date(entry.end_time) : new Date()).getTime();
      return wakeStartMs >= start && wakeStartMs < end;
    }) ?? null;

    if (!targetEntry) {
      Alert.alert(
        'Nicht speicherbar',
        'Die gewählte Startzeit liegt außerhalb der Schlafphase. Bitte passe "Von" an.'
      );
      return;
    }

    setIsSubmittingWake(true);
    try {
      const didSave = await onSplit({
        targetEntry,
        splitTime: newWakeStart,
        wakeMinutes,
      });

      if (!didSave) {
        Alert.alert('Konnte nicht speichern', 'Bitte versuche es erneut.');
        return;
      }

      // Optimistisches Update: Wachphase sofort in der Liste zeigen, bevor der Parent
      // nach dem DB-Reload eine neue nightGroup liefert.
      const wakeEnd = new Date(newWakeStart.getTime() + wakeMinutes * ONE_MINUTE_MS);
      const optimisticFirstHalf: ClassifiedSleepEntry = {
        ...targetEntry,
        end_time: newWakeStart.toISOString(),
      };
      const optimisticSecondHalf: ClassifiedSleepEntry = {
        ...targetEntry,
        id: undefined,   // temporäre ID — wird nach DB-Reload durch echte ID ersetzt
        start_time: wakeEnd.toISOString(),
      };
      const currentEntries = entries;
      const insertIdx = currentEntries.findIndex((e) => e === targetEntry || e.id === targetEntry.id);
      const newEntries: ClassifiedSleepEntry[] = [
        ...currentEntries.slice(0, insertIdx),
        optimisticFirstHalf,
        optimisticSecondHalf,
        ...currentEntries.slice(insertIdx + 1),
      ];
      setOptimisticEntries(newEntries);

      setAddingWake(false);
      setNewWakeStart(null);
      hapticLight();
    } catch {
      Alert.alert('Konnte nicht speichern', 'Beim Speichern ist ein Fehler aufgetreten.');
    } finally {
      setIsSubmittingWake(false);
    }
  }, [newWakeStart, newWakeDurationMin, entries, onSplit, isSubmittingWake]);

  const handleChangeNewWakeStart = useCallback((pickedTime: Date): boolean => {
    if (!newWakeStart) return false;

    // wakeMode verwendet datetime-Picker → absoluten Timestamp direkt verwenden
    const resolved = new Date(pickedTime);
    resolved.setSeconds(0, 0);

    const earliestAllowedStartMs = nightStart.getTime();
    const latestAllowedEndMs = nightEnd.getTime() - ONE_MINUTE_MS;
    if (resolved.getTime() < earliestAllowedStartMs) return false;
    if (resolved.getTime() >= latestAllowedEndMs) return false;
    if (minutesBucket(resolved) === minutesBucket(newWakeStart)) return false;

    setNewWakeStart(resolved);
    return true;
  }, [newWakeStart, nightEnd, nightStart]);

  const handleOpenNightWindowSettings = useCallback(() => {
    onClose();
    router.push({
      pathname: '/app-settings',
      params: { focus: 'night-window' },
    });
  }, [onClose, router]);

  const autoFixPreview = getAutoFixPreview();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => !isSaving && onClose()}
    >
      <View style={[styles.overlay, { backgroundColor: overlayColor }]}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={() => !isSaving && onClose()}
          activeOpacity={1}
        />

        <BlurView
          style={[
            styles.panel,
            {
              backgroundColor: panelColor,
              borderTopWidth: isDark ? 1 : 0,
              borderTopColor: panelBorderColor,
            },
          ]}
          tint={isDark ? 'dark' : 'extraLight'}
          intensity={80}
        >
          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollContentInner}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={[styles.headerEmoji]}>🌙</Text>
              <Text style={[styles.headerTitle, { color: textPrimary }]}>
                Nachtschlaf bearbeiten
              </Text>
              <TouchableOpacity
                style={[
                  styles.headerSettingsBtn,
                  {
                    borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)',
                    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                  },
                ]}
                onPress={handleOpenNightWindowSettings}
                activeOpacity={0.7}
              >
                <Text style={[styles.headerSettingsBtnText, { color: accentColor }]}>
                  ✏️ Nachtschlaffenster anpassen
                </Text>
              </TouchableOpacity>
            </View>

            {/* Summary */}
            <View style={[styles.summaryCard, { backgroundColor: cardBg }]}>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: textSecondary }]}>Schlaf</Text>
                <Text style={[styles.summaryValue, { color: accentColor }]}>{minutesToHMM(totalSleepMin)}</Text>
              </View>
              {totalWakeSeconds > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: textSecondary }]}>Wach</Text>
                  <Text style={[styles.summaryValue, { color: wakeColor }]}>{formatWakeDuration(totalWakeSeconds)}</Text>
                </View>
              )}
            </View>

            {/* Hero: Eingeschlafen + Aufgewacht nebeneinander */}
            <View style={[styles.heroDuoCard, { backgroundColor: cardBg }]}>
              {/* Eingeschlafen */}
              <View style={styles.heroDuoSide}>
                <Text style={[styles.heroLabel, { color: textSecondary }]}>Eingeschlafen</Text>
                <TimePickerRow
                  label="Eingeschlafen"
                  time={nightStart}
                  onChange={handleChangeNightStart}
                  accentColor={accentColor}
                  isDark={isDark}
                  textPrimary={textPrimary}
                  textSecondary={textSecondary}
                  heroMode
                  linkedDisplayTime={linkedNightStartDisplay}
                />
              </View>

              {/* Trennlinie */}
              <View style={[styles.heroDuoDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]} />

              {/* Aufgewacht */}
              <View style={styles.heroDuoSide}>
                <Text style={[styles.heroLabel, { color: textSecondary }]}>Aufgewacht</Text>
                <TimePickerRow
                  label="Aufgewacht"
                  time={nightEnd}
                  onChange={handleChangeNightEnd}
                  accentColor={accentColor}
                  isDark={isDark}
                  textPrimary={textPrimary}
                  textSecondary={textSecondary}
                  heroMode
                  linkedDisplayTime={linkedNightEndDisplay}
                />
              </View>
            </View>

            {hasMultiDayNightAnomaly && (
              <View
                style={[
                  styles.anomalyCard,
                  {
                    backgroundColor: isDark ? 'rgba(232,160,130,0.12)' : 'rgba(232,160,130,0.10)',
                    borderColor: isDark ? 'rgba(232,160,130,0.35)' : 'rgba(232,160,130,0.45)',
                  },
                ]}
              >
                <View style={styles.anomalyHeader}>
                  <Text style={[styles.anomalyTitle, { color: textPrimary }]}>
                    Unplausible Dauer erkannt
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.anomalyInfoBtn,
                      { borderColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)' },
                    ]}
                    onPress={handleShowAutoFixInfo}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.anomalyInfoBtnText, { color: textSecondary }]}>i</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.anomalyText, { color: textSecondary }]}>
                  Dieser Nachtschlaf läuft aktuell über {Math.floor(nightSpanMinutes / ONE_DAY_MINUTES)} Tage.
                </Text>
                <TouchableOpacity
                  style={[styles.anomalyBtn, { backgroundColor: wakeColor }]}
                  onPress={handleAutoFixMultiDayNight}
                  disabled={isSaving || !lastEntry.end_time}
                  activeOpacity={0.75}
                >
                  <Text style={styles.anomalyBtnText}>
                    {isSaving ? 'Speichert...' : 'Automatisch korrigieren'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Wake phases */}
            <View style={styles.wakeSection}>
              <Text style={[styles.wakeSectionTitle, { color: textPrimary }]}>Wachphasen</Text>
              {!addingWake && (
                <TouchableOpacity
                  style={[styles.wakeAddInlineBtn, { backgroundColor: isDark ? 'rgba(232,160,130,0.15)' : 'rgba(232,160,130,0.12)' }]}
                  onPress={handleStartAddWake}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.wakeAddInlineBtnText, { color: wakeColor }]}>+ Hinzufügen</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Existing wake phases */}
            {wakePhases.map((phase, i) => (
              <View key={`wake-${i}`} style={[styles.wakeCard, { backgroundColor: wakeBg }]}>
                {/* Header: Dauer + Löschen */}
                <View style={styles.wakeCardTop}>
                  <Text style={[styles.wakeCardDuration, { color: wakeColor }]}>
                    {formatWakeDuration(phase.durationSeconds)}
                  </Text>
                  <TouchableOpacity
                    onPress={() => { if (!isSaving) void handleDeleteWake(phase); }}
                    disabled={isSaving}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    activeOpacity={0.5}
                  >
                    <Text style={[styles.wakeCardDeleteIcon, { color: textSecondary }]}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* Von / Bis nebeneinander — wie die Eingeschlafen/Aufgewacht-Karte */}
                <View style={styles.wakeCardDuo}>
                  <View style={styles.wakeCardDuoSide}>
                    <Text style={[styles.wakeCardDuoLabel, { color: textSecondary }]}>Von</Text>
                    <Text style={[styles.wakeCardDuoDate, { color: textSecondary }]}>
                      {formatShortDayDate(phase.start)}
                    </Text>
                    <TimePickerRow
                      label="Von"
                      time={phase.start}
                      onChange={(d) => handleChangeWakeStart(phase, d)}
                      accentColor={wakeColor}
                      isDark={isDark}
                      textPrimary={textPrimary}
                      textSecondary={textSecondary}
                      wakeMode
                    />
                  </View>
                  <View style={[styles.wakeCardDuoDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]} />
                  <View style={styles.wakeCardDuoSide}>
                    <Text style={[styles.wakeCardDuoLabel, { color: textSecondary }]}>Bis</Text>
                    <Text style={[styles.wakeCardDuoDate, { color: textSecondary }]}>
                      {formatShortDayDate(phase.end)}
                    </Text>
                    <TimePickerRow
                      label="Bis"
                      time={phase.end}
                      onChange={(d) => handleChangeWakeEnd(phase, d)}
                      accentColor={wakeColor}
                      isDark={isDark}
                      textPrimary={textPrimary}
                      textSecondary={textSecondary}
                      wakeMode
                    />
                  </View>
                </View>
              </View>
            ))}

            {wakePhases.length === 0 && !addingWake && (
              <Text style={[styles.noWakeText, { color: textSecondary }]}>
                Keine Wachphasen eingetragen
              </Text>
            )}

            {/* New wake phase form */}
            {addingWake && newWakeStart && (
              <View style={[styles.newWakeForm, { backgroundColor: wakeBg, borderColor: wakeColor }]}>

                {/* Von — zwei Spalten: Label + Uhrzeit-Button */}
                <View style={styles.newWakeVonRow}>
                  <View>
                    <Text style={[styles.newWakeFormLabel, { color: textSecondary }]}>Von</Text>
                    <Text style={[styles.newWakeVonDate, { color: textSecondary }]}>
                      {formatShortDayDate(newWakeStart)}
                    </Text>
                  </View>
                  <TimePickerRow
                    label="Von"
                    time={newWakeStart}
                    onChange={handleChangeNewWakeStart}
                    accentColor={wakeColor}
                    isDark={isDark}
                    textPrimary={textPrimary}
                    textSecondary={textSecondary}
                    wakeMode
                  />
                </View>

                {/* Trennlinie */}
                <View style={[styles.newWakeInnerDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)' }]} />

                {/* Dauer stepper */}
                <View style={styles.newWakeStepper}>
                  <Text style={[styles.newWakeStepperLabel, { color: textSecondary }]}>Dauer</Text>
                  <View style={styles.newWakeStepperControls}>
                    <TouchableOpacity
                      style={[styles.newWakeStepBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}
                      onPress={() => setNewWakeDurationMin((d) => Math.max(1, d - 1))}
                      onLongPress={() => setNewWakeDurationMin((d) => Math.max(1, d - 5))}
                      activeOpacity={0.6}
                    >
                      <Text style={[styles.newWakeStepBtnText, { color: wakeColor }]}>−</Text>
                    </TouchableOpacity>
                    <Text style={[styles.newWakeStepValue, { color: textPrimary }]}>{newWakeDurationMin} Min</Text>
                    <TouchableOpacity
                      style={[styles.newWakeStepBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}
                      onPress={() => setNewWakeDurationMin((d) => Math.min(240, d + 1))}
                      onLongPress={() => setNewWakeDurationMin((d) => Math.min(240, d + 5))}
                      activeOpacity={0.6}
                    >
                      <Text style={[styles.newWakeStepBtnText, { color: wakeColor }]}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Buttons */}
                <View style={styles.newWakeBtns}>
                  <TouchableOpacity
                    style={[styles.newWakeCancelBtn, { borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }]}
                    onPress={() => setAddingWake(false)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.newWakeCancelText, { color: textSecondary }]}>Abbrechen</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.newWakeConfirmBtn, { backgroundColor: wakeColor }]}
                    onPress={handleConfirmAddWake}
                    disabled={isSaving || isSubmittingWake}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.newWakeConfirmText}>
                      {isSaving || isSubmittingWake ? 'Speichert…' : 'Hinzufügen'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}


            <TouchableOpacity
              style={[
                styles.deleteNightBtn,
                { borderColor: isDark ? 'rgba(232,160,130,0.45)' : 'rgba(210,92,67,0.4)' },
              ]}
              onPress={handleDeleteEntireNight}
              disabled={isSaving}
              activeOpacity={0.7}
            >
              <Text style={styles.deleteNightBtnText}>
                {isSaving ? 'Speichert...' : 'Gesamten Nachtschlaf löschen'}
              </Text>
            </TouchableOpacity>
          </ScrollView>

          <Modal
            visible={showAutoFixInfoModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowAutoFixInfoModal(false)}
          >
            <View style={styles.infoModalOverlay}>
              <TouchableOpacity
                style={StyleSheet.absoluteFill}
                onPress={() => setShowAutoFixInfoModal(false)}
                activeOpacity={1}
              />
              <View
                style={[
                  styles.infoModalCard,
                  {
                    backgroundColor: isDark ? 'rgba(24,24,28,0.98)' : 'rgba(255,255,255,0.99)',
                    borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                  },
                ]}
              >
                <Text style={[styles.infoModalTitle, { color: textPrimary }]}>
                  Was macht die Korrektur?
                </Text>
                <Text style={[styles.infoModalText, { color: textSecondary }]}>
                  Es wird nur der Zeitpunkt "Aufgewacht" angepasst.
                </Text>
                <Text style={[styles.infoModalText, { color: textSecondary }]}>
                  Die aktuelle Aufgewacht-Uhrzeit bleibt erhalten und der Tag wird automatisch so gewählt, dass die Nachtdauer plausibel ist.
                </Text>
                <Text style={[styles.infoModalText, { color: textSecondary }]}>
                  Sehr lange Mehrtages-Dauern werden dabei verworfen.
                </Text>
                {autoFixPreview && (
                  <Text style={[styles.infoModalHint, { color: textSecondary }]}>
                    Aktueller Vorschlag: {formatShortDayDate(autoFixPreview.fixedEnd)} {formatClockTime(autoFixPreview.fixedEnd)}
                  </Text>
                )}
                <TouchableOpacity
                  style={[styles.infoModalCloseBtn, { backgroundColor: accentColor }]}
                  onPress={() => setShowAutoFixInfoModal(false)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.infoModalCloseBtnText}>Verstanden</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Bottom Bar */}
          <View style={[styles.bottomBar, { borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
            <TouchableOpacity
              style={[styles.doneBtn, { backgroundColor: accentColor }]}
              onPress={() => !isSaving && onClose()}
              activeOpacity={0.7}
            >
              <Text style={styles.doneBtnText}>Fertig</Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      </View>
    </Modal>
  );
}

// ─── Styles ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  panel: {
    borderTopLeftRadius: RADIUS,
    borderTopRightRadius: RADIUS,
    overflow: 'hidden',
    maxHeight: '99%',
    minHeight: 540,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentInner: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  headerSettingsBtn: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 8,
  },
  headerSettingsBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  headerEmoji: {
    fontSize: 28,
    marginBottom: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  summaryCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  summaryRow: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  anomalyCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  anomalyTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  anomalyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  anomalyInfoBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  anomalyInfoBtnText: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 15,
  },
  anomalyText: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
  },
  anomalyBtn: {
    marginTop: 10,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
  anomalyBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  infoModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  infoModalCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  infoModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  infoModalText: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 6,
  },
  infoModalHint: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  infoModalCloseBtn: {
    marginTop: 12,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  infoModalCloseBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  heroCard: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  heroDuoCard: {
    borderRadius: 16,
    paddingVertical: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  heroDuoSide: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  heroDuoDivider: {
    width: StyleSheet.hairlineWidth,
    marginVertical: 4,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    opacity: 0.6,
    marginBottom: 4,
  },
  section: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 20,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 2,
  },
  wakeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 4,
  },
  wakeSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  wakeAddInlineBtn: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  wakeAddInlineBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  noWakeText: {
    fontSize: 13,
    fontWeight: '500',
    opacity: 0.4,
    textAlign: 'center',
    paddingVertical: 10,
  },
  // Bestehende Wachphasen
  wakeCard: {
    borderRadius: 16,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
  },
  wakeCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  wakeCardDuration: {
    fontSize: 13,
    fontWeight: '700',
  },
  wakeCardDeleteIcon: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.4,
  },
  wakeCardDuo: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  wakeCardDuoSide: {
    flex: 1,
    alignItems: 'center',
  },
  wakeCardDuoDivider: {
    width: StyleSheet.hairlineWidth,
    marginVertical: 2,
  },
  wakeCardDuoLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    opacity: 0.6,
    marginBottom: 2,
  },
  wakeCardDuoDate: {
    fontSize: 11,
    fontWeight: '500',
    opacity: 0.6,
    textTransform: 'capitalize',
    marginBottom: 4,
  },
  // Neues Wachphasen-Formular
  newWakeForm: {
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: 16,
    marginBottom: 10,
    gap: 2,
  },
  newWakeFormLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  newWakeVonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  newWakeVonDate: {
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.7,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  newWakeInnerDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 10,
  },
  newWakeStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  newWakeStepperLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  newWakeStepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  newWakeStepBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newWakeStepBtnText: {
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 26,
  },
  newWakeStepValue: {
    fontSize: 17,
    fontWeight: '700',
    minWidth: 64,
    textAlign: 'center',
    fontVariant: ['tabular-nums'] as any,
  },
  newWakeBtns: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  newWakeCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  newWakeCancelText: { fontSize: 14, fontWeight: '600' },
  newWakeConfirmBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  newWakeConfirmText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  deleteNightBtn: {
    marginTop: 10,
    marginBottom: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: 'rgba(232,160,130,0.08)',
  },
  deleteNightBtnText: {
    color: '#D25C43',
    fontSize: 14,
    fontWeight: '700',
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  doneBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
