import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { isSupabaseConfigured } from '../lib/supabase';
import { defaultSettings, getSettings } from '../services/content';
import type { SiteSettings } from '../types/content';

interface SettingsState { settings: SiteSettings; loading: boolean; error: string | null; configured: boolean }
const SettingsContext = createContext<SettingsState>({ settings: defaultSettings, loading: false, error: null, configured: isSupabaseConfigured });

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SettingsState>({ settings: defaultSettings, loading: isSupabaseConfigured, error: null, configured: isSupabaseConfigured });
  useEffect(() => {
    let active = true;
    getSettings().then((settings) => {
      if (active) setState({ settings, loading: false, error: null, configured: isSupabaseConfigured });
    }).catch((error: unknown) => {
      if (active) setState({ settings: defaultSettings, loading: false, error: error instanceof Error ? error.message : 'Unable to load website settings.', configured: isSupabaseConfigured });
    });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!state.settings.favicon_url) return;
    try {
      const parsed = new URL(state.settings.favicon_url, window.location.origin);
      if (!['http:', 'https:'].includes(parsed.protocol)) return;
      const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]') ?? document.createElement('link');
      icon.rel = 'icon';
      icon.href = parsed.href;
      if (!icon.parentNode) document.head.appendChild(icon);
    } catch {
      // Keep the bundled favicon if the admin-entered URL is malformed.
    }
  }, [state.settings.favicon_url]);
  return <SettingsContext.Provider value={state}>{children}</SettingsContext.Provider>;
}

export function useSettings() { return useContext(SettingsContext); }
