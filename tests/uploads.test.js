import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canReadUpload, uploadPathOwnerId } from '../lib/uploads.js';

describe('uploads access', () => {
  it('parses a owned upload path', () => {
    assert.equal(uploadPathOwnerId('/uploads/3/123-ab.jpg'), 3);
    assert.equal(canReadUpload('/uploads/3/123-ab.jpg', 3), true);
    assert.equal(canReadUpload('/uploads/3/123-ab.jpg', 9), false);
  });

  it('rejects traversal and public-looking paths', () => {
    assert.equal(uploadPathOwnerId('/uploads/3/../2/x.jpg'), null);
    assert.equal(uploadPathOwnerId('/uploads/3/foo/bar.jpg'), null);
    assert.equal(uploadPathOwnerId('/logos/watime.svg'), null);
    assert.equal(canReadUpload('/uploads/1/x.jpg', 1), true);
  });
});
