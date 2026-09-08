'use client';

import { PreferencesProvider } from './PreferencesProvider';

export default function AppProviders({ children }) {
  return <PreferencesProvider>{children}</PreferencesProvider>;
}
