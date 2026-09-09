'use client';

import { PreferencesProvider } from './PreferencesProvider';
import { TourProvider } from './TourProvider';
import WelcomeModal from './WelcomeModal';

export default function AppProviders({ children }) {
  return (
    <PreferencesProvider>
      <TourProvider>
        {children}
        <WelcomeModal />
      </TourProvider>
    </PreferencesProvider>
  );
}
