import express from "express";
import OpenAI from "openai";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

console.log("🔍 OpenAI Key Loaded?:", process.env.OPENAI_API_KEY ? "✅ Yes" : "❌ No");

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post("/chat", async (req, res) => {
  const { message } = req.body;

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are Savi, Nova Web’s friendly website AI assistant." },
      { role: "user", content: message }
    ],
  });

  res.json({ reply: completion.choices[0].message.content });
});

app.listen(3000, () => console.log("✅ Savi API running on port 3000"));
