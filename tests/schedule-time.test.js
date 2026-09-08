import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  fromDateAndTime,
  isScheduledDue,
  isScheduledInPast,
  parseScheduledDate,
  soonestScheduleParts,
} from '../lib/schedule-time.js';

describe('schedule-time', () => {
  it('builds a local datetime string', () => {
    assert.equal(fromDateAndTime('2026-09-08', '14:30'), '2026-09-08T14:30:00');
  });

  it('parses naive datetimes as local civil time', () => {
    const date = parseScheduledDate('2026-09-08T10:15:00');
    assert.equal(date.getFullYear(), 2026);
    assert.equal(date.getMonth(), 8);
    assert.equal(date.getDate(), 8);
    assert.equal(date.getHours(), 10);
    assert.equal(date.getMinutes(), 15);
  });

  it('marks past and due times', () => {
    const now = new Date('2026-09-08T12:00:00');
    assert.equal(isScheduledInPast('2026-09-08T11:59:00', now), true);
    assert.equal(isScheduledDue('2026-09-08T12:00:00', now), true);
    assert.equal(isScheduledDue('2026-09-08T12:00:01', now), false);
  });

  it('adds a minimum offset for the soonest schedule', () => {
    const now = new Date(2026, 8, 8, 10, 0, 0);
    assert.deepEqual(soonestScheduleParts(now, 10), { date: '2026-09-08', time: '10:10' });
  });
});
