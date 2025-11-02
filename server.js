// ✅ server.js — Directional & Memory-Enabled Build for Savi (Nova Web Co)

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const OpenAI = require("openai");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Simple in-memory store per user
const memoryStore = {};

// 🌟 SYSTEM DIRECTIVE: Define Savi's core role and personality
const systemPrompt = `
You are **Savi**, the friendly and professional AI sales assistant for **Nova Web Company** in Phoenix, AZ.

🎯 Your purpose:
- Engage visitors conversationally to learn about their business.
- Guide them toward Nova Web Company’s services: web design, SEO, and digital marketing.
- Gather useful info (name, phone, email, type of business, goals).
- Offer to schedule a consultation or callback.
- Always respond helpfully and naturally, using light humor and friendliness.

🧠 Style:
- Conversational, warm, and human-like. Think "smart and relatable sales rep."
- Use emojis sparingly to add friendliness.
- Keep responses short (2–4 sentences max).
- NEVER mention competitors or compare Nova Web Company to others.
- NEVER disclose details about the owner (Henry Serena) beyond “our founder”.
- If the user goes off-topic, gently bring the conversation back to web design, marketing, or growing their business online.

💬 Example tone:
User: “Hey Savi, do you make websites?”
Savi: “Absolutely! We build fast, beautiful websites that actually bring in traffic. What kind of business do you run?”
`;

// === CHAT ENDPOINT ===
app.post("/chat", async (req, res) => {
  try {
    const { userId, messages } = req.body;

    if (!userId || !messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid request body" });
    }

    // Ensure user memory exists
    if (!memoryStore[userId]) memoryStore[userId] = [
      { role: "system", content: systemPrompt },
    ];

    // Merge new messages into memory
    const fullHistory = [...memoryStore[userId], ...messages];

    // Create OpenAI completion
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: fullHistory,
      temperature: 0.8,
      max_tokens: 400,
    });

    const reply =
      completion.choices?.[0]?.message?.content ||
      "Sorry, something glitched — could you try that again?";

    // Save updated conversation
    memoryStore[userId] = fullHistory.concat([
      { role: "assistant", content: reply },
    ]);

    res.json({ reply });
  } catch (err) {
    console.error("🔥 Chat Error:", err);
    res.status(500).json({
      error: "Server Error",
      details: err.message || err.toString(),
    });
  }
});

// === CLEAR MEMORY ENDPOINT ===
app.post("/clear-memory", (req, res) => {
  const { userId } = req.body;
  if (userId) delete memoryStore[userId];
  res.json({ success: true, message: "Memory cleared" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`🚀 Savi backend running on port ${PORT}`)
);
