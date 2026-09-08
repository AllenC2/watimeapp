import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { interpolate, translate } from '../lib/i18n/index.js';
import { messages } from '../lib/i18n/messages.js';

describe('i18n', () => {
  it('interpolates named placeholders', () => {
    assert.equal(interpolate('Caduca en {time}', { time: '14:59' }), 'Caduca en 14:59');
  });

  it('falls back to Spanish for missing keys', () => {
    assert.equal(translate(messages, 'en', 'auth.login'), messages.en['auth.login']);
    assert.equal(translate(messages, 'fr', 'auth.login'), messages.es['auth.login']);
  });
});
