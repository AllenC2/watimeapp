'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { usePreferences } from './PreferencesProvider';

function pad(value) {
  return String(value).padStart(2, '0');
}

const HOURS_24 = Array.from({ length: 24 }, (_, index) => pad(index));
const HOURS_12 = Array.from({ length: 12 }, (_, index) => String(index + 1));
const MINUTES = Array.from({ length: 60 }, (_, index) => pad(index));

function partsFromValue(value, hour12) {
  const [rawHour, rawMinute] = String(value || '').split(':');
  const hour24 = Number(rawHour);
  const minute = Number(rawMinute);

  if (!value || Number.isNaN(hour24) || Number.isNaN(minute)) {
    return { hour: '', minute: '', period: 'AM' };
  }

  if (!hour12) {
    return { hour: pad(hour24), minute: pad(minute), period: hour24 >= 12 ? 'PM' : 'AM' };
  }

  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour = hour24 % 12 === 0 ? '12' : String(hour24 % 12);
  return { hour, minute: pad(minute), period };
}

function valueFromParts({ hour, minute, period }, hour12) {
  if (hour === '' || minute === '') return '';

  const minuteNum = Number(minute);
  if (Number.isNaN(minuteNum) || minuteNum > 59) return '';

  if (!hour12) {
    const hour24 = Number(hour);
    if (Number.isNaN(hour24) || hour24 > 23) return '';
    return `${pad(hour24)}:${pad(minuteNum)}`;
  }

  const hourNum = Number(hour);
  if (Number.isNaN(hourNum) || hourNum < 1 || hourNum > 12) return '';

  let hour24 = hourNum;
  if (period === 'AM') {
    if (hour24 === 12) hour24 = 0;
  } else if (hour24 !== 12) {
    hour24 += 12;
  }
  return `${pad(hour24)}:${pad(minuteNum)}`;
}

function TimeSelect({ id, label, value, placeholder, options, onChange, open, onOpenChange }) {
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const [menuStyle, setMenuStyle] = useState(null);

  const placeMenu = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const maxH = 220;
    const gap = 4;
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const openUp = spaceBelow < 140 && spaceAbove > spaceBelow;
    const height = Math.min(maxH, openUp ? spaceAbove : spaceBelow);
    setMenuStyle({
      position: 'fixed',
      left: `${rect.left}px`,
      width: `${Math.max(rect.width, 72)}px`,
      zIndex: 80,
      maxHeight: `${Math.max(height, 120)}px`,
      ...(openUp
        ? { bottom: `${window.innerHeight - rect.top + gap}px` }
        : { top: `${rect.bottom + gap}px` }),
    });
  };

  useEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return undefined;
    }

    placeMenu();
    const onPointerDown = (event) => {
      if (
        buttonRef.current?.contains(event.target) ||
        menuRef.current?.contains(event.target)
      ) {
        return;
      }
      onOpenChange(false);
    };
    const onReposition = () => placeMenu();

    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const selected = menuRef.current?.querySelector('[data-selected="true"]');
    selected?.scrollIntoView({ block: 'center' });
  }, [open, value]);

  return (
    <div className="time-select">
      <button
        ref={buttonRef}
        id={id}
        type="button"
        className="time-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => onOpenChange(!open)}
      >
        <span data-placeholder={!value ? 'true' : 'false'}>{value || placeholder}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && menuStyle ? (
        <ul
          ref={menuRef}
          className="time-select-menu"
          role="listbox"
          aria-label={label}
          style={menuStyle}
        >
          {options.map((option) => (
            <li key={option} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={option === value}
                data-selected={option === value}
                onClick={() => {
                  onChange(option);
                  onOpenChange(false);
                }}
              >
                {option}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function TimeField({ id, value, onChange, hour12, required }) {
  const { t } = usePreferences();
  const [draft, setDraft] = useState(() => partsFromValue(value, hour12));
  const [openSelect, setOpenSelect] = useState(null);
  const previousValue = useRef(value);
  const hours = hour12 ? HOURS_12 : HOURS_24;

  useEffect(() => {
    const hadValue = Boolean(previousValue.current);
    previousValue.current = value;

    if (value) {
      setDraft(partsFromValue(value, hour12));
      return;
    }

    if (hadValue) {
      setDraft(partsFromValue('', hour12));
    }
  }, [value, hour12]);

  const commit = (patch) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    onChange(valueFromParts(next, hour12));
  };

  return (
    <div className="time-field" data-hour12={hour12 ? 'true' : 'false'}>
      <input
        id={id}
        type="text"
        tabIndex={-1}
        className="sr-only"
        value={value}
        required={required}
        onChange={() => {}}
        aria-hidden="true"
      />
      <TimeSelect
        label={t('message.time')}
        value={draft.hour}
        placeholder={hour12 ? 'hh' : 'HH'}
        options={hours}
        open={openSelect === 'hour'}
        onOpenChange={(next) => setOpenSelect(next ? 'hour' : null)}
        onChange={(hour) => commit({ hour })}
      />
      <span className="time-field-sep" aria-hidden="true">
        :
      </span>
      <TimeSelect
        label={t('message.minutes')}
        value={draft.minute}
        placeholder="mm"
        options={MINUTES}
        open={openSelect === 'minute'}
        onOpenChange={(next) => setOpenSelect(next ? 'minute' : null)}
        onChange={(minute) => commit({ minute })}
      />
      {hour12 ? (
        <div className="time-field-period" role="group" aria-label={t('message.ampm')}>
          <button
            type="button"
            data-active={draft.period === 'AM'}
            onClick={() => commit({ period: 'AM' })}
          >
            AM
          </button>
          <button
            type="button"
            data-active={draft.period === 'PM'}
            onClick={() => commit({ period: 'PM' })}
          >
            PM
          </button>
        </div>
      ) : null}
    </div>
  );
}
