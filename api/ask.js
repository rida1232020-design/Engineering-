import { createRequire } from 'module';
const require = createRequire(import.meta.url);

export default async function handler(req, res) {
  // السماح فقط لطلبات POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, systemPrompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // استخدم API Key من متغيرات البيئة
    const apiKey = process.env.DEEPSEEK_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat', // أو 'deepseek-coder' للبرمجة
        messages: [
          {
            role: 'system',
            content: systemPrompt || 'You are a helpful assistant'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        stream: false,
        max_tokens: 2048
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const message = data.choices[0]?.message?.content;

    return res.status(200).json({ response: message });
    
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error' 
    });
  }
}