import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const conversationId: unknown = body?.conversationId;

    if (typeof conversationId === "string" && conversationId) {
      await db.conversation.delete({ where: { id: conversationId } }).catch(() => {
        // Already gone; nothing to clean up.
      });
    }

    const conversation = await db.conversation.create({
      data: { title: "Jarvis Session" },
    });

    return NextResponse.json({ conversationId: conversation.id });
  } catch (error) {
    console.error("Session reset error:", error);
    return NextResponse.json({ error: "Could not start a new session." }, { status: 500 });
  }
}
