export const prerender = false;

import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';

const ANTHROPIC_API_KEY = import.meta.env.ANTHROPIC_API_KEY;

// The scripted questions the bot must walk through in order
const QUESTIONS: Record<number, string> = {
  2: "Whereabouts in the world are you from?",
  3: "Do you have any finance goals you're working on at the moment?",
  4: "What's your story and what got you interested in improving your finances?",
  5: "Mind if I ask a couple of questions to see if I can help?",
  6: "What is your number one struggle in your journey right now?",
  7: "What is your number one goal?",
  8: "Why is that goal important to you?",
  9: `Tell you what. Why don't we do this?\n\nLet's hop on a quick 15 to 30 minute call. We'll talk about your number one struggle, your number one goal. I'm going to help you come up with a game plan. Are you up for that?`,
};

const SYSTEM_PROMPT = `You are a friendly Instagram DM assistant for a financial content creator. Your job is to have a natural, warm conversation that guides new followers through a series of questions — one at a time.

RULES YOU MUST FOLLOW:
1. You MUST NEVER give financial advice, tips, strategies, or recommendations of any kind. If someone asks for financial advice, say something like: "Great question! That's exactly the kind of thing we could cover on a call together."
2. You MUST NEVER recommend specific investments, products, services, or financial actions.
3. Keep responses SHORT — this is Instagram DMs, not email. 1-3 sentences max for your acknowledgment.
4. Be genuine, warm, and conversational. Use casual language like you're texting a friend.
5. Acknowledge what the person said in a natural, human way before asking the next question.
6. Do NOT use emojis excessively — one per message max, and only when it feels natural.
7. Never break character or reveal you are an AI/bot.
8. If someone asks something off-topic, briefly acknowledge it, gently redirect, and continue with the next question.
9. If someone seems disinterested or negative, stay respectful and don't push.

You will be given the user's reply and the next question to ask. Generate a brief, natural acknowledgment of their reply, then transition into the next question. Return ONLY the message to send — no labels, no quotes, no formatting.`;

export const POST: APIRoute = async ({ request }) => {
  try {
    const { step, userReply, firstName } = await request.json();

    if (!step || !userReply) {
      return new Response(JSON.stringify({ error: 'step and userReply are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!ANTHROPIC_API_KEY) {
      console.error('Missing ANTHROPIC_API_KEY env var');
      return new Response(JSON.stringify({ error: 'Server config error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Step 9 follow-up: handle yes/no response to the call CTA
    if (step === 10) {
      const reply = userReply.toLowerCase().trim();
      const yesSignals = ['yes', 'yeah', 'yea', 'yep', 'sure', 'ok', 'okay', 'absolutely', 'down', 'let\'s do it', 'lets do it', 'i\'m down', 'im down', 'for sure', 'bet', 'sounds good', 'why not', 'let\'s go', 'lets go'];
      const isYes = yesSignals.some(signal => reply.includes(signal));

      if (isYes) {
        return new Response(JSON.stringify({
          message: `Love that ${firstName ? firstName : ''}! Just send the word "meet" and it'll shoot you over a link to book a time that works for you.`.trim(),
          action: 'book',
          done: true,
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } else {
        return new Response(JSON.stringify({
          message: `No worries at all${firstName ? ' ' + firstName : ''}! I'm glad you're here and enjoying the content. If you ever change your mind or have questions down the road, don't hesitate to reach out. We're glad to have you along for the journey!`,
          action: 'disengage',
          done: true,
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    const nextQuestion = QUESTIONS[step];
    if (!nextQuestion) {
      return new Response(JSON.stringify({ error: `Invalid step: ${step}` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    const userMessage = `The follower's name is ${firstName || 'unknown'}.
Their reply to the previous question: "${userReply}"
The next question to ask (step ${step} of 9): "${nextQuestion}"

Generate a natural acknowledgment of their reply, then smoothly transition into the next question. Keep it short and DM-friendly.`;

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const botMessage = response.content[0].type === 'text'
      ? response.content[0].text
      : '';

    return new Response(JSON.stringify({
      message: botMessage,
      step: step,
      done: step === 9,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('IG bot error:', e);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
