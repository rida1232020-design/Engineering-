# إنشاء مجلد api
mkdir api

# إنشاء ملف ask.js في المجلد الصحيح
cat > api/ask.js << 'EOF'
import OpenAI from 'openai';

export default async function handler(req, res) {
  // معالجة CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // معالجة طلبات OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // السماح فقط لطلبات POST
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      allowed: ['POST']
    });
  }

  try {
    const { prompt, systemPrompt } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ 
        error: 'Prompt is required and must be a string' 
      });
    }

    // الحصول على API Key
    const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ 
        error: 'API key not configured. Please add DEEPSEEK_API_KEY to environment variables.' 
      });
    }

    // إنشاء كائن OpenAI مع DeepSeek
    const openai = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://api.deepseek.com',
      timeout: 30000
    });

    // إعداد الرسائل
    const messages = [];
    
    if (systemPrompt && typeof systemPrompt === 'string') {
      messages.push({ 
        role: 'system', 
        content: systemPrompt 
      });
    }
    
    messages.push({ 
      role: 'user', 
      content: prompt 
    });

    // طلب إلى API
    const completion = await openai.chat.completions.create({
      model: 'deepseek-chat',
      messages: messages,
      max_tokens: 2048,
      temperature: 0.7,
      stream: false
    });

    const responseText = completion.choices[0]?.message?.content;
    
    if (!responseText) {
      throw new Error('No response text received');
    }

    return res.status(200).json({ 
      success: true,
      response: responseText,
      model: completion.model,
      usage: completion.usage
    });

  } catch (error) {
    console.error('DeepSeek API Error:', error);
    
    let statusCode = 500;
    let errorMessage = 'Internal server error';
    
    if (error.message.includes('API key') || error.message.includes('401')) {
      statusCode = 401;
      errorMessage = 'Invalid API key or authentication failed';
    } else if (error.message.includes('rate limit')) {
      statusCode = 429;
      errorMessage = 'Rate limit exceeded. Please try again later.';
    } else if (error.message.includes('timeout')) {
      statusCode = 408;
      errorMessage = 'Request timeout';
    }
    
    return res.status(statusCode).json({ 
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
EOF