
// ─────────────────────────────────────────
// ADD THIS to server.js — OpenRouter proxy
// Paste it after your existing app.use() lines
// and before the Socket.IO section
// ─────────────────────────────────────────

app.post('/api/robo', async (req, res) => {
  try {
    const { messages } = req.body;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_KEY}`,
        'Content-Type':  'application/json',
        'HTTP-Referer':  'https://sanare.app',
        'X-Title':       'Sanare',
      },
      body: JSON.stringify({
        model:       'openai/gpt-4o',
        messages,
        max_tokens:  300,
        temperature: 0.75,
        stream:      true,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('OpenRouter error:', err);
      return res.status(502).json({ error: 'AI unavailable' });
    }

    // Stream tokens straight back to browser
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    response.body.pipe(res);

  } catch (err) {
    console.error('Robo proxy error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─────────────────────────────────────────
// Also add to your .env file:
//   OPENROUTER_KEY=sk-or-v1-xxxxxxxxxxxx
// ─────────────────────────────────────────