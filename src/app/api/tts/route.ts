import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text: unknown = body?.text;

    if (typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json({ error: "Text is required for speech synthesis." }, { status: 400 });
    }
    if (text.length > 1024) {
      return NextResponse.json(
        { error: "Text exceeds the 1024 character limit for speech synthesis." },
        { status: 400 }
      );
    }

    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    const zai = await ZAI.create();

    const response = await zai.audio.tts.create({
      input: text.trim(),
      voice: "jam", // British gentleman - closest available match to JARVIS
      speed: 0.95, // Slightly slower, calm butler delivery
      response_format: "wav",
      stream: false,
    });

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(new Uint8Array(arrayBuffer));

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": String(buffer.length),
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("TTS error:", error);
    return NextResponse.json({ error: "Speech synthesis failed." }, { status: 500 });
  }
}
