// server.js
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import OpenAI from "openai";

const app = express();
app.use(cors());
app.use(bodyParser.json());

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Simple in-memory store (can be replaced with database later)
let userMemory = {}; // { userId: [messageObjects] }

app.post("/chat", async (req, res) => {
  try {
    const { userId, messages } = req.body;

    if (!userId) return res.status(400).json({ error: "Missing userId" });

    // Merge past memory with new messages
    if (!userMemory[userId]) userMemory[userId] = [];
    const fullHistory = [...userMemory[userId], ...messages];

    // Generate response
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: fullHistory,
    });

    const reply = completion.choices[0].message.content;

    // Store latest interaction in memory
    userMemory[userId] = fullHistory.concat([
      { role: "assistant", content: reply },
    ]);

    res.json({ reply });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Optional route to clear user memory
app.post("/clear-memory", (req, res) => {
  const { userId } = req.body;
  delete userMemory[userId];
  res.json({ status: "Memory cleared" });
});

app.listen(3000, () => console.log("✅ Savi backend running on port 3000"));
