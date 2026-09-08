import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canClaimLegacyData } from '../lib/legacy-claim.js';

describe('canClaimLegacyData', () => {
  const user = { id: 2, email: 'owner@watime.click', username: 'dueno' };

  it('denies claim when env is empty', () => {
    assert.equal(canClaimLegacyData(user, {}), false);
  });

  it('allows only the configured owner email', () => {
    assert.equal(canClaimLegacyData(user, { LEGACY_OWNER_EMAIL: 'owner@watime.click' }), true);
    assert.equal(canClaimLegacyData(user, { LEGACY_OWNER_EMAIL: 'otro@watime.click' }), false);
  });

  it('allows the configured username', () => {
    assert.equal(canClaimLegacyData(user, { LEGACY_OWNER_USERNAME: 'dueno' }), true);
    assert.equal(canClaimLegacyData({ ...user, username: 'intruso' }, { LEGACY_OWNER_USERNAME: 'dueno' }), false);
  });
});
