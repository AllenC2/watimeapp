import { NextResponse } from 'next/server';
import { processScheduledMessages } from '../../../lib/scheduler';

export async function GET() {
  try {
    const sentCount = await processScheduledMessages();
    return NextResponse.json({ success: true, processed: sentCount });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
