// api/ask.js
import OpenAI from 'openai';

export default async function handler(req, res) {
  // السماح فقط لطلبات POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ 
      error: `Method ${req.method} not allowed` 
    });
  }

  try {
    const { prompt, systemPrompt } = req.body;

    // التحقق من وجود الـ prompt
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ 
        error: 'Prompt is required and must be a string' 
      });
    }

    // الحصول على API Key من متغيرات البيئة
    const apiKey = process.env.DEEPSEEK_API_KEY;
    
    if (!apiKey) {
      console.error('DEEPSEEK_API_KEY is not configured');
      return res.status(500).json({ 
        error: 'API key not configured' 
      });
    }

    // إنشاء كائن OpenAI مع DeepSeek
    const openai = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://api.deepseek.com',
      timeout: 30000 // 30 ثانية timeout
    });

    // إعداد الرسائل
    const messages = [];
    
    if (systemPrompt && typeof systemPrompt === 'string') {
      messages.push({ role: 'system', content: systemPrompt });
    }
    
    messages.push({ role: 'user', content: prompt });

    // طلب إلى DeepSeek API
    const completion = await openai.chat.completions.create({
      model: 'deepseek-chat', // أو 'deepseek-coder' للبرمجة
      messages: messages,
      max_tokens: 2048,
      temperature: 0.7,
      stream: false
    });

    // التحقق من الرد
    if (!completion.choices || completion.choices.length === 0) {
      throw new Error('No response from API');
    }

    const responseText = completion.choices[0].message.content;
    
    return res.status(200).json({ 
      response: responseText 
    });

  } catch (error) {
    console.error('API Error:', error);
    
    // رسائل خطأ أكثر وضوحاً
    let errorMessage = 'Internal server error';
    let statusCode = 500;
    
    if (error.message.includes('API key') || error.message.includes('authentication')) {
      errorMessage = 'Invalid API key';
      statusCode = 401;
    } else if (error.message.includes('timeout')) {
      errorMessage = 'Request timeout';
      statusCode = 408;
    } else if (error.message.includes('rate limit')) {
      errorMessage = 'Rate limit exceeded';
      statusCode = 429;
    }
    
    return res.status(statusCode).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}