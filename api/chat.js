// /api/chat.js — Vercel serverless, ESM, with CORS & OPTIONS
import OpenAI from "openai";

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Body might be a string depending on client — normalize it
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { userId, messages } = body || {};

    if (!userId || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid request body" });
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.8,
      max_tokens: 400
    });

    const reply =
      completion?.choices?.[0]?.message?.content ||
      "Sorry, something went wrong. Try again.";

    return res.status(200).json({ reply });
  } catch (error) {
    console.error("🔥 /api/chat error:", error);
    return res.status(500).json({
      error: "Server crash",
      details: error?.message || "Unknown"
    });
  }
}
