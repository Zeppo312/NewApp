import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { Platform } from 'react-native';
import NativeDateTimePicker, {
  DateTimePickerAndroid,
  type AndroidNativeProps,
  type IOSNativeProps,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';

export type { DateTimePickerEvent } from '@react-native-community/datetimepicker';

type Props = Omit<IOSNativeProps, 'mode' | 'display'> &
  Omit<AndroidNativeProps, 'mode' | 'display' | 'design'> & {
    mode?: 'date' | 'time' | 'datetime';
    display?: IOSNativeProps['display'] | AndroidNativeProps['display'];
  };

/** Mount conditionally. Android opens one dialog sequence per mount/mode. */
export default function DateTimePicker(props: Props) {
  if (Platform.OS === 'android') return <AndroidDateTimePicker {...props} />;
  return <NativeDateTimePicker {...props as IOSNativeProps} />;
}

function AndroidDateTimePicker(props: Props) {
  const latest = useRef(props);
  useLayoutEffect(() => { latest.current = props; });
  const mode = props.mode ?? 'date';

  useEffect(() => {
    const initial = latest.current;
    let draft = new Date(initial.value);
    let disposed = false;
    let finished = false;
    let activeMode: 'date' | 'time' | null = null;

    const finish = (type: DateTimePickerEvent['type'], date?: Date, utcOffset?: number) => {
      if (disposed || finished) return;
      finished = true;
      activeMode = null;
      const callbacks = latest.current;
      const timestamp = (date ?? initial.value).getTime();
      const event: DateTimePickerEvent = {
        type,
        nativeEvent: { timestamp, utcOffset: utcOffset ?? -(date ?? initial.value).getTimezoneOffset() },
      };
      if (type === 'set' && date && callbacks.onValueChange) {
        callbacks.onValueChange(event, date);
      } else if (type === 'dismissed' && callbacks.onDismiss) {
        callbacks.onDismiss();
      } else if (type === 'neutralButtonPressed' && callbacks.onNeutralButtonPress) {
        callbacks.onNeutralButtonPress();
      } else {
        // Never return the old date on cancel: some callers commit any provided date.
        callbacks.onChange?.(event, date);
      }
    };

    const onError = (error: Error) => {
      if (disposed || finished) return;
      if (latest.current.onError) latest.current.onError(error);
      else console.error('Failed to open date/time picker:', error);
      finish('dismissed');
    };

    const open = (step: 'date' | 'time') => {
      activeMode = step;
      try {
        DateTimePickerAndroid.open({
          ...initial,
          value: draft,
          mode: step,
          display: initial.display === 'spinner' ? 'spinner' : 'default',
          // Android's native time dialog does not support date bounds.
          minimumDate: step === 'date' ? initial.minimumDate : undefined,
          maximumDate: step === 'date' ? initial.maximumDate : undefined,
          onChange: undefined,
          onValueChange: (event, picked) => {
            if (disposed || finished || activeMode !== step) return;
            activeMode = null;
            if (mode === 'datetime' && step === 'date') {
              draft = new Date(picked);
              draft.setHours(initial.value.getHours(), initial.value.getMinutes(), initial.value.getSeconds(), initial.value.getMilliseconds());
              open('time');
              return;
            }
            let result = new Date(picked);
            if (mode === 'datetime') {
              result = new Date(draft);
              result.setHours(picked.getHours(), picked.getMinutes(), picked.getSeconds(), picked.getMilliseconds());
              if (initial.minimumDate && result < initial.minimumDate) result = new Date(initial.minimumDate);
              if (initial.maximumDate && result > initial.maximumDate) result = new Date(initial.maximumDate);
            }
            finish('set', result, event.nativeEvent.utcOffset);
          },
          onDismiss: () => { if (activeMode === step) finish('dismissed'); },
          onNeutralButtonPress: () => { if (activeMode === step) finish('neutralButtonPressed'); },
          onError,
        });
      } catch (error) {
        onError(error instanceof Error ? error : new Error(String(error)));
      }
    };

    open(mode === 'time' ? 'time' : 'date');
    return () => {
      disposed = true;
      // Only dismiss an open native mode, never the iOS-only "datetime" mode.
      if (activeMode) {
        void DateTimePickerAndroid.dismiss(activeMode).catch(error => {
          console.error('Failed to dismiss date/time picker:', error);
        });
      }
    };
    // Value/callback changes while a dialog is open must not open it again.
  }, [mode]);

  return null;
}
