import { Bot, Context, session, SessionFlavor, webhookCallback } from "grammy";
import { type Conversation, type ConversationFlavor, conversations, createConversation } from "@grammyjs/conversations";

// ====== 1. Define Student Data Structure ======
interface StudentData {
  name?: string;
  university?: string;
  semester?: string;
  completed: boolean;
}

// ====== 2. Session & Context Types ======
interface SessionData {
  student: StudentData;
}
type MyContext = Context & SessionFlavor<SessionData> & ConversationFlavor;
type MyConversation = Conversation<MyContext>;

// ====== 3. Conversation: Collect Student Info ======
async function studentRegistration(conversation: MyConversation, ctx: MyContext) {
  // Reset data
  conversation.session.student = { completed: false };
  
  // Ask Name with inline keyboard confirmation
  await ctx.reply("🎓 Let's register you!\n\nWhat's your full name?");
  const nameCtx = await conversation.waitFor("message:text");
  conversation.session.student.name = nameCtx.msg.text;
  await ctx.reply(`✅ Got it! Your name: *${nameCtx.msg.text}*`, { parse_mode: "Markdown" });

  // Ask University with button options
  const uniKeyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🏛️ Harvard", callback_data: "uni_harvard" }],
        [{ text: "🌲 Stanford", callback_data: "uni_stanford" }],
        [{ text: "🎓 MIT", callback_data: "uni_mit" }],
        [{ text: "✏️ Other (type manually)", callback_data: "uni_other" }]
      ]
    }
  };
  await ctx.reply("Select your university:", uniKeyboard);
  
  // Wait for button press or text
  let uniResponse = await conversation.waitFor(
    (ctx) => ctx.message?.text || ctx.callbackQuery?.data?.startsWith("uni_")
  );
  
  if (uniResponse.callbackQuery) {
    const data = uniResponse.callbackQuery.data;
    const uniMap: Record<string, string> = {
      "uni_harvard": "Harvard University",
      "uni_stanford": "Stanford University", 
      "uni_mit": "Massachusetts Institute of Technology"
    };
    conversation.session.student.university = uniMap[data] || data.replace("uni_", "");
    await uniResponse.answerCallbackQuery();
    await ctx.reply(`✅ Selected: *${conversation.session.student.university}*`, { parse_mode: "Markdown" });
  } else {
    conversation.session.student.university = uniResponse.msg.text;
    await ctx.reply(`✅ Got it: *${uniResponse.msg.text}*`, { parse_mode: "Markdown" });
  }

  // Ask Semester with number buttons
  const semKeyboard = {
    reply_markup: {
      inline_keyboard: [
        [1, 2, 3, 4].map(s => ({ text: `${s}`, callback_data: `sem_${s}` })),
        [5, 6, 7, 8].map(s => ({ text: `${s}`, callback_data: `sem_${s}` })),
        [{ text: "📚 Graduate", callback_data: "sem_grad" }]
      ]
    }
  };
  await ctx.reply("What's your current semester?", semKeyboard);
  
  const semCtx = await conversation.waitForCallbackQuery(/^sem_/);
  const semValue = semCtx.callbackQuery.data.replace("sem_", "");
  const semesterMap: Record<string, string> = {
    "1": "1st Semester", "2": "2nd Semester", "3": "3rd Semester",
    "4": "4th Semester", "5": "5th Semester", "6": "6th Semester",
    "7": "7th Semester", "8": "8th Semester", "grad": "Graduate Student"
  };
  conversation.session.student.semester = semesterMap[semValue] || semValue;
  await semCtx.answerCallbackQuery();
  await ctx.reply(`✅ Semester: *${conversation.session.student.semester}*`, { parse_mode: "Markdown" });

  // Show summary with confirmation button
  const s = conversation.session.student;
  const summary = `📋 *Registration Complete!*\n\n👤 Name: ${s.name}\n🏛️ University: ${s.university}\n📚 Semester: ${s.semester}`;
  
  await ctx.reply(summary, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "✅ Confirm & Save", callback_data: "confirm_registration" }],
        [{ text: "🔄 Start Over", callback_data: "restart_registration" }]
      ]
    }
  });

  // Wait for confirmation
  const confirmCtx = await conversation.waitForCallbackQuery(["confirm_registration", "restart_registration"]);
  
  if (confirmCtx.callbackQuery.data === "confirm_registration") {
    s.completed = true;
    await confirmCtx.answerCallbackQuery("✅ Registration saved!");
    await ctx.reply("🎉 You're registered! Use /start again to re-register.");
  } else {
    await confirmCtx.answerCallbackQuery("🔄 Restarting...");
    // Recursive call to start over
    await studentRegistration(conversation, ctx);
  }
}

// ====== 4. Main Bot Setup ======
export interface Env {
  BOT_TOKEN: string;
  BOT_INFO: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const bot = new Bot<MyContext>(env.BOT_TOKEN, {
      botInfo: JSON.parse(env.BOT_INFO || '{}')
    });

    // Session setup (in-memory storage - works with Cloudflare)
    bot.use(session({
      initial: () => ({
        student: { completed: false }
      })
    }));

    // Conversation plugin
    bot.use(conversations());
    bot.use(createConversation(studentRegistration));

    // Commands
    bot.command("start", async (ctx) => {
      if (ctx.session.student.completed) {
        const s = ctx.session.student;
        await ctx.reply(
          `👋 Welcome back, ${s.name}!\n\n📋 Your info:\n🏛️ ${s.university}\n📚 ${s.semester}`,
          { reply_markup: { inline_keyboard: [[{ text: "🔄 Update Info", callback_data: "restart_registration" }]] } }
        );
      } else {
        await ctx.conversation.enter("studentRegistration");
      }
    });

    // Handle registration confirm/restart from conversation
    bot.callbackQuery("restart_registration", async (ctx) => {
      await ctx.answerCallbackQuery();
      await ctx.conversation.enter("studentRegistration");
    });

    // Echo fallback
    bot.on("message", (ctx) => ctx.reply("Send /start to register!"));

    return webhookCallback(bot, "cloudflare-mod")(request);
  }
};
