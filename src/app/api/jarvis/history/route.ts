import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    let conversation = await db.conversation.findFirst({
      orderBy: { updatedAt: "desc" },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    if (!conversation) {
      conversation = await db.conversation.create({
        data: { title: "Jarvis Session" },
        include: { messages: true },
      });
    }

    return NextResponse.json({
      conversationId: conversation.id,
      messages: conversation.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("History load error:", error);
    return NextResponse.json({ error: "Could not load history." }, { status: 500 });
  }
}
