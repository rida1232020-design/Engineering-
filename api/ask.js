// api/ask.js - الإصدار المصحح للاتصال بـ Claude API
export default async function handler(req, res) {
  // تفعيل CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
    return res.status(200).json({
      status: '✅ الخادم يعمل',
      hasApiKey: hasApiKey,
      message: hasApiKey 
        ? 'تم تفعيل الذكاء الاصطناعي! جاهز لتحليل الأسئلة.' 
        : 'أضف ANTHROPIC_API_KEY في إعدادات Vercel',
      timestamp: new Date().toLocaleString('ar-IQ')
    });
  }

  if (req.method === 'POST') {
    try {
      const { image, fileType, specialty, subject, additionalText } = req.body;

      if (!specialty || !subject) {
        return res.status(400).json({
          success: false,
          message: '❌ الرجاء اختيار التخصص والمادة الدراسية'
        });
      }

      console.log(`📥 معالجة سؤال: ${specialty} - ${subject}`);

      // 🔍 التحقق من وجود API Key
      if (!process.env.ANTHROPIC_API_KEY) {
        return res.json({
          success: true,
          answer: `# 🔧 ${specialty} - ${subject}\n\nالموقع يعمل! أضف مفتاح API في Vercel لتفعيل الذكاء الاصطناعي.`,
          isMock: true
        });
      }

      // التحقق من وجود الصورة
      if (!image) {
        return res.status(400).json({
          success: false,
          message: '❌ الرجاء رفع صورة للسؤال'
        });
      }

      // 🎯 بناء الرسالة بشكل صحيح لـ Claude API
      const prompt = `أنت أستاذ جامعي عراقي متخصص في ${specialty}، وتُدرّس مادة "${subject}" ضمن المنهاج العراقي.

الطالب رفع صورة تحتوي على سؤال أو تمرين. بناءً على تخصصك وخبرتك:

1. حلل السؤال في الصورة بدقة
2. قدم الإجابة بأسلوب أكاديمي واضح ومنظم
3. استخدم المراجع والمعادلات المعتمدة في المناهج العراقية
4. اشرح الخطوات الحلّية بالتفصيل
5. قدم نصائح عملية للطالب

${additionalText ? `\nملاحظات الطالب الإضافية: ${additionalText}` : ''}

أجب باللغة العربية الفصحى، وركز على الوضوح والدقة.`;

      // 🔄 الاتصال بـ Claude API بالشكل الصحيح
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-sonnet-20240229',
          max_tokens: 4000,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: fileType || 'image/jpeg',
                    data: image
                  }
                },
                {
                  type: 'text',
                  text: prompt
                }
              ]
            }
          ]
        })
      });

      // 📊 معالجة الاستجابة
      const responseText = await response.text();
      
      if (!response.ok) {
        console.error('❌ Claude API Error:', response.status, responseText);
        
        let errorMessage = 'حدث خطأ تقني';
        if (response.status === 401) {
          errorMessage = 'مفتاح API غير صالح';
        } else if (response.status === 400) {
          errorMessage = 'طلب غير صحيح - تأكد من تنسيق الصورة';
        } else if (response.status === 429) {
          errorMessage = 'تجاوز الحد المسموح، حاول مرة أخرى لاحقاً';
        }
        
        return res.json({
          success: true,
          answer: `# ⚠️ ${specialty} - ${subject}\n\n**${errorMessage}**\n\nتفاصيل الخطأ: ${response.status}\n\nيمكنك:\n1. التأكد من وضوح الصورة\n2. المحاولة مرة أخرى\n3. التحقق من رصيد API Key`,
          error: true
        });
      }

      // ✅ نجاح - استخراج الإجابة
      const data = JSON.parse(responseText);
      const answer = data.content
        .filter(item => item.type === 'text')
        .map(item => item.text)
        .join('\n\n');

      return res.json({
        success: true,
        answer: answer,
        model: data.model,
        tokens: data.usage?.total_tokens || 0,
        isMock: false,
        timestamp: new Date().toLocaleString('ar-IQ')
      });

    } catch (error) {
      console.error('🔥 Server Error:', error);
      
      return res.status(500).json({
        success: false,
        message: 'حدث خطأ غير متوقع',
        error: error.message,
        tip: 'حاول مرة أخرى أو رفع صورة أوضح'
      });
    }
  }

  res.status(404).json({ 
    success: false, 
    message: '❌ نقطة النهاية غير موجودة' 
  });
}