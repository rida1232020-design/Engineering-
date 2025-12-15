// pages/api/ask.js
export default async function handler(req, res) {
  // السماح فقط بـ POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY is missing');
      return res.status(500).json({ error: 'API key not configured' });
    }

    const { image, question, major, subject, additionalInfo } = req.body;

    // إعداد الرسالة
    const content = [];

    // إضافة الصورة إذا وجدت
    if (image) {
      // إزالة البادئة data:image/...;base64, إذا وجدت
      const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
      const mediaType = image.match(/^data:image\/(\w+);base64,/)?.[1] || 'jpeg';
      
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: `image/${mediaType}`,
          data: base64Data
        }
      });
    }

    // إضافة النص
    let prompt = `أنت مساعد هندسي متخصص في مساعدة طلاب الهندسة العراقيين.

التخصص: ${major || 'غير محدد'}
المادة: ${subject || 'غير محددة'}

${question || 'قم بتحليل الصورة وشرح المحتوى'}`;

    if (additionalInfo) {
      prompt += `\n\nمعلومات إضافية: ${additionalInfo}`;
    }

    prompt += '\n\nقدم إجابة تفصيلية وواضحة باللغة العربية مع خطوات الحل إن أمكن.';

    content.push({
      type: 'text',
      text: prompt
    });

    // استدعاء Anthropic API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: content
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Anthropic API Error:', errorData);
      return res.status(response.status).json({ 
        error: errorData.error?.message || 'API request failed' 
      });
    }

    const data = await response.json();
    
    // إرجاع الإجابة
    return res.status(200).json({
      answer: data.content[0].text
    });

  } catch (error) {
    console.error('Server Error:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error' 
    });
  }
}