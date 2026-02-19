// ─────────────────────────────────────────
// TONE ANALYSIS ROUTE
// Paste this block in server.js directly after the /api/robo route
// dashboard.js calls this after every Robo reply
// Returns: { score: 0-100 } — drives the flower petal count + size
// ─────────────────────────────────────────
app.post("/api/tone", async (req, res) => {
  if (!process.env.OPENROUTER_KEY) return res.status(500).json({ error: "No API key" });

  const { messages } = req.body;
  if (!messages?.length) return res.status(400).json({ error: "No messages" });

  // Summarise the conversation into plain text for analysis
  const transcript = messages
    .filter(m => m.role !== 'system')
    .map(m => `${m.role === 'user' ? 'Patient' : 'Robo'}: ${m.content}`)
    .join('\n');

  try {
    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_KEY}`,
        "Content-Type":  "application/json",
        "HTTP-Referer":  "http://localhost:3000",
        "X-Title":       "Sanare",
      },
      body: JSON.stringify({
        model:       "openai/gpt-4o-mini",  // cheaper model — just scoring, not responding
        stream:      false,
        max_tokens:  60,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: `You are a clinical sentiment analyser. 
Read the conversation transcript and return ONLY a JSON object — no explanation, no markdown.

Scoring guide for the "score" field (0–100):
  0–20  : Severe distress, crisis signals, suicidal ideation, hopelessness
  21–35 : Heavy sadness, grief, feeling stuck or numb
  36–50 : Struggling but coping, anxiety, frustration, uncertainty
  51–65 : Neutral to slightly positive, processing feelings
  66–80 : Calm, grounded, making progress, hopeful
  81–100: Joyful, thriving, positive breakthroughs

Return exactly:
{"score": <number 0-100>}`
          },
          { role: "user", content: transcript }
        ],
      }),
    });

    if (!upstream.ok) {
      console.error("Tone API error:", upstream.status);
      return res.status(502).json({ error: "upstream failed" });
    }

    const data    = await upstream.json();
    const raw     = data.choices?.[0]?.message?.content?.trim() || '{"score":50}';

    // Strip any accidental markdown fences
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const parsed  = JSON.parse(cleaned);
    const score   = Math.max(0, Math.min(100, Number(parsed.score) || 50));

    console.log(`🌸 Tone score: ${score} | transcript length: ${transcript.length} chars`);
    res.json({ score });

  } catch (err) {
    console.error("Tone route error:", err.message);
    // Return neutral score on failure so flower doesn't break
    res.json({ score: 50 });
  }
});