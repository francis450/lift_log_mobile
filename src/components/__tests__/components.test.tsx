import { fireEvent, render, screen } from '@testing-library/react-native';

import { Meter, meterCaption } from '../Meter';
import { SetRating } from '../SetRating';
import { Toggle } from '../Toggle';
import { WeekStrip } from '../WeekStrip';

describe('Meter', () => {
  it('shows value over target', async () => {
    await render(<Meter variant="calories" value={720} target={2200} caption />);
    expect(screen.getByText('1,480 of 2,200 kcal left')).toBeTruthy();
    expect(screen.getByLabelText('Calories: 720 of 2,200 kcal')).toBeTruthy();
  });

  it('captions going over', async () => {
    expect(meterCaption(2350, 2200, 'kcal')).toBe('150 kcal over');
  });
});

describe('WeekStrip', () => {
  it('labels each day for screen readers', async () => {
    await render(
      <WeekStrip
        selected="2026-10-07"
        days={[
          { date: '2026-10-06', trained: true, fed: true },
          { date: '2026-10-07', trained: false, fed: true },
        ]}
      />,
    );
    expect(screen.getByLabelText('Tue 6 Oct: trained, food logged')).toBeTruthy();
    expect(screen.getByText('WED')).toBeTruthy();
  });
});

describe('Toggle', () => {
  it('is a labelled switch', async () => {
    const onChange = jest.fn();
    await render(<Toggle accessibilityLabel="Log dinner" value onChange={onChange} />);
    await fireEvent.press(screen.getByRole('switch', { name: 'Log dinner' }));
    expect(onChange).toHaveBeenCalledWith(false);
  });
});

describe('SetRating', () => {
  it('picks reps left, and clears on a second tap', async () => {
    const onRir = jest.fn();
    const { rerender } = await render(<SetRating rir={null} warmup={false} onRir={onRir} onWarmup={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('Reps left 2: 2 more reps left'));
    expect(onRir).toHaveBeenLastCalledWith(2);
    await rerender(<SetRating rir={2} warmup={false} onRir={onRir} onWarmup={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('Reps left 2: 2 more reps left'));
    expect(onRir).toHaveBeenLastCalledWith(null);
  });

  it('hides the numbers on a warm-up', async () => {
    const onWarmup = jest.fn();
    const { rerender } = await render(<SetRating rir={null} warmup={false} onRir={jest.fn()} onWarmup={onWarmup} />);
    await fireEvent.press(screen.getByLabelText('Warm-up set'));
    expect(onWarmup).toHaveBeenLastCalledWith(true);
    await rerender(<SetRating rir={null} warmup onRir={jest.fn()} onWarmup={onWarmup} />);
    expect(screen.queryByLabelText('Reps left 0: nothing left, or missed a rep')).toBeNull();
  });
});
