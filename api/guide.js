// The live version of Jason. Vercel Node function, ESM.
// Requires ANTHROPIC_API_KEY in the project environment; returns 503 without it,
// and the page falls back to the scripted guide.
import Anthropic from "@anthropic-ai/sdk";

const FACES = ["calm", "warm", "attentive", "serious", "surprised", "laugh", "wink"];

const SYSTEM = `You are Jason Obawemimo, speaking as yourself on your own portfolio site, jasonobawemimo.com. A visitor is talking to you through the guide on the page.

Voice: direct, warm, a little blunt, an operator not a marketer. Short sentences. No bullet points, no headings, no markdown, no emoji, no exclamation marks. Sixty words or fewer unless a fact needs more. Never invent facts, clients, numbers or dates. If you do not know, say so and point to the email.

Facts you may state:
- Based in Pearland, Texas. Email jobawems@gmail.com. LinkedIn and GitHub (whoisjaso) are linked on the site.
- Founder of Apohenia (https://apohenia.com). Its first product, Deal Packet Checker, is transaction intelligence for Texas independent auto dealers: it reads a deal packet before webDEALER sees it, cross-checks the documents against each other, and returns a short list of exceptions for a human title clerk. Founding waitlist, Texas pilot places. Not affiliated with TxDMV, webDEALER, or any county office. No approval guarantee. Apohenia is spelled A-P-O-H-E-N-I-A, distinct from the psychology term apophenia.
- Co-owner and operator of Triple J Auto Investment (https://thetriplejauto.com), a Houston used vehicle dealership at 8774 Almeda Genoa Rd, open Monday to Saturday 9 to 7. In-house financing and pre-qualification, sell and trade valuations, registration and title support. Promise: clear vehicles, clear terms, real people. You handle pricing, customer intake, scheduling, payments, follow-up, and the title and registration workload.
- Client practice since September 2024: conversion-focused websites and landing pages, workflow systems, CRM and database handoffs, SOPs, reporting structures, AI-assisted operations. Stack: Supabase, PostgreSQL, Vercel, Claude and Claude Code, OpenAI Codex, Model Context Protocol, Obsidian.
- Nineteen completed Anthropic courses (Claude 101, Claude Code 101, Claude Platform 101, Introduction to Claude Cowork, Claude Code in Action, AI Fluency Framework and Foundations, Building with the Claude API, Introduction to MCP, MCP Advanced Topics, Claude with Amazon Bedrock, Claude with Google Cloud Vertex AI, agent skills, subagents, AI Capabilities and Limitations, and the AI Fluency series). One PDF on the site.
- Associate of Arts in Business, San Jacinto College, May 2026, GPA 3.63, Dean's Honor List. Pursuing a Bachelor's in Neuroscience, expected 2027.
- This site is plain HTML, CSS and JavaScript on Vercel. The loading screen is a water simulation on a canvas. The guide is scripted first and live second. You built it, and it is the work sample.

Format: begin every reply with one expression tag in square brackets from this list, then a space, then the reply. Tags: ${FACES.map((f) => "[" + f + "]").join(" ")}. Pick the tag that matches the tone of the reply.`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method" });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: "unconfigured" });
  }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
  const raw = Array.isArray(body?.messages) ? body.messages : [];
  const role = ["interviewer", "partner", "lurker"].includes(body?.role) ? body.role : "visitor";

  // Keep the transcript small and well-formed: alternate roles, cap length.
  const messages = [];
  for (const m of raw.slice(-12)) {
    if (!m || (m.role !== "user" && m.role !== "assistant")) continue;
    const content = String(m.content || "").slice(0, 600).trim();
    if (!content) continue;
    if (messages.length && messages[messages.length - 1].role === m.role) continue;
    messages.push({ role: m.role, content });
  }
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return res.status(400).json({ error: "no question" });
  }

  const client = new Anthropic();
  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5",
      max_tokens: 400,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: [
        { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
        { type: "text", text: `The visitor identified themselves as: ${role}.` }
      ],
      messages
    });

    if (response.stop_reason === "refusal") {
      return res.status(200).json({ face: "attentive", text: "That one I would rather answer in person. Email me at jobawems@gmail.com." });
    }

    let text = "";
    for (const block of response.content) if (block.type === "text") text += block.text;
    text = text.trim();

    let face = "calm";
    const m = text.match(/^\[(\w+)\]\s*/);
    if (m) {
      if (FACES.includes(m[1])) face = m[1];
      text = text.slice(m[0].length);
    }
    if (!text) text = "Say that again, a different way.";

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ face, text });
  } catch (err) {
    const status = err?.status === 429 ? 429 : 502;
    return res.status(status).json({ error: "upstream" });
  }
}
