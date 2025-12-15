// api/ask.js - الإصدار النهائي لمعالجة الصور
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
    console.log('📥 بدء معالجة طلب جديد...');
    
    try {
      const { image, fileType, specialty, subject, additionalText } = req.body;

      // التحقق من البيانات الأساسية
      if (!specialty || !subject) {
        return res.status(400).json({
          success: false,
          message: '❌ الرجاء اختيار التخصص والمادة الدراسية'
        });
      }

      // التحقق من وجود API Key
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        console.log('❌ لم يتم العثور على API Key');
        return res.json({
          success: true,
          answer: `# ${specialty} - ${subject}\n\nالموقع يعمل! أضف مفتاح API في Vercel لتفعيل الذكاء الاصطناعي.`,
          isMock: true
        });
      }

      // التحقق من وجود الصورة
      if (!image) {
        console.log('❌ لا توجد صورة في الطلب');
        return res.status(400).json({
          success: false,
          message: '❌ الرجاء رفع صورة للسؤال'
        });
      }

      console.log(`🔧 معالجة: ${specialty} - ${subject}`);
      console.log(`📊 حجم بيانات الصورة: ${Math.round(image.length / 1024)} KB`);

      // ⭐⭐ الجزء الأهم: تنظيف ومعالجة بيانات الصورة ⭐⭐
      let cleanBase64Data = image;
      let detectedMediaType = 'image/jpeg'; // الافتراضي

      // التحقق من تنسيق Base64
      if (!/^[A-Za-z0-9+/=]+$/.test(image.replace(/\s/g, ''))) {
        // إذا كانت تحتوي على بادئة data URL
        if (image.startsWith('data:')) {
          console.log('🔍 اكتشاف data URL، جاري استخراج Base64...');
          
          // استخراج نوع MIME من data URL
          const mimeMatch = image.match(/^data:(image\/[a-zA-Z0-9.+]+);base64,/);
          if (mimeMatch) {
            detectedMediaType = mimeMatch[1];
            console.log(`✅ تم اكتشاف نوع الصورة: ${detectedMediaType}`);
          }
          
          // استخراج بيانات Base64 النقية
          const base64Match = image.split(';base64,');
          if (base64Match.length > 1) {
            cleanBase64Data = base64Match[1];
            console.log('✅ تم استخراج بيانات Base64 النقية');
          } else {
            console.log('⚠️ لا يمكن استخراج بيانات Base64 من data URL');
            return res.json({
              success: true,
              answer: `# ${specialty} - ${subject}\n\n**خطأ في تنسيق الصورة**\n\nالرجاء رفع الصورة مرة أخرى.\n\nكود الخطأ: BASE64_FORMAT`,
              error: true
            });
          }
        } else {
          console.log('❌ بيانات Base64 غير صالحة');
          return res.json({
            success: true,
            answer: `# ${specialty} - ${subject}\n\n**تنسيق الصورة غير صالح**\n\nالرجاء:\n1. رفع صورة جديدة\n2. اختيار صورة JPG أو PNG واضحة\n3. التأكد من حجم الصورة أقل من 5MB`,
            error: true
          });
        }
      }

      // استخدام نوع الملف المحدد من الواجهة أو المكتشف
      const finalMediaType = fileType || detectedMediaType;
      console.log(`🖼️ نوع الصورة النهائي: ${finalMediaType}`);

      // 🔍 فحص حجم الصورة (لا تزيد عن 10MB لـ Claude API)
      if (cleanBase64Data.length > 10 * 1024 * 1024 * 1.37) { // تقريباً 10MB بعد Base64
        console.log('❌ الصورة كبيرة جداً:', Math.round(cleanBase64Data.length / 1024), 'KB');
        return res.json({
          success: true,
          answer: `# ${specialty} - ${subject}\n\n**الصورة كبيرة جداً**\n\nالرجاء رفع صورة أصغر:\n- أقل من 5MB\n- أو استخدم ضغط الصورة\n- أو تصوير جزء السؤال فقط`,
          error: true
        });
      }

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

      // 🔄 الاتصال بـ Claude API
      console.log('🚀 جاري الاتصال بـ Claude API...');
      
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307', // إصدار خفيف وسريع للاختبار
          max_tokens: 4000,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: finalMediaType,
                    data: cleanBase64Data
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

      // معالجة الاستجابة
      const responseText = await response.text();
      console.log(`📨 حالة استجابة API: ${response.status}`);
      
      if (!response.ok) {
        console.error('❌ خطأ من Claude API:', responseText.substring(0, 200));
        
        // تحليل مفصل للخطأ 400
        if (response.status === 400) {
          let errorDetails = 'تنسيق الصورة غير مدعوم';
          
          // محاولة فهم سبب الخطأ 400 المحدد
          if (responseText.includes('media_type')) {
            errorDetails = 'نوع الصورة غير مدعوم. جرب حفظ الصورة كـ JPG أو PNG جديد.';
          } else if (responseText.includes('base64')) {
            errorDetails = 'تنسيق Base64 غير صالح. جرب رفع صورة مختلفة.';
          } else if (responseText.includes('size') || responseText.includes('large')) {
            errorDetails = 'حجم الصورة كبير جداً للتحليل. جرب صورة أصغر.';
          }
          
          return res.json({
            success: true,
            answer: `# ${specialty} - ${subject}\n\n**${errorDetails}**\n\n### 💡 الحلول المقترحة:\n1. **احفظ الصورة كـ JPG جديد** من معرض الصور\n2. **قص الصورة** لتركيز على السؤال فقط\n3. **تأكد من وضوح النص** في الصورة\n4. **حاول تصوير السؤال** من كتاب بدلاً عن شاشة\n\nكود الخطأ: IMG_400`,
            error: true
          });
        }
        
        // أخطاء أخرى
        let errorMessage = 'حدث خطأ تقني';
        if (response.status === 401) errorMessage = 'مفتاح API غير صالح';
        if (response.status === 429) errorMessage = 'تجاوز الحد المسموح';
        
        return res.json({
          success: true,
          answer: `# ${specialty} - ${subject}\n\n**${errorMessage}**\n\nكود الخطأ: ${response.status}`,
          error: true
        });
      }

      // ✅ النجاح - استخراج الإجابة
      const data = JSON.parse(responseText);
      const answer = data.content
        .filter(item => item.type === 'text')
        .map(item => item.text)
        .join('\n\n');

      console.log(`🎉 نجاح! تم استلام إجابة بـ ${data.usage?.total_tokens || 0} رمز`);

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
        answer: `# ${req.body.specialty || 'الهندسة'} - ${req.body.subject || 'المادة'}\n\n**حدث خطأ غير متوقع**\n\nالرجاء:\n1. المحاولة مرة أخرى\n2. رفع صورة مختلفة\n3. التأكد من اتصال الإنترنت\n\n📞 إذا استمرت المشكلة، حاول تصوير السؤال بجودة أعلى.`,
        error: true
      });
    }
  }

  res.status(404).json({ 
    success: false, 
    message: '❌ نقطة النهاية غير موجودة' 
  });
}