import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkTheme, lightTheme } from './theme';

type ThemeMode = 'dark' | 'light' | 'system';
type Theme = typeof darkTheme;

interface ThemeContextType {
  theme: Theme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => Promise<void>;
  isDark: boolean;
}

const THEME_KEY = 'app_theme_mode';
const ThemeContext = createContext<ThemeContextType>({
  theme: darkTheme,
  mode: 'system',
  setMode: async () => {},
  isDark: true,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const deviceScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((val) => {
      if (val === 'dark' || val === 'light' || val === 'system') {
        setModeState(val);
      }
    });
  }, []);

  const setMode = async (newMode: ThemeMode) => {
    setModeState(newMode);
    await AsyncStorage.setItem(THEME_KEY, newMode);
  };

  const isDark =
    mode === 'dark' ? true :
    mode === 'light' ? false :
    deviceScheme === 'dark';

  const theme = isDark ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ theme, mode, setMode, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
