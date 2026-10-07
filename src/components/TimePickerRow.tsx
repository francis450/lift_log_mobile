import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';

import { formatTime12 } from '@/lib/dates';

import { SettingsRow } from './SettingsRow';

interface Props {
  label: string;
  /** "HH:MM" */
  value: string;
  onChange: (hhmm: string) => void;
  first?: boolean;
}

function toDate(hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

/** A settings row that opens the system time picker. */
export function TimePickerRow({ label, value, onChange, first }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <SettingsRow label={label} value={formatTime12(value)} onPress={() => setOpen(true)} first={first} />
      {open ? (
        <DateTimePicker
          value={toDate(value)}
          mode="time"
          is24Hour={false}
          onChange={(event, date) => {
            setOpen(false);
            if (event.type === 'set' && date) {
              onChange(`${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`);
            }
          }}
        />
      ) : null}
    </>
  );
}
