import { useEffect, useRef, useState } from 'react';
import { Vibration } from 'react-native';

import { RestTimer } from '@/components/RestTimer';

interface Props {
  endsAt: number | null;
  onAdd30: () => void;
  onSkip: () => void;
}

/** Counts down to `endsAt` (kept in the draft, so it survives a restart) and vibrates at zero. */
export function LiveRestTimer({ endsAt, onAdd30, onSkip }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const buzzedFor = useRef<number | null>(null);

  useEffect(() => {
    if (!endsAt) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [endsAt]);

  const left = endsAt ? Math.ceil((endsAt - now) / 1000) : 0;

  useEffect(() => {
    if (endsAt && left <= 0 && buzzedFor.current !== endsAt) {
      buzzedFor.current = endsAt;
      Vibration.vibrate([0, 400, 200, 400]);
      onSkip();
    }
  }, [endsAt, left, onSkip]);

  if (!endsAt || left <= 0) return null;
  return <RestTimer secondsLeft={left} onAdd30={onAdd30} onSkip={onSkip} />;
}
