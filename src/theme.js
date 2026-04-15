import { useMemo } from 'react';
import { DarkTheme as NavigationDarkTheme, DefaultTheme as NavigationDefaultTheme } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import lightTheme from '../theme/lightTheme';

export const colors = {
  primary: lightTheme.primary,
  background: lightTheme.background,
  surface: lightTheme.card,
  textPrimary: lightTheme.text,
  textSecondary: lightTheme.secondaryText,
  border: lightTheme.border,
  error: lightTheme.error,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
};

export const typography = {
  title: { fontSize: 24, fontWeight: '700' },
  heading: { fontSize: 18, fontWeight: '600' },
  body: { fontSize: 14 },
  small: { fontSize: 12 },
};

export function getShadow(theme) {
  return {
    shadowColor: theme.shadow,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  };
}

export const shadow = getShadow(lightTheme);

export function useAppTheme() {
  return useTheme();
}

export function createThemedStyles(factory) {
  return function useThemedStyles() {
    const { theme, isDark } = useTheme();

    return useMemo(
      () =>
        factory({
          theme,
          isDark,
          spacing,
          radius,
          typography,
          shadow: getShadow(theme),
        }),
      [theme, isDark]
    );
  };
}

export function getNavigationTheme(theme, isDark) {
  const baseTheme = isDark ? NavigationDarkTheme : NavigationDefaultTheme;

  return {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      background: theme.background,
      card: theme.card,
      text: theme.text,
      border: theme.border,
      primary: theme.primary,
      notification: theme.primary,
    },
  };
}
