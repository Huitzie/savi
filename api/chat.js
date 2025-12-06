// ✅ SaviChat Serverless API (Vercel-Compatible, Final 2025 Build)
// Includes: OpenAI chat, in-memory history, Gmail SMTP, lead email, summary + transcript

import OpenAI from "openai";
import nodemailer from "nodemailer";

// ⭐ REQUIRED BY VERCEL — FIXED
export const config = {
  runtime: "nodejs"
};

// === In-memory chat history (temporary per deployment) ===
const memory = {};

const systemPrompt = `
You are Savi, Nova Web Company's friendly AI assistant based in Phoenix, AZ.
Your job:
- Speak naturally and professionally
- Learn about the visitor's business
- Explain Nova Web’s services: web design, hosting, SEO, and marketing
- Politely collect: name, email, phone
Keep responses short (2–4 sentences)
`;

// === OpenAI Client ===
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// === Gmail Transport (App Password Required) ===
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// === Generate Conversation Summary ===
async function makeSummary(history) {
  const formatted = history
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "Summarize the conversation in 4–6 sentences. Focus on lead details and their needs."
      },
      {
        role: "user",
        content: formatted
      }
    ]
  });

  return completion.choices[0].message.content;
}

// === Send Lead Email ===
async function sendLeadEmail(leadInfo, summary, transcript) {
  const { name, email, phone } = leadInfo || {};

  const message = `
🔥 NEW SAVICHAT LEAD

📌 Name: ${name || "Not provided"}
📌 Email: ${email || "Not provided"}
📌 Phone: ${phone || "Not provided"}

------------------------------------------------
📝 SUMMARY
------------------------------------------------
${summary}

------------------------------------------------
📄 FULL TRANSCRIPT
------------------------------------------------
${transcript}
`;

  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to: process.env.ADMIN_EMAIL,
    subject: "🔥 New Lead from SaviChat",
    text: message
  });
}

// === MAIN API HANDLER ===
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(404).json({ error: "Route not found" });
  }

  try {
    const { userId, messages, leadInfo } = req.body;

    if (!userId || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid request body" });
    }

    // Initialize memory for new users
    if (!memory[userId]) {
      memory[userId] = [{ role: "system", content: systemPrompt }];
    }

    const fullHistory = [...memory[userId], ...messages];

    // === Call OpenAI ===
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: fullHistory,
      temperature: 0.7,
      max_tokens: 400
    });

    const reply =
      completion.choices?.[0]?.message?.content ||
      "Sorry, I didn’t catch that — could you repeat it?";

    // Update memory
    memory[userId] = fullHistory.concat([{ role: "assistant", content: reply }]);

    // === Lead Detection ===
    const leadDetected =
      (leadInfo?.name && leadInfo.name.length > 1) ||
      (leadInfo?.email && leadInfo.email.includes("@")) ||
      (leadInfo?.phone && leadInfo.phone.replace(/\D/g, "").length >= 7);

    if (leadDetected) {
      console.log("📩 Lead detected — emailing…");

      const transcript = memory[userId]
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join("\n");

      const summary = await makeSummary(memory[userId]);

      await sendLeadEmail(leadInfo, summary, transcript);
    }

    // === Return the Chat Response to Frontend ===
    return res.status(200).json({ reply });

  } catch (err) {
    console.error("🔥 SaviChat API Error:", err);
    return res.status(500).json({
      reply: "⚠️ Server issue — try again in a moment."
    });
  }
}
