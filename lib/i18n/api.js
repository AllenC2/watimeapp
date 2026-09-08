import { NextResponse } from 'next/server';
import { messages } from './messages';

export class ApiError extends Error {
  constructor(code, extra = {}) {
    super(code);
    this.code = code;
    this.extra = extra;
  }
}

export function jsonError(code, status, extra = {}) {
  return NextResponse.json(
    { error: messages.es[code] || code, code, ...extra },
    { status }
  );
}
