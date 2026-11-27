import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const audio: unknown = body?.audio;

    if (typeof audio !== "string" || audio.length === 0) {
      return NextResponse.json({ error: "Audio data is required." }, { status: 400 });
    }

    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    const zai = await ZAI.create();

    const response = await zai.audio.asr.create({
      file_base64: audio,
    });

    return NextResponse.json({ text: response.text ?? "" });
  } catch (error) {
    console.error("ASR error:", error);
    return NextResponse.json({ error: "Transcription failed." }, { status: 500 });
  }
}
