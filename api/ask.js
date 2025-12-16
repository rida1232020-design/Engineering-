// api/ask.js
import OpenAI from 'openai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt } = req.body;

    const openai = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com'
    });

    const completion = await openai.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      stream: false
    });

    return res.status(200).json({ 
      response: completion.choices[0].message.content 
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error' 
    });
  }
}