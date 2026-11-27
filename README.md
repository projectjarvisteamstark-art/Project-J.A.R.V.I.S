# Project J.A.R.V.I.S — Iron Man-Inspired AI Assistant

An interactive, voice-enabled AI assistant web application inspired by Tony Stark's J.A.R.V.I.S from the Marvel universe. Talk to it with your voice, get spoken responses, and manage persistent chat sessions — all wrapped in a sleek, dark, "Stark Industries" style interface with an animated Arc Reactor.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [API Endpoints](#api-endpoints)
- [Database Schema](#database-schema)
- [Getting Started](#getting-started)
- [Available Scripts](#available-scripts)
- [UI Components](#ui-components)
- [License](#license)

---

## Overview

**Project J.A.R.V.I.S** is a full-stack conversational AI web app built with Next.js 16. It recreates the experience of Tony Stark's AI butler:

- **Chat panel** — converse with the AI in a terminal-style interface
- **Voice input (ASR)** — speak to JARVIS; wake-word detection strips "Hey Jarvis" from commands
- **Voice output (TTS)** — JARVIS talks back with synthesized speech
- **Arc Reactor HUD** — animated reactor visualization that reacts during AI responses
- **System panel** — status readouts and diagnostics for an authentic Stark-tech feel
- **Persistent sessions** — conversations are stored in SQLite and can be resumed anytime

---

## Features

| Feature | Description |
|---|---|
| 💬 AI Chat | LLM-powered conversation with streaming responses, rendered with Markdown |
| 🎙️ Speech Recognition (ASR) | Record voice commands from the browser, transcribed server-side |
| 🔊 Text-to-Speech (TTS) | Assistant replies spoken aloud, with smart truncation for the TTS API limit |
| 🗣️ Wake Word Support | "Hey Jarvis", "Okay Jarvis", etc. are stripped so you can speak naturally |
| ⚡ Arc Reactor UI | Animated, pulsing reactor visualization at the center of the HUD |
| 🕹️ Quick Commands | One-click prompts: Full diagnostic, Suit status, Schedule, Witty remark, Tech briefing, Workshop ideas |
| 💾 Session Management | Create, switch, and delete chat sessions; full history stored in SQLite |
| 🌗 Dark Stark Theme | Dark, glowing interface with Tailwind CSS 4 and shadcn/ui |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router) + React 19 |
| **Language** | TypeScript 5 |
| **Styling** | Tailwind CSS 4 + shadcn/ui (New York style) + tw-animate-css |
| **UI primitives** | Radix UI + Lucide icons |
| **Animations** | Framer Motion |
| **Database** | Prisma ORM with SQLite (`db/custom.db`) |
| **AI / SDK** | `z-ai-web-dev-sdk` — LLM chat, ASR, and TTS (server-side only) |
| **Server state** | TanStack Query |
| **Client state** | Zustand |
| **Forms** | React Hook Form + Zod |
| **Package manager** | Bun |

---

## Architecture

The app follows a clean 3-layer architecture:

```
Browser (React 19 client components)
        │
        ▼ fetch /api/*
Next.js API Routes (server-side, Node runtime)
        │
        ├──► z-ai-web-dev-sdk  (LLM chat / ASR / TTS)
        │
        └──► Prisma Client  →  SQLite (db/custom.db)
```

**Key principles:**

- All AI SDK calls (`z-ai-web-dev-sdk`) run **only on the backend** via API routes — never client-side
- Chat history is persisted per-conversation in SQLite through Prisma
- The frontend is a single route (`/`) with client components for chat, voice, and HUD panels

---

## Project Structure

```
├── prisma/
│   └── schema.prisma          # Conversation & Message models
├── db/
│   └── custom.db              # SQLite database file
├── src/
│   ├── app/
│   │   ├── page.tsx           # Main JARVIS interface (the only route)
│   │   ├── layout.tsx         # Root layout, theme & Toaster
│   │   ├── globals.css        # Tailwind + custom Stark theme styles
│   │   └── api/
│   │       ├── jarvis/
│   │       │   ├── chat/route.ts      # POST — LLM chat completion
│   │       │   ├── session/route.ts   # GET/POST/DELETE — session management
│   │       │   └── history/route.ts   # GET — messages of a session
│   │       ├── asr/route.ts           # POST — audio → text transcription
│   │       ├── tts/route.ts           # POST — text → speech audio
│   │       └── route.ts               # API health check
│   ├── components/
│   │   ├── jarvis/
│   │   │   ├── chat-panel.tsx     # Chat interface with voice controls
│   │   │   ├── system-panel.tsx   # Status readouts / diagnostics HUD
│   │   │   └── arc-reactor.tsx    # Animated Arc Reactor visualization
│   │   └── ui/                   # shadcn/ui component library (40+ components)
│   ├── hooks/                    # use-toast, use-mobile
│   └── lib/
│       ├── jarvis.ts             # Types, quick commands, wake-word & TTS helpers
│       ├── db.ts                 # Prisma client singleton
│       └── utils.ts              # cn() class merge utility
├── examples/                    # WebSocket demo (frontend + server)
├── public/                       # logo.svg, robots.txt
└── package.json
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/jarvis/chat` | Send a message; returns the assistant's reply (LLM) |
| `GET` | `/api/jarvis/session` | List all chat sessions |
| `POST` | `/api/jarvis/session` | Create a new chat session |
| `DELETE` | `/api/jarvis/session` | Delete a session (cascades to its messages) |
| `GET` | `/api/jarvis/history` | Get all messages for a given session |
| `POST` | `/api/asr` | Upload audio (base64) → returns transcribed text |
| `POST` | `/api/tts` | Send text → returns synthesized speech audio |
| `GET` | `/api` | Health check |

---

## Database Schema

```prisma
model Conversation {
  id        String    @id @default(cuid())
  title     String    @default("New Session")
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  messages  Message[]
}

model Message {
  id             String       @id @default(cuid())
  role           String       // "user" | "assistant"
  content         String
  conversationId  String
  createdAt       DateTime     @default(now())
  conversation    Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
}
```

Deleting a conversation automatically deletes all of its messages (cascade).

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) (recommended) or Node.js 18+
- A configured `z-ai-web-dev-sdk` environment for LLM/ASR/TTS access

### Installation

```bash
# 1. Install dependencies
bun install

# 2. Set up the database
bun run db:push        # push Prisma schema to SQLite
bun run db:generate    # generate Prisma Client

# 3. Start the dev server
bun run dev             # runs on port 3000
```

Open `http://localhost:3000` and start talking to JARVIS.

### Usage Tips

- Click the microphone button and speak — try starting with **"Hey Jarvis…"**
- Use the quick-command buttons for instant prompts (diagnostics, suit status, etc.)
- Enable TTS to hear JARVIS speak his responses out loud
- Create new sessions from the panel; your history is saved automatically

---

## Available Scripts

| Command | Description |
|---|---|
| `bun run dev` | Start Next.js dev server on port 3000 (logs to `dev.log`) |
| `bun run lint` | Run ESLint (Next.js + TypeScript rules) |
| `bun run build` | Production build (standalone output) |
| `bun run start` | Run the production build |
| `bun run db:push` | Push Prisma schema to SQLite |
| `bun run db:generate` | Generate Prisma Client |
| `bun run db:migrate` | Create/apply a development migration |
| `bun run db:reset` | Reset the database |

---

## UI Components

The full shadcn/ui (New York) component set is included under `src/components/ui/`, including: accordion, alert, alert-dialog, aspect-ratio, avatar, breadcrumb, button, calendar, card, carousel, chart, checkbox, collapsible, command, context-menu, dialog, drawer, dropdown-menu, form, hover-card, input, input-otp, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, switch, table, tabs, textarea, toast, toaster, toggle, toggle-group, tooltip, and sonner.

Custom JARVIS components live in `src/components/jarvis/`:

- **`arc-reactor.tsx`** — the animated Arc Reactor centerpiece
- **`chat-panel.tsx`** — the conversation UI with voice input/output controls
- **`system-panel.tsx`** — system status readouts and diagnostics

---

## License

This project is for educational/personal use. J.A.R.V.I.S and all Marvel references belong to their respective owners.

---

> *"Sometimes you gotta run before you can walk."* — Tony Stark
