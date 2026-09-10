import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canReadUpload, parseUploadUrl, uploadPathOwnerId } from '../lib/uploads.js';

describe('uploads access', () => {
  it('parses a owned upload path', () => {
    assert.equal(uploadPathOwnerId('/uploads/3/123-ab.jpg'), 3);
    assert.equal(canReadUpload('/uploads/3/123-ab.jpg', 3), true);
    assert.equal(canReadUpload('/uploads/3/123-ab.jpg', 9), false);
  });

  it('accepts the authenticated API path', () => {
    assert.equal(uploadPathOwnerId('/api/uploads/1/1789069934823-hastdo.jpg'), 1);
    assert.deepEqual(parseUploadUrl('/api/uploads/1/1789069934823-hastdo.jpg'), {
      userId: 1,
      filename: '1789069934823-hastdo.jpg',
      pathname: '/uploads/1/1789069934823-hastdo.jpg',
    });
  });

  it('rejects traversal and public-looking paths', () => {
    assert.equal(uploadPathOwnerId('/uploads/3/../2/x.jpg'), null);
    assert.equal(uploadPathOwnerId('/uploads/3/foo/bar.jpg'), null);
    assert.equal(uploadPathOwnerId('/logos/watime.svg'), null);
    assert.equal(canReadUpload('/uploads/1/x.jpg', 1), true);
  });
});
