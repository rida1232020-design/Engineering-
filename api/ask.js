// api/ask.js - الإصدار النهائي المدعوم
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
        ? '✅ تم تفعيل الذكاء الاصطناعي! جاهز لتحليل الصور.' 
        : 'أضف ANTHROPIC_API_KEY في إعدادات Vercel',
      timestamp: new Date().toLocaleString('ar-IQ')
    });
  }

  if (req.method === 'POST') {
    try {
      console.log('📥 بدء معالجة طلب جديد...');
      const { image, fileType, specialty, subject, additionalText } = req.body;

      if (!specialty || !subject) {
        return res.status(400).json({
          success: false,
          message: '❌ الرجاء اختيار التخصص والمادة الدراسية'
        });
      }

      // 🔍 التحقق من وجود API Key
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        console.log('❌ لم يتم العثور على API Key');
        return res.json({
          success: true,
          answer: `# ${specialty} - ${subject}\n\nالموقع يعمل! أضف مفتاح API في Vercel لتفعيل الذكاء الاصطناعي.`,
          isMock: true
        });
      }

      // التحقق من وجود الصورة وتنسيقها
      if (!image) {
        console.log('❌ لا توجد صورة في الطلب');
        return res.status(400).json({
          success: false,
          message: '❌ الرجاء رفع صورة للسؤال'
        });
      }

      console.log(`🔧 معالجة: ${specialty} - ${subject}`);
      console.log(`📊 حجم الصورة: ${Math.round(image.length / 1024)} KB`);

      // ⚠️ تنظيف بيانات Base64
      let cleanImageData = image;
      // إزالة بادئة data URL إذا موجودة
      if (image.includes('base64,')) {
        cleanImageData = image.split('base64,')[1];
        console.log('✅ تم تنظيف بيانات Base64');
      }

      // 🎯 تحديد نوع الصورة بدقة
      let mediaType = 'image/jpeg'; // افتراضي
      if (fileType) {
        mediaType = fileType;
      } else if (cleanImageData.charAt(0) === '/') {
        mediaType = 'image/jpeg';
      } else if (cleanImageData.charAt(0) === 'i') {
        mediaType = 'image/png';
      }

      console.log(`🖼️ نوع الصورة: ${mediaType}`);

      // بناء الـ Prompt
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
      console.log('🚀 جاري الاتصال بـ Claude API...');
      
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'max-tokens-3-5-sonnet-2024-07-15'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022', // أحدث إصدار
          max_tokens: 4000,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: mediaType,
                    data: cleanImageData
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
      console.log(`📨 استجابة API: ${response.status}`);
      
      if (!response.ok) {
        console.error('❌ خطأ من Claude API:', responseText);
        
        let errorMessage = 'حدث خطأ تقني';
        let details = '';
        
        if (response.status === 400) {
          errorMessage = 'تنسيق الصورة غير مدعوم';
          details = 'الرجاء رفع صورة بتنسيق JPG أو PNG واضحة';
        } else if (response.status === 401) {
          errorMessage = 'مفتاح API غير صالح';
          details = 'تحقق من صحة المفتاح في إعدادات Vercel';
        } else if (response.status === 429) {
          errorMessage = 'تجاوز الحد المسموح';
          details = 'حاول مرة أخرى بعد قليل أو تحقق من رصيد API';
        } else if (response.status === 413) {
          errorMessage = 'الصورة كبيرة جداً';
          details = 'الرجاء رفع صورة أصغر (أقل من 5MB)';
        } else if (response.status === 422) {
          errorMessage = 'الصورة غير مقروءة';
          details = 'تأكد من وضوح النص في الصورة';
        }
        
        return res.json({
          success: true,
          answer: `# ⚠️ ${specialty} - ${subject}\n\n**${errorMessage}**\n\n${details}\n\nكود الخطأ: ${response.status}`,
          error: true,
          debug: process.env.NODE_ENV === 'development' ? responseText : undefined
        });
      }

      // ✅ نجاح - استخراج الإجابة
      const data = JSON.parse(responseText);
      const answer = data.content
        .filter(item => item.type === 'text')
        .map(item => item.text)
        .join('\n\n');

      console.log(`✅ نجاح! تم استلام إجابة بـ ${data.usage?.total_tokens || 0} رمز`);

      return res.json({
        success: true,
        answer: answer,
        model: data.model,
        tokens: data.usage?.total_tokens || 0,
        isMock: false,
        timestamp: new Date().toLocaleString('ar-IQ')
      });

    } catch (error) {
      console.error('🔥 خطأ في الخادم:', error);
      
      return res.json({
        success: true,
        answer: `# هندسية - ${req.body.subject || 'عام'}\n\n**نعتذر، حدث خطأ غير متوقع**\n\nالرجاء:\n1. التأكد من اتصال الإنترنت\n2. رفع صورة أوضح\n3. المحاولة مرة أخرى\n\n📞 إذا استمرت المشكلة، تأكد من أن API Key صالح وله رصيد.`,
        error: true
      });
    }
  }

  res.status(404).json({ 
    success: false, 
    message: '❌ نقطة النهاية غير موجودة' 
  });
}