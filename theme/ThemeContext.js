import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import darkTheme from './darkTheme';
import lightTheme from './lightTheme';

const STORAGE_KEY = '@ja_homehub_theme';

const ThemeContext = createContext({
  theme: lightTheme,
  isDark: false,
  themeName: 'light',
  isThemeReady: false,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [themeName, setThemeName] = useState('light');
  const [isThemeReady, setIsThemeReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadThemePreference = async () => {
      try {
        const storedTheme = await AsyncStorage.getItem(STORAGE_KEY);

        if (isMounted && (storedTheme === 'light' || storedTheme === 'dark')) {
          setThemeName(storedTheme);
        }
      } catch (error) {
        console.error('[ThemeContext] Failed to load theme preference', {
          message: error?.message || 'Unknown AsyncStorage error',
        });
      } finally {
        if (isMounted) {
          setIsThemeReady(true);
        }
      }
    };

    loadThemePreference();

    return () => {
      isMounted = false;
    };
  }, []);

  const toggleTheme = useCallback(async () => {
    const nextTheme = themeName === 'dark' ? 'light' : 'dark';

    try {
      setThemeName(nextTheme);
      await AsyncStorage.setItem(STORAGE_KEY, nextTheme);
    } catch (error) {
      console.error('[ThemeContext] Failed to persist theme preference', {
        nextTheme,
        message: error?.message || 'Unknown AsyncStorage error',
      });
      setThemeName((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'));
    }
  }, [themeName]);

  const value = useMemo(() => {
    const isDark = themeName === 'dark';

    return {
      theme: isDark ? darkTheme : lightTheme,
      isDark,
      themeName,
      isThemeReady,
      toggleTheme,
    };
  }, [isThemeReady, themeName, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
