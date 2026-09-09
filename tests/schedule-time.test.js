import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  fromDateAndTime,
  isScheduledDue,
  isScheduledInPast,
  isScheduledTooSoon,
  parseScheduledDate,
  soonestScheduleParts,
} from '../lib/schedule-time.js';

describe('schedule-time', () => {
  it('builds a local datetime string', () => {
    assert.equal(fromDateAndTime('2026-09-08', '14:30'), '2026-09-08T14:30:00');
  });

  it('parses naive datetimes as host civil time when no zone is given', () => {
    const date = parseScheduledDate('2026-09-08T10:15:00');
    assert.equal(date.getFullYear(), 2026);
    assert.equal(date.getMonth(), 8);
    assert.equal(date.getDate(), 8);
    assert.equal(date.getHours(), 10);
    assert.equal(date.getMinutes(), 15);
  });

  it('marks past and due times in the host zone when none is given', () => {
    const now = new Date(2026, 8, 8, 12, 0, 0);
    assert.equal(isScheduledInPast('2026-09-08T11:59:00', now), true);
    assert.equal(isScheduledDue('2026-09-08T12:00:00', now), true);
    assert.equal(isScheduledDue('2026-09-08T12:00:01', now), false);
  });

  it('interprets naive datetimes in the user time zone', () => {
    const date = parseScheduledDate('2026-09-08T14:00:00', 'America/Mexico_City');
    assert.equal(date.toISOString(), '2026-09-08T20:00:00.000Z');
  });

  it('does not treat later local times as past on a UTC server', () => {
    const now = new Date('2026-09-08T19:30:00.000Z');
    assert.equal(isScheduledInPast('2026-09-08T14:00:00', now, 'America/Mexico_City'), false);
    assert.equal(isScheduledInPast('2026-09-08T13:20:00', now, 'America/Mexico_City'), true);
  });

  it('adds a minimum offset for the soonest schedule', () => {
    const now = new Date(2026, 8, 8, 10, 0, 0);
    assert.deepEqual(soonestScheduleParts(now, 1), { date: '2026-09-08', time: '10:01' });
    assert.deepEqual(soonestScheduleParts(now, 10), { date: '2026-09-08', time: '10:10' });
  });

  it('rejects times less than one minute ahead', () => {
    const now = new Date(2026, 8, 8, 10, 0, 0);
    assert.equal(isScheduledTooSoon('2026-09-08T10:00:30', now), true);
    assert.equal(isScheduledTooSoon('2026-09-08T10:01:00', now), false);
  });
});
