'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
 theme: Theme;
 toggle: () => void;
 setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
 theme: 'dark',
 toggle: () => {},
 setTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
 const [theme, setTheme] = useState<Theme>('dark');
 const [mounted, setMounted] = useState(false);

 useEffect(() => {
 const stored = localStorage.getItem('theme') as Theme | null;
 if (stored) {
 setTheme(stored);
 document.documentElement.className = stored;
 } else {
 document.documentElement.className = 'dark';
 }
 setMounted(true);
 }, []);

 const toggle = () => {
 const next = theme === 'dark' ? 'light' : 'dark';
 setTheme(next);
 document.documentElement.className = next;
 localStorage.setItem('theme', next);
 };

 const setThemeValue = (t: Theme) => {
 setTheme(t);
 document.documentElement.className = t;
 localStorage.setItem('theme', t);
 };

 if (!mounted) return <>{children}</>;

 return (
 <ThemeContext.Provider value={{ theme, toggle, setTheme: setThemeValue }}>
 {children}
 </ThemeContext.Provider>
 );
};
