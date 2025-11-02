// ✅ Savi - Simplified GoDaddy Server (direct handshake version)
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const OpenAI = require("openai");
require("dotenv").config();

const app = express();

// Allow all origins (for simplicity)
app.use(cors());
app.use(bodyParser.json());

// Initialize OpenAI
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Memory per user (temporary)
const memory = {};

// Savi's direction (personality and goals)
const systemPrompt = `
You are Savi, Nova Web Company's friendly AI assistant in Phoenix, AZ.
Your mission: talk naturally with website visitors, learn about their business,
and help them understand how Nova Web Company can improve their online presence
through web design, SEO, and marketing. You should be warm, confident, and concise.
Gather the visitor's name, phone, and email when possible, and offer a free consultation.
`;

// === POST /chat ===
app.post("/chat", async (req, res) => {
  try {
    const { userId, messages } = req.body;
    if (!userId || !Array.isArray(messages))
      return res.status(400).json({ error: "Missing or invalid data" });

    // initialize user memory
    if (!memory[userId]) memory[userId] = [{ role: "system", content: systemPrompt }];

    const fullHistory = [...memory[userId], ...messages];

    console.log(`🟣 [${new Date().toISOString()}] Incoming message from ${userId}`);

    // Talk to OpenAI
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: fullHistory,
      temperature: 0.8,
      max_tokens: 400,
    });

    const reply = completion.choices?.[0]?.message?.content || "Sorry, I didn’t catch that.";

    // update memory
    memory[userId] = fullHistory.concat([{ role: "assistant", content: reply }]);

    console.log(`🟢 Reply sent to ${userId}: ${reply.slice(0, 60)}...`);
    res.json({ reply });
  } catch (err) {
    console.error("🔥 Savi Chat Error:", err.message);
    res.status(500).json({ reply: "⚠️ Server issue, please try again later." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`🚀 Savi backend running on port ${PORT}`)
);
