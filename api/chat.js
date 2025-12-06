// =====================================================================================
// ⭐ SaviChat Serverless API — Vercel-Compatible (Node.js 20)
// Fully working: OpenAI chat, memory, Gmail SMTP lead emails, summaries, transcripts
// =====================================================================================

import OpenAI from "openai";
import nodemailer from "nodemailer";

// REQUIRED for Vercel to run this as a Node serverless function
export const config = {
  runtime: "nodejs20.x"
};

// Temporary per-user memory (resets on redeploy)
const memory = {};

// Savi's personality
const systemPrompt = `
You are Savi, Nova Web Company's friendly AI assistant in Phoenix, AZ.
Your job:
- Speak naturally and professionally
- Learn about the visitor's business
- Explain Nova Web’s services (web design, hosting, SEO, marketing)
- Ask for name, phone, and email politely
Keep responses short and friendly.
`;

// Initialize OpenAI
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Gmail SMTP Transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Create a conversation summary
async function makeSummary(history) {
  const transcript = history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n");

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "Summarize this conversation in 4–6 sentences, focusing on intent and lead details."
      },
      {
        role: "user",
        content: transcript
      }
    ]
  });

  return completion.choices[0].message.content;
}

// Send email with lead info, summary, full transcript
async function sendLeadEmail(leadInfo, summary, transcript) {
  const { name, email, phone } = leadInfo || {};

  const body = `
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
    text: body
  });

  console.log("📧 Lead email sent successfully.");
}

// =====================================================================================
// ⭐ MAIN SERVERLESS HANDLER
// MUST be an anonymous default export — required by Vercel
// =====================================================================================
export default async function (req, res) {
  if (req.method !== "POST") {
    return res.status(404).json({ error: "Route not found" });
  }

  try {
    const { userId, messages, leadInfo } = req.body;

    if (!userId || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid request body" });
    }

    // Create memory for new users
    if (!memory[userId]) {
      memory[userId] = [{ role: "system", content: systemPrompt }];
    }

    // Append the new message(s)
    const fullHistory = [...memory[userId], ...messages];

    // --- OpenAI Response ---
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: fullHistory,
      temperature: 0.7,
      max_tokens: 400
    });

    const reply =
      completion.choices?.[0]?.message?.content ||
      "Sorry — I didn’t catch that. Could you repeat it?";

    // Save updated memory
    memory[userId] = fullHistory.concat([{ role: "assistant", content: reply }]);

    // Lead detection
    const leadDetected =
      (leadInfo?.name && leadInfo.name.length > 1) ||
      (leadInfo?.email && leadInfo.email.includes("@")) ||
      (leadInfo?.phone && leadInfo.phone.replace(/\D/g, "").length >= 7);

    if (leadDetected) {
      console.log("📩 Lead detected — generating email...");

      const transcript = memory[userId]
        .map(m => `${m.role.toUpperCase()}: ${m.content}`)
        .join("\n");

      const summary = await makeSummary(memory[userId]);

      await sendLeadEmail(leadInfo, summary, transcript);
    }

    return res.status(200).json({ reply });

  } catch (err) {
    console.error("🔥 SaviChat API Error:", err);
    return res.status(500).json({
      reply: "⚠️ Server error — try again in a moment."
    });
  }
}
