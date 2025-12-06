// ✅ SaviChat Backend — Clean Build with Gmail Email + Summary + Transcript

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const OpenAI = require("openai");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// === OpenAI Client ===
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// === In-memory conversation store ===
const memory = {};

// === Savi’s persona / system prompt ===
const systemPrompt = `
You are Savi, the friendly and professional AI sales assistant for Nova Web Company in Phoenix, AZ.

🎯 Your purpose:
- Engage visitors conversationally to learn about their business.
- Guide them toward Nova Web Company’s services: web design, SEO, hosting, and digital marketing.
- Gather useful info (name, phone, email, type of business, goals).
- Offer to schedule a consultation or callback.
- Always respond helpfully and naturally.

🧠 Style:
- Conversational, warm, and human-like — like a smart, relatable sales rep.
- Use emojis sparingly to add friendliness.
- Keep responses short (2–4 sentences max).
- Do NOT mention competitors.
- Do NOT reveal private internal information.
- If the user goes off-topic, gently bring things back to business, websites, marketing, or SEO.

You always try to politely collect the visitor's:
- Name
- Email
- Phone number
when it feels natural in the conversation.
`;

// === Gmail SMTP Transport (uses App Password) ===
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER, // your Gmail address
    pass: process.env.SMTP_PASS, // your Gmail App Password
  },
});

// === Helper: Generate conversation summary with OpenAI ===
async function makeSummary(history) {
  const textHistory = history
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are a summarization assistant. Summarize the following conversation in 4–6 sentences. Focus on what the visitor needs, their business type, and any lead details (timeline, budget, urgency).",
      },
      {
        role: "user",
        content: textHistory,
      },
    ],
  });

  return completion.choices[0].message.content;
}

// === Helper: Send lead email ===
async function sendLeadEmail(leadInfo, summary, fullTranscript) {
  const { name, email, phone } = leadInfo || {};

  const cleanLead = `
🔥 NEW SAVICHAT LEAD

📌 Name: ${name || "Not provided"}
📌 Email: ${email || "Not provided"}
📌 Phone: ${phone || "Not provided"}

------------------------------------------------
📝 Conversation Summary:
------------------------------------------------
${summary}

------------------------------------------------
📄 FULL CONVERSATION TRANSCRIPT
------------------------------------------------
${fullTranscript}
`;

  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to: process.env.ADMIN_EMAIL, // henry@novawebcompany.com in Vercel env
    subject: "🔥 New Lead from SaviChat",
    text: cleanLead,
  });

  console.log("📧 Lead email sent successfully.");
}

// === POST /chat ===
app.post("/chat", async (req, res) => {
  try {
    const { userId, messages, leadInfo } = req.body;

    // Basic validation
    if (!userId || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid request body" });
    }

    // Initialize memory for this user if not present
    if (!memory[userId]) {
      memory[userId] = [{ role: "system", content: systemPrompt }];
    }

    // Build full conversation history
    const fullHistory = [...memory[userId], ...messages];

    console.log(`🟣 [${new Date().toISOString()}] Incoming message from ${userId}`);

    // Call OpenAI
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: fullHistory,
      temperature: 0.8,
      max_tokens: 400,
    });

    const reply =
      completion.choices?.[0]?.message?.content ||
      "Sorry, something glitched — could you try that again?";

    // Update memory with the assistant reply
    memory[userId] = fullHistory.concat([{ role: "assistant", content: reply }]);

    // Check if we have lead info worth emailing
    const leadDetected =
      (leadInfo?.name && leadInfo.name.trim().length > 1) ||
      (leadInfo?.email && leadInfo.email.includes("@")) ||
      (leadInfo?.phone && leadInfo.phone.replace(/\D/g, "").length >= 7);

    if (leadDetected) {
      console.log("📩 Lead detected — generating summary and sending email…");

      try {
        const summary = await makeSummary(memory[userId]);
        const transcript = memory[userId]
          .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
          .join("\n");

        await sendLeadEmail(leadInfo, summary, transcript);
      } catch (emailErr) {
        console.error("❌ Email sending failed:", emailErr.message);
      }
    }

    console.log(`🟢 Reply sent to ${userId}: ${reply.slice(0, 80)}…`);
    res.json({ reply });
  } catch (err) {
    console.error("🔥 SaviChat Error:", err);
    res
      .status(500)
      .json({ reply: "⚠️ Server issue — please try again in a moment." });
  }
});

// === Optional: Clear memory for a user ===
app.post("/clear-memory", (req, res) => {
  const { userId } = req.body;
  if (userId && memory[userId]) {
    delete memory[userId];
  }
  res.json({ success: true, message: "Memory cleared for user." });
});

// === Start Server ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 SaviChat backend running on port ${PORT}`);
});
