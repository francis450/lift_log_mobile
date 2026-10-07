// Every color, font and radius in one place (docs/02). A dark theme would be a second `colors` object.

export const colors = {
  bg: '#EEF1F5',
  surface: '#FFFFFF',
  surface2: '#F5F7FA',
  track: '#E6EAF0',
  line: '#D6DCE5',
  lineStrong: '#B9C2CF',
  ink: '#16202C',
  ink2: '#4A5667',
  ink3: '#5F6B7E',
  accent: '#2350A8',
  accentSoft: '#E3EBFA',
  accentOnDark: '#9DBBF2',
  up: '#1D7A4A',
  upSoft: '#E2F3EA',
  hold: '#8A5A00',
  holdSoft: '#FBF0D9',
  danger: '#A1271E',
  dangerLine: '#E8B4AE',
  scrim: '#5A6472',
  toggleOff: '#C9D0DA',
  onDarkMuted: '#C9D2DE',
  white: '#FFFFFF',
} as const;

export const phaseColors: Record<string, string> = {
  build: colors.accent,
  deload: '#B9C2CF',
  strength: '#1D6B5F',
  peak: '#8A5A00',
  test: colors.ink,
};

export const fonts = {
  display: 'BarlowCondensed_700Bold',
  displaySemi: 'BarlowCondensed_600SemiBold',
  body: 'IBMPlexSans_400Regular',
  bodyMedium: 'IBMPlexSans_500Medium',
  bodySemi: 'IBMPlexSans_600SemiBold',
  mono: 'IBMPlexMono_500Medium',
} as const;

export const radii = {
  card: 20,
  inner: 14,
  input: 12,
  chip: 8,
  sheet: 28,
  button: 16,
} as const;

export const space = {
  screen: 20,
  card: 16,
  gap: 12,
} as const;

export const MIN_TAP = 44;

export const type = {
  screenTitle: { fontFamily: fonts.display, fontSize: 34, lineHeight: 36, color: colors.ink },
  pushedTitle: { fontFamily: fonts.display, fontSize: 26, lineHeight: 30, color: colors.ink },
  cardTitle: { fontFamily: fonts.display, fontSize: 28, lineHeight: 30, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.ink },
  bodyMedium: { fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 22, color: colors.ink },
  secondary: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.ink2 },
  eyebrow: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.96,
    textTransform: 'uppercase' as const,
    color: colors.ink3,
  },
  mono: { fontFamily: fonts.mono, fontSize: 15, color: colors.ink },
} as const;
