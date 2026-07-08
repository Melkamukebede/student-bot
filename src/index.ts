// src/index.ts - No external dependencies!
export interface Env {
  BOT_TOKEN: string;
  BOT_INFO: string;
}

// Student data store (in-memory - resets on each request)
// For production, use Cloudflare KV
const studentData: Record<number, { name: string; university: string; semester: string; step: string }> = {};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
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
        const update = await request.json() as any;
        
        // Handle message
        if (update.message) {
          const chatId = update.message.chat.id;
          const text = update.message.text || '';
          const from = update.message.from.id;
          
          // Initialize user session
          if (!studentData[from]) {
            studentData[from] = { name: '', university: '', semester: '', step: 'idle' };
          }
          
          const session = studentData[from];
          
          // ===== Start command =====
          if (text === '/start') {
            // Check if already registered
            if (session.step === 'done' && session.name) {
              await sendMessage(env.BOT_TOKEN, chatId, 
                `👋 Welcome back, ${session.name}!\n\n📋 Your info:\n🏛️ ${session.university}\n📚 ${session.semester}`,
                {
                  inline_keyboard: [
                    [{ text: '🔄 Update Info', callback_data: 'restart' }]
                  ]
                }
              );
              return new Response('OK', { status: 200 });
            }
            
            // Start registration
            session.step = 'name';
            await sendMessage(env.BOT_TOKEN, chatId, '🎓 Let\'s register you!\n\nWhat\'s your full name?');
            return new Response('OK', { status: 200 });
          }
          
          // ===== Handle text input =====
          if (session.step === 'name') {
            session.name = text;
            session.step = 'university';
            
            await sendMessage(env.BOT_TOKEN, chatId, `✅ Got it! Your name: *${session.name}*`, 'Markdown');
            
            await sendMessage(env.BOT_TOKEN, chatId, 'Select your university:', null, {
              inline_keyboard: [
                [{ text: '🏛️ Harvard', callback_data: 'uni_harvard' }],
                [{ text: '🌲 Stanford', callback_data: 'uni_stanford' }],
                [{ text: '🎓 MIT', callback_data: 'uni_mit' }],
                [{ text: '✏️ Other (type manually)', callback_data: 'uni_other' }]
              ]
            });
            return new Response('OK', { status: 200 });
          }
          
          if (session.step === 'university') {
            session.university = text;
            session.step = 'semester';
            
            await sendMessage(env.BOT_TOKEN, chatId, `✅ Got it: *${session.university}*`, 'Markdown');
            
            await sendMessage(env.BOT_TOKEN, chatId, 'What\'s your current semester?', null, {
              inline_keyboard: [
                [1, 2, 3, 4].map(s => ({ text: `${s}`, callback_data: `sem_${s}` })),
                [5, 6, 7, 8].map(s => ({ text: `${s}`, callback_data: `sem_${s}` })),
                [{ text: '📚 Graduate', callback_data: 'sem_grad' }]
              ]
            });
            return new Response('OK', { status: 200 });
          }
          
          if (session.step === 'semester') {
            session.semester = text;
            session.step = 'done';
            
            const summary = `📋 *Registration Complete!*\n\n👤 Name: ${session.name}\n🏛️ University: ${session.university}\n📚 Semester: ${session.semester}`;
            
            await sendMessage(env.BOT_TOKEN, chatId, summary, 'Markdown', {
              inline_keyboard: [
                [{ text: '✅ Confirm', callback_data: 'confirm' }],
                [{ text: '🔄 Start Over', callback_data: 'restart' }]
              ]
            });
            return new Response('OK', { status: 200 });
          }
          
          await sendMessage(env.BOT_TOKEN, chatId, 'Send /start to register!');
          return new Response('OK', { status: 200 });
        }
        
        // ===== Handle callback queries =====
        if (update.callback_query) {
          const callback = update.callback_query;
          const data = callback.data;
          const chatId = callback.message.chat.id;
          const fromId = callback.from.id;
          
          if (!studentData[fromId]) {
            studentData[fromId] = { name: '', university: '', semester: '', step: 'idle' };
          }
          
          const session = studentData[fromId];
          
          if (data === 'restart') {
            session.step = 'idle';
            session.name = '';
            session.university = '';
            session.semester = '';
            await answerCallback(env.BOT_TOKEN, callback.id, '🔄 Restarting...');
            await sendMessage(env.BOT_TOKEN, chatId, 'Send /start to register again!');
            return new Response('OK', { status: 200 });
          }
          
          if (data === 'confirm') {
            session.step = 'done';
            await answerCallback(env.BOT_TOKEN, callback.id, '✅ Registration saved!');
            await sendMessage(env.BOT_TOKEN, chatId, '🎉 You\'re registered! Send /start to see your info.');
            return new Response('OK', { status: 200 });
          }
          
          // University selection
          if (data.startsWith('uni_')) {
            const uniMap: Record<string, string> = {
              'uni_harvard': 'Harvard University',
              'uni_stanford': 'Stanford University',
              'uni_mit': 'Massachusetts Institute of Technology'
            };
            
            if (data === 'uni_other') {
              session.step = 'university';
              await answerCallback(env.BOT_TOKEN, callback.id, '✏️ Type your university');
              await sendMessage(env.BOT_TOKEN, chatId, 'Please type your university name:');
            } else {
              session.university = uniMap[data] || data;
              session.step = 'semester';
              await answerCallback(env.BOT_TOKEN, callback.id, `✅ ${session.university}`);
              
              await sendMessage(env.BOT_TOKEN, chatId, `✅ Selected: *${session.university}*`, 'Markdown');
              
              await sendMessage(env.BOT_TOKEN, chatId, 'What\'s your current semester?', null, {
                inline_keyboard: [
                  [1, 2, 3, 4].map(s => ({ text: `${s}`, callback_data: `sem_${s}` })),
                  [5, 6, 7, 8].map(s => ({ text: `${s}`, callback_data: `sem_${s}` })),
                  [{ text: '📚 Graduate', callback_data: 'sem_grad' }]
                ]
              });
            }
            return new Response('OK', { status: 200 });
          }
          
          // Semester selection
          if (data.startsWith('sem_')) {
            const semMap: Record<string, string> = {
              'sem_1': '1st Semester',
              'sem_2': '2nd Semester',
              'sem_3': '3rd Semester',
              'sem_4': '4th Semester',
              'sem_5': '5th Semester',
              'sem_6': '6th Semester',
              'sem_7': '7th Semester',
              'sem_8': '8th Semester',
              'sem_grad': 'Graduate Student'
            };
            
            session.semester = semMap[data] || data;
            session.step = 'done';
            await answerCallback(env.BOT_TOKEN, callback.id, `✅ ${session.semester}`);
            
            const summary = `📋 *Registration Complete!*\n\n👤 Name: ${session.name}\n🏛️ University: ${session.university}\n📚 Semester: ${session.semester}`;
            
            await sendMessage(env.BOT_TOKEN, chatId, summary, 'Markdown', {
              inline_keyboard: [
                [{ text: '✅ Confirm', callback_data: 'confirm' }],
                [{ text: '🔄 Start Over', callback_data: 'restart' }]
              ]
            });
            return new Response('OK', { status: 200 });
          }
        }
        
        return new Response('OK', { status: 200 });
      } catch (error) {
        console.error('Error:', error);
        return new Response('Error', { status: 500 });
      }
    }
    
    return new Response('🤖 Bot is running! Visit /setwebhook to set up.', { status: 200 });
  }
};

// ===== Helper Functions =====
async function sendMessage(token: string, chatId: number, text: string, parseMode?: string, replyMarkup?: any) {
  const body: any = { chat_id: chatId, text };
  if (parseMode) body.parse_mode = parseMode;
  if (replyMarkup) body.reply_markup = replyMarkup;
  
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

async function answerCallback(token: string, callbackId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackId, text })
  });
}
