import { Telegraf, session, Context } from 'telegraf';

// Define student data structure
interface StudentData {
  name?: string;
  university?: string;
  semester?: string;
  step: 'idle' | 'name' | 'university' | 'semester' | 'done';
}

// Session context type
interface SessionContext extends Context {
  session: StudentData;
}

const bot = new Telegraf<SessionContext>(process.env.BOT_TOKEN!);

// Session middleware (in-memory)
bot.use(session({
  defaultSession: () => ({
    step: 'idle'
  })
}));

// Start command
bot.command('start', async (ctx) => {
  const session = ctx.session;
  
  if (session.step === 'done' && session.name) {
    await ctx.reply(
      `👋 Welcome back, ${session.name}!\n\n📋 Your info:\n🏛️ ${session.university}\n📚 ${session.semester}`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Update Info', callback_data: 'restart' }]
          ]
        }
      }
    );
    return;
  }

  // Start registration
  session.step = 'name';
  await ctx.reply('🎓 Let\'s register you!\n\nWhat\'s your full name?');
});

// Handle name input
bot.on('text', async (ctx) => {
  const session = ctx.session;
  
  if (session.step === 'idle') {
    await ctx.reply('Send /start to register!');
    return;
  }

  if (session.step === 'name') {
    session.name = ctx.message.text;
    session.step = 'university';
    
    await ctx.reply(`✅ Got it! Your name: *${session.name}*`, { parse_mode: 'Markdown' });
    
    await ctx.reply('Select your university:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🏛️ Harvard', callback_data: 'uni_harvard' }],
          [{ text: '🌲 Stanford', callback_data: 'uni_stanford' }],
          [{ text: '🎓 MIT', callback_data: 'uni_mit' }],
          [{ text: '✏️ Other (type manually)', callback_data: 'uni_other' }]
        ]
      }
    });
    return;
  }

  if (session.step === 'university') {
    session.university = ctx.message.text;
    session.step = 'semester';
    
    await ctx.reply(`✅ Got it: *${session.university}*`, { parse_mode: 'Markdown' });
    
    await ctx.reply('What\'s your current semester?', {
      reply_markup: {
        inline_keyboard: [
          [1, 2, 3, 4].map(s => ({ text: `${s}`, callback_data: `sem_${s}` })),
          [5, 6, 7, 8].map(s => ({ text: `${s}`, callback_data: `sem_${s}` })),
          [{ text: '📚 Graduate', callback_data: 'sem_grad' }]
        ]
      }
    });
    return;
  }

  if (session.step === 'semester') {
    session.semester = ctx.message.text;
    session.step = 'done';
    
    const summary = `📋 *Registration Complete!*\n\n👤 Name: ${session.name}\n🏛️ University: ${session.university}\n📚 Semester: ${session.semester}`;
    
    await ctx.reply(summary, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Confirm', callback_data: 'confirm' }],
          [{ text: '🔄 Start Over', callback_data: 'restart' }]
        ]
      }
    });
    return;
  }
});

// Handle callback queries (buttons)
bot.on('callback_query', async (ctx) => {
  const session = ctx.session;
  const data = ctx.callbackQuery.data;

  if (data === 'restart') {
    session.step = 'idle';
    delete session.name;
    delete session.university;
    delete session.semester;
    await ctx.answerCbQuery('🔄 Restarting...');
    await ctx.reply('Send /start to register again!');
    return;
  }

  if (data === 'confirm') {
    session.step = 'done';
    await ctx.answerCbQuery('✅ Registration saved!');
    await ctx.reply('🎉 You\'re registered! Send /start to see your info.');
    return;
  }

  // University selection
  if (data.startsWith('uni_')) {
    const uniMap: Record<string, string> = {
      'uni_harvard': 'Harvard University',
      'uni_stanford': 'Stanford University',
      'uni_mit': 'Massachusetts Institute of Technology',
      'uni_other': 'Other'
    };
    
    if (data === 'uni_other') {
      session.step = 'university';
      await ctx.answerCbQuery('✏️ Type your university name');
      await ctx.reply('Please type your university name:');
    } else {
      session.university = uniMap[data] || data;
      session.step = 'semester';
      await ctx.answerCbQuery(`✅ Selected: ${session.university}`);
      
      await ctx.reply(`✅ Selected: *${session.university}*`, { parse_mode: 'Markdown' });
      
      await ctx.reply('What\'s your current semester?', {
        reply_markup: {
          inline_keyboard: [
            [1, 2, 3, 4].map(s => ({ text: `${s}`, callback_data: `sem_${s}` })),
            [5, 6, 7, 8].map(s => ({ text: `${s}`, callback_data: `sem_${s}` })),
            [{ text: '📚 Graduate', callback_data: 'sem_grad' }]
          ]
        }
      });
    }
    return;
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
    await ctx.answerCbQuery(`✅ Semester: ${session.semester}`);
    
    const summary = `📋 *Registration Complete!*\n\n👤 Name: ${session.name}\n🏛️ University: ${session.university}\n📚 Semester: ${session.semester}`;
    
    await ctx.reply(summary, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Confirm', callback_data: 'confirm' }],
          [{ text: '🔄 Start Over', callback_data: 'restart' }]
        ]
      }
    });
    return;
  }
});

// Webhook handler for Cloudflare Workers
export interface Env {
  BOT_TOKEN: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      
      // Set webhook
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

      // Handle webhook
      if (url.pathname === '/webhook') {
        const update = await request.json();
        bot.handleUpdate(update);
        return new Response('OK', { status: 200 });
      }

      return new Response('Bot is running! Visit /setwebhook to set up.', { status: 200 });
    } catch (error) {
      console.error('Error:', error);
      return new Response('Error', { status: 500 });
    }
  }
};
