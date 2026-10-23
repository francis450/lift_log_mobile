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
  /** Keyed by exercise name. Missing on servers older than the M3 backend update. */
  exercises?: Record<string, ExerciseInfo>;
  /** Whether Photo, Describe and suggestions can run. Missing on servers older than M5. */
  ai?: { ready: boolean; message: string | null };
  exists: boolean;
}

export interface Checkin {
  name: string;
  week: number;
  checkin_date: string;
  program: string | null;
  weight_kg: number | null;
  waist_cm: number | null;
  forearm_cm: number | null;
  sleep: number | null;
  energy: number | null;
  photo: string | null;
}

export interface CheckinGetResponse {
  week: number;
  checkin: Checkin | null;
  previous_weight_kg: number | null;
  last_measured: { waist: string | null; forearm: string | null };
  due: { waist: boolean; forearm: boolean };
}

export interface CheckinPayload {
  week: number;
  checkin_date: string;
  weight_kg: number;
  waist_cm: number | null;
  forearm_cm: number | null;
  sleep: number | null;
  energy: number | null;
}

export interface ProgressSummary {
  week: number | null;
  sessions: { done: number; planned_to_date: number };
  protein_target_g: number | null;
  protein_days_hit: number;
  protein_by_day: { date: string; protein_g: number | null }[];
  lifts: { label: string; exercise: string; start_kg: number | null; best: { kg: number; amount: number; date: string } | null }[];
  bodyweight: { week: number; kg: number | null }[];
  forearm: { week: number; cm: number | null }[];
}

export interface ReviewStats {
  week: number;
  phase: string | null;
  period: [string, string];
  targets: { kcal: number; protein_g: number };
  sessions: { planned: number; done: number; missed: string[]; items: unknown[] };
  effort: { easy: number; right: number; hard: number; unrated: number };
  food: {
    days_logged: number;
    avg_kcal: number | null;
    avg_protein_g: number | null;
    protein_days_hit: number;
    by_day: { date: string; kcal: number | null; protein_g: number | null }[];
  };
  checkin: {
    weight_kg: number | null;
    weight_change_kg: number | null;
    waist_cm: number | null;
    forearm_cm: number | null;
    sleep: number | null;
    energy: number | null;
  };
  goals: string;
}

export interface PlanChange {
  change_type: 'weight' | 'nutrition' | 'schedule' | 'other';
  title: string;
  why: string;
  exercise: string | null;
  delta_kg: number | null;
  applies_from_week?: number;
  accepted?: boolean;
}

export interface WeeklyReview {
  name: string;
  program: string | null;
  week: number;
  period_start: string | null;
  period_end: string | null;
  stats: ReviewStats;
  went_well: string;
  to_change: string;
  changes: PlanChange[];
  model: string | null;
  generated_at: string | null;
}

export interface EstimateItem {
  food_name: string;
  portion: string;
  kcal: number;
  protein_g: number;
}

export interface EstimateResponse {
  items: EstimateItem[];
  model: string;
}

export interface SuggestionOption {
  title: string;
  why: string;
  items: EstimateItem[];
}

export interface SuggestResponse {
  options: SuggestionOption[];
  /** This meal's share of what's left (older servers don't send it). */
  budget?: { kcal: number; protein_g: number };
  model: string;
}

export interface ExerciseInfo {
  type: 'load' | 'bodyweight' | 'time' | 'distance';
  equipment?: 'barbell' | 'dumbbell' | 'cable' | 'machine' | 'bodyweight' | null;
  /** The equipment's weight step: suggested weights are always a multiple of it. */
  increment_kg: number;
  /** Two dumbbells at once: kg is logged per dumbbell and counted twice in total lifted. */
  pair?: boolean;
  form_url: string | null;
}

export interface Highlight {
  exercise: string;
  sets: { kg: number | null; amount: number }[];
}

export interface MonthSession {
  date: string;
  routine_key: string | null;
  routine_name: string | null;
  sets: number;
  status: 'in_progress' | 'done';
  highlight?: Highlight | null;
}

export interface FoodMonthDay {
  date: string;
  kcal: number;
  protein_g: number;
  entries: number;
  meals: number;
}

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snacks';
export type FoodSource = 'search' | 'custom' | 'describe' | 'photo' | 'suggestion' | 'migrated';

export interface FoodEntry {
  client_id: string;
  meal: Meal;
  food_name: string;
  portion: string;
  qty: number;
  kcal_per_portion: number;
  protein_per_portion: number;
  source: FoodSource;
  added_at: string | null;
}

export interface FoodDay {
  food_date: string;
  client_updated_at: string | null;
  entries: FoodEntry[];
}

export interface FoodItem {
  name: string | null;
  food_name: string;
  portion: string;
  kcal: number;
  protein_g: number;
}

export interface FoodSearchResult {
  recent: FoodItem[];
  mine: FoodItem[];
  library: FoodItem[];
}

export interface HistoryItem {
  date: string;
  week: number | null;
  routine_key: string | null;
  routine_name: string | null;
  status: 'in_progress' | 'done';
  exercise: string;
  sets: {
    set_no: number;
    side?: Side | null;
    kg: number | null;
    amount: number;
    effort: 'easy' | 'right' | 'hard' | null;
    done: boolean;
  }[];
}

export interface SessionPayload {
  session_date: string;
  week: number | null;
  routine_key: string | null;
  routine_name: string | null;
  status: 'in_progress' | 'done';
  started_at: string | null;
  finished_at: string | null;
  note: string;
  client_updated_at: string;
  sets: SetEntry[];
}

/** Cancel workout, as queued for the server: it takes the day's session slot in the outbox, so a pending save is dropped. */
export interface SessionDelete {
  session_date: string;
  delete: true;
  client_updated_at: string;
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

/** Per-side exercises log each set as an L and an R entry sharing a set_no. */
export type Side = 'L' | 'R';

export interface SetEntry {
  exercise: string;
  set_no: number;
  side?: Side | null;
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
    highlight: Highlight | null;
  } | null;
}
