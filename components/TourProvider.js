'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter } from 'next/navigation';
import { usePreferences } from './PreferencesProvider';

const TourContext = createContext(null);

const STEPS = [
  { id: 'whatsapp', route: '/' },
  { id: 'account', route: '/', openMenu: true },
  { id: 'calendar', route: '/' },
  { id: 'new-message', route: '/' },
  { id: 'settings', route: '/configuracion' },
];

function findVisible(id) {
  const nodes = document.querySelectorAll(`[data-tour="${id}"]`);
  for (const el of nodes) {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    if (rect.width < 2 || rect.height < 2) continue;
    return el;
  }
  return null;
}

function visibleTarget(id) {
  return findVisible(id) || (id === 'whatsapp' ? findVisible('account') : null);
}

async function waitForTarget(id, timeoutMs = 2800) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const el = visibleTarget(id);
    if (el) return el;
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  return null;
}

function padRect(rect, padding) {
  return {
    top: Math.max(8, rect.top - padding),
    left: Math.max(8, rect.left - padding),
    width: Math.min(window.innerWidth - 16, rect.width + padding * 2),
    height: Math.min(window.innerHeight - 16, rect.height + padding * 2),
  };
}

export function TourProvider({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = usePreferences();
  const [index, setIndex] = useState(-1);
  const [spot, setSpot] = useState(null);

  const active = index >= 0;
  const step = active ? STEPS[index] : null;

  const stop = useCallback(() => {
    setIndex(-1);
    setSpot(null);
  }, []);

  const startTour = useCallback(() => {
    setSpot(null);
    setIndex(0);
  }, []);

  const next = useCallback(() => {
    setIndex((current) => {
      if (current < 0) return current;
      if (current >= STEPS.length - 1) return -1;
      return current + 1;
    });
  }, []);

  const back = useCallback(() => {
    setIndex((current) => (current > 0 ? current - 1 : current));
  }, []);

  useEffect(() => {
    if (!step) return undefined;
    if (pathname !== step.route) {
      router.push(step.route);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      const el = await waitForTarget(step.id);
      if (cancelled) return;
      if (!el) {
        setIndex((current) => {
          if (current < 0) return current;
          if (current >= STEPS.length - 1) return -1;
          return current + 1;
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, router, step]);

  useEffect(() => {
    if (!step || pathname !== step.route) {
      setSpot(null);
      return undefined;
    }

    let scrolled = false;
    const measure = () => {
      const el = visibleTarget(step.id);
      if (!el) {
        setSpot(null);
        return;
      }
      if (!scrolled) {
        el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        scrolled = true;
      }
      setSpot(padRect(el.getBoundingClientRect(), step.id === 'calendar' ? 10 : 8));
    };

    measure();
    const timer = window.setInterval(measure, 180);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [pathname, step]);

  useEffect(() => {
    if (!active) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') stop();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active, stop]);

  const value = useMemo(
    () => ({
      active,
      stepId: step?.id || null,
      openAccountMenu: step?.openMenu === true,
      startTour,
      stop,
    }),
    [active, startTour, step, stop]
  );

  const cardStyle = (() => {
    if (typeof window === 'undefined') return {};
    if (!spot) return { top: '28%', left: '50%', transform: 'translateX(-50%)' };
    const width = Math.min(360, window.innerWidth - 24);
    const estimatedHeight = 220;
    const gap = 14;
    let top = spot.top + spot.height + gap;
    const left = Math.min(Math.max(12, spot.left), window.innerWidth - width - 12);
    if (top + estimatedHeight > window.innerHeight - 12) {
      top = Math.max(12, spot.top - estimatedHeight - gap);
    }
    return { top, left, width, transform: 'none' };
  })();

  return (
    <TourContext.Provider value={value}>
      {children}
      {active && typeof document !== 'undefined'
        ? createPortal(
            <div className="tour-root" role="dialog" aria-modal="true" aria-labelledby="tour-title">
              <div className="tour-mask" />
              {spot ? (
                <div
                  className="tour-spot"
                  style={{
                    top: spot.top,
                    left: spot.left,
                    width: spot.width,
                    height: spot.height,
                  }}
                />
              ) : null}
              <div className="tour-card" style={cardStyle}>
                <p className="tour-step">
                  {t('tour.progress', { current: String(index + 1), total: String(STEPS.length) })}
                </p>
                <h2 id="tour-title">{t(`tour.${step.id}.title`)}</h2>
                <p>{t(`tour.${step.id}.body`)}</p>
                <div className="tour-actions">
                  <button type="button" className="nav-btn" onClick={stop}>
                    {t('tour.skip')}
                  </button>
                  <div className="tour-actions-nav">
                    {index > 0 ? (
                      <button type="button" className="nav-btn" onClick={back}>
                        {t('tour.back')}
                      </button>
                    ) : null}
                    <button type="button" className="btn-primary" onClick={next}>
                      {index >= STEPS.length - 1 ? t('tour.done') : t('tour.next')}
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </TourContext.Provider>
  );
}

export function useTour() {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour debe usarse dentro de TourProvider');
  }
  return context;
}
