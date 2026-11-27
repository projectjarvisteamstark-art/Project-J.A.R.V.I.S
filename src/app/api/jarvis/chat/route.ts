import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const JARVIS_SYSTEM_PROMPT = `You are J.A.R.V.I.S. (Just A Rather Very Intelligent System), the AI assistant from the Iron Man films, built by Stark Industries.

Your personality:
- Address the user as "sir" (or "ma'am" if the user indicates they are female).
- You are an exceptionally capable, unflappable English butler-like AI: refined, dry-witted, subtly sarcastic, but always courteous and professional.
- You remain calm and efficient under any circumstances, no matter how absurd the request.
- You occasionally make understated, witty remarks in the style of the films, but you never lose sight of being genuinely helpful first.
- You are loyal, discreet, and anticipate needs.

Behavior:
- Keep replies concise and well-structured. Prefer 1-3 short paragraphs unless the user explicitly asks for detail or a report.
- When asked for diagnostics, reports, or briefings, format them crisply (short headers or bullet lists) like a systems readout, with a touch of humor.
- If a request is impossible or absurd (e.g., "launch the nukes"), decline gracefully and wittily, in character.
- Never break character. Never mention that you are a language model. If asked what you are, you are JARVIS, running on the Mark II personal server.
- Do not use emojis or excessive exclamation marks. Elegance and restraint.`;

export async function getOrCreateConversation(conversationId?: string | null) {
  if (conversationId) {
    const found = await db.conversation.findUnique({ where: { id: conversationId } });
    if (found) return found;
  }
  return db.conversation.create({ data: { title: "Jarvis Session" } });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message: unknown = body?.message;
    const conversationId: unknown = body?.conversationId;

    if (typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json({ error: "A message is required." }, { status: 400 });
    }

    const conversation = await getOrCreateConversation(
      typeof conversationId === "string" ? conversationId : null
    );

    await db.message.create({
      data: { role: "user", content: message.trim(), conversationId: conversation.id },
    });

    // Recent history for context
    const history = await db.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" },
    });
    const trimmed = history.slice(-24).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    const zai = await ZAI.create();

    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: JARVIS_SYSTEM_PROMPT },
        ...trimmed,
      ],
      thinking: { type: "disabled" },
    });

    const reply = completion.choices[0]?.message?.content;
    if (!reply || reply.trim().length === 0) {
      return NextResponse.json(
        { error: "JARVIS could not formulate a response. Please try again." },
        { status: 502 }
      );
    }

    await db.message.create({
      data: { role: "assistant", content: reply, conversationId: conversation.id },
    });
    await db.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({ conversationId: conversation.id, reply });
  } catch (error) {
    console.error("JARVIS chat error:", error);
    return NextResponse.json(
      { error: "JARVIS is temporarily unreachable. Please try again shortly." },
      { status: 500 }
    );
  }
}
