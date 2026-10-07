// Shapes of the `message` values returned by lift_log.api.* (docs/04 and the lift_log README).

export type Goal = 'Lose fat, get stronger' | 'Build muscle' | 'Maintain';

export interface Reminders {
  workout: boolean;
  dinner: boolean;
  checkin: boolean;
}

export interface RoutineItem {
  exercise: string;
  sets: number;
  reps: string;
  main?: boolean;
  finisher?: boolean;
  test?: boolean;
  note?: string;
}

export interface Routine {
  key: string;
  name: string;
  tag?: string;
  note?: string;
  rest?: boolean;
  items?: RoutineItem[];
}

export interface ProgramWeek {
  week: number;
  phase: string;
  days: Record<string, Routine | null>;
}

export interface Program {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  session_time: string;
  phases: { key: string; name: string; weeks: [number, number] }[];
  starting_weights_kg: Record<string, number>;
  weeks: ProgramWeek[];
}

export interface Profile {
  user: string;
  weight_kg: number | null;
  height_cm: number | null;
  age: number | null;
  goal: Goal;
  kcal_target: number | null;
  kcal_target_manual: boolean;
  protein_target_g: number | null;
  protein_target_manual: boolean;
  targets_note: string | null;
  session_time: string | null;
  training_days: string;
  time_zone: string;
  active_program: string | null;
  ai_enabled: boolean;
  reminders: Reminders;
  program: Program | null;
  exists: boolean;
}

export type ProfileUpdate = Partial<{
  weight_kg: number | null;
  height_cm: number | null;
  age: number | null;
  goal: Goal;
  kcal_target: number;
  kcal_target_manual: 0 | 1;
  protein_target_g: number;
  protein_target_manual: 0 | 1;
  targets_note: string;
  session_time: string;
  training_days: string;
  time_zone: string;
  active_program: string;
  ai_enabled: 0 | 1;
  reminders: Reminders;
}>;

export interface SignInResponse {
  api_key: string;
  api_secret: string;
  user: string;
  full_name: string;
  has_profile: boolean;
}

export interface SetEntry {
  exercise: string;
  set_no: number;
  kg: number | null;
  amount: number;
  effort: 'easy' | 'right' | 'hard' | null;
  done: boolean;
}

export interface Session {
  name: string;
  session_date: string;
  program: string | null;
  week: number | null;
  routine_key: string | null;
  routine_name: string | null;
  status: 'in_progress' | 'done';
  started_at: string | null;
  finished_at: string | null;
  note: string;
  client_updated_at: string | null;
  sets: SetEntry[];
}

export interface WeekStripDay {
  date: string;
  trained: boolean;
  fed: boolean;
}

export interface TodayResponse {
  date: string;
  week: number | null;
  phase: string | null;
  routine: Routine | null;
  session: Session | null;
  food: { kcal: number; protein_g: number; entries: number };
  targets: { kcal: number; protein_g: number | null };
  targets_note: string | null;
  week_strip: WeekStripDay[];
  last_session: {
    date: string;
    routine_name: string | null;
    highlight: { exercise: string; sets: { kg: number | null; amount: number }[] } | null;
  } | null;
}
