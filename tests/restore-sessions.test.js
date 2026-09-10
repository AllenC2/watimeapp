import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { listRestorableUserIds } from '../lib/legacy-migrate.js';

describe('listRestorableUserIds', () => {
  it('returns only user folders that have creds.json', () => {
    const cwd = process.cwd();
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'watime-auth-'));
    try {
      process.chdir(tmp);
      const root = path.join(tmp, 'auth_info_baileys');
      fs.mkdirSync(path.join(root, 'user-2'), { recursive: true });
      fs.mkdirSync(path.join(root, 'user-9'), { recursive: true });
      fs.mkdirSync(path.join(root, 'user-3'), { recursive: true });
      fs.mkdirSync(path.join(root, 'not-a-user'), { recursive: true });
      fs.writeFileSync(path.join(root, 'user-2', 'creds.json'), '{}');
      fs.writeFileSync(path.join(root, 'user-9', 'creds.json'), '{}');
      fs.writeFileSync(path.join(root, 'not-a-user', 'creds.json'), '{}');
      assert.deepEqual(listRestorableUserIds(), [2, 9]);
    } finally {
      process.chdir(cwd);
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
