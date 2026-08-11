export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { transcript, projectNames } = req.body || {};
  if (!transcript || typeof transcript !== 'string') {
    res.status(400).json({ error: 'Missing transcript' });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server not configured' });
    return;
  }

  const names = Array.isArray(projectNames) ? projectNames : [];
  const today = new Date().toISOString().slice(0, 10);
  const prompt = `Extract a task from this voice transcript: "${transcript}"
Known projects: ${names.join(', ') || '(none)'}
Today's date: ${today}

Return JSON matching exactly this shape:
{"title":"...","projectName":"matching known project name or null","subtasks":["only if the task genuinely needs breaking into multiple steps, otherwise leave empty"],"inToday":true or false,"dueDate":"YYYY-MM-DD or null if no date was mentioned"}`;

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You extract structured tasks from voice transcripts. Respond with JSON only.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!r.ok) {
      const detail = await r.text();
      res.status(502).json({ error: `OpenAI API error ${r.status}`, detail });
      return;
    }

    const d = await r.json();
    const txt = d.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(txt);

    res.status(200).json({
      title: parsed.title || transcript,
      projectName: parsed.projectName || null,
      subtasks: Array.isArray(parsed.subtasks) ? parsed.subtasks : [],
      inToday: !!parsed.inToday,
      dueDate: parsed.dueDate || null,
    });
  } catch (err) {
    res.status(502).json({ error: 'Failed to parse task', detail: err.message });
  }
}
