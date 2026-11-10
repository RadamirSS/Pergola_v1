'use client';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { normalizeLocale, translateText, type Locale } from './index';

const Context = createContext<{ locale: Locale; setLocale: (locale: Locale) => void }>({ locale: 'it', setLocale: () => {} });
export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLanguage] = useState<Locale>('it');
  useEffect(() => {
    const query = new URLSearchParams(window.location.search).get('lang');
    let saved: string | null = null;
    try { saved = localStorage.getItem('pergola.locale'); } catch { /* Browser may disable storage. */ }
    setLanguage(normalizeLocale(query ?? saved ?? navigator.language));
  }, []);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  const setLocale = useCallback((language: Locale) => {
    setLanguage(language);
    try { localStorage.setItem('pergola.locale', language); } catch { /* Language still works without persistence. */ }
    const url = new URL(window.location.href); url.searchParams.set('lang', language);
    window.history.replaceState(window.history.state, '', url);
  }, []);
  return <Context.Provider value={{ locale, setLocale }}>{children}</Context.Provider>;
}
export function useI18n() {
  const { locale, setLocale } = useContext(Context);
  const t = useCallback((text: string) => translateText(text, locale), [locale]);
  const localize = (node: ReactNode): ReactNode => typeof node === 'string' ? t(node) : Array.isArray(node) ? node.map(localize) : node;
  return { locale, setLocale, t, localize };
}
