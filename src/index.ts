// src/index.js - Super simple test bot
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // ===== Set webhook =====
    if (url.pathname === '/setwebhook') {
      const webhookUrl = `${url.origin}/webhook`;
      const response = await fetch(
        `https://api.telegram.org/bot${env.BOT_TOKEN}/setWebhook?url=${webhookUrl}`
      );
      const result = await response.json();
      return new Response(JSON.stringify(result, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // ===== Handle webhook =====
    if (url.pathname === '/webhook') {
      try {
        const update = await request.json();
        console.log('Update received:', JSON.stringify(update));
        
        // Check if it's a message
        if (update.message) {
          const chatId = update.message.chat.id;
          const text = update.message.text || '';
          const from = update.message.from.first_name || 'User';
          
          // Simple response logic
          let reply = '';
          
          if (text === '/start') {
            reply = `👋 Hello ${from}! I'm alive and working!\n\nSend me any message and I'll echo it back.`;
          } else if (text === '/help') {
            reply = `🤖 Available commands:\n/start - Start the bot\n/help - Show this help\n/ping - Check if I'm alive`;
          } else if (text === '/ping') {
            reply = '🏓 Pong! I\'m alive!';
          } else {
            reply = `📝 You said: "${text}"\n\nTry /start to begin.`;
          }
          
          // Send reply
          await sendMessage(env.BOT_TOKEN, chatId, reply);
          return new Response('OK', { status: 200 });
        }
        
        return new Response('OK', { status: 200 });
      } catch (error) {
        console.error('Error:', error.message);
        return new Response('Error: ' + error.message, { status: 500 });
      }
    }
    
    return new Response('🤖 Test bot is running! Visit /setwebhook', { status: 200 });
  }
};

// ===== Helper function =====
async function sendMessage(token, chatId, text) {
  const body = { chat_id: chatId, text };
  
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}
