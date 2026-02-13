import 'dotenv/config';
import express from 'express';
import { middleware, Client } from '@line/bot-sdk';
import OpenAI from 'openai';

const {
  LINE_CHANNEL_SECRET,
  LINE_CHANNEL_ACCESS_TOKEN,
  OPENAI_API_KEY,
  TAVILY_API_KEY,
  PORT = 3000,
} = process.env;

if (!LINE_CHANNEL_SECRET || !LINE_CHANNEL_ACCESS_TOKEN || !OPENAI_API_KEY) {
  console.error('Missing required env: LINE_CHANNEL_SECRET, LINE_CHANNEL_ACCESS_TOKEN, OPENAI_API_KEY');
  process.exit(1);
}

const lineConfig = {
  channelSecret: LINE_CHANNEL_SECRET,
  channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN,
};

const lineClient = new Client(lineConfig);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search_web',
      description: '公開Webを検索する。最新情報や事実確認が必要なときに使う。',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '検索クエリ（日本語可）' },
        },
        required: ['query'],
      },
    },
  },
];

async function runTool(name, args) {
  if (name === 'search_web') {
    const query = args?.query || '';
    if (!TAVILY_API_KEY) {
      return JSON.stringify({ error: 'TAVILY_API_KEY が未設定です。' });
    }
    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TAVILY_API_KEY}`,
        },
        body: JSON.stringify({ query, max_results: 5 }),
      });
      const data = await res.json();
      const results = (data.results || []).slice(0, 5).map((r) => ({
        title: r.title,
        url: r.url,
        content: (r.content || '').slice(0, 500),
      }));
      return JSON.stringify({ results }, null, 0);
    } catch (e) {
      console.error('Tavily search error:', e);
      return JSON.stringify({ error: String(e.message) });
    }
  }
  return JSON.stringify({ error: `Unknown tool: ${name}` });
}

function extractReplyAndThoughts(message) {
  const content = message.content;
  let replyText = '';
  const thoughts = [];

  if (Array.isArray(content)) {
    for (const part of content) {
      const type = part.type || part.role;
      const text = part.text ?? part.input_text ?? part.summary_text ?? '';
      if (type === 'reasoning' || type === 'input_text' || (type === 'summary' && text)) {
        thoughts.push(text);
      } else if (type === 'text' || typeof part.text === 'string') {
        replyText += (part.text || '').trim();
      }
    }
  } else if (typeof content === 'string') {
    replyText = content.trim();
  }

  return { replyText, thoughts };
}

async function callOpenAI(userMessage) {
  const messages = [{ role: 'user', content: userMessage }];
  const maxToolRounds = 5;
  let lastMessage;

  for (let round = 0; round < maxToolRounds; round++) {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      tools: TOOLS,
      tool_choice: 'auto',
      max_tokens: 1024,
    });

    lastMessage = completion.choices[0]?.message;
    if (!lastMessage) break;

    const { replyText, thoughts } = extractReplyAndThoughts(lastMessage);
    thoughts.forEach((t) => {
      if (t) console.log('[thoughts]', t);
    });

    const toolCalls = lastMessage.tool_calls;
    if (!toolCalls?.length) {
      return replyText || '（応答が空でした）';
    }

    messages.push({
      role: 'assistant',
      content: lastMessage.content || null,
      tool_calls: toolCalls,
    });

    for (const tc of toolCalls) {
      const name = tc.function?.name;
      let args = {};
      try {
        args = typeof tc.function?.arguments === 'string' ? JSON.parse(tc.function.arguments) : {};
      } catch (_) {}
      const result = await runTool(name, args);
      console.log('[tool]', name, args, '->', result?.slice(0, 200));
      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: result,
      });
    }
  }

  const { replyText } = extractReplyAndThoughts(lastMessage || {});
  return replyText?.trim() || '（応答が空でした）';
}

const app = express();

app.get('/health', (req, res) => {
  res.send('ok');
});

app.post('/webhook', middleware(lineConfig), async (req, res) => {
  const events = req.body?.events ?? [];
  console.log('webhook events:', JSON.stringify(events));

  const BOT_MENTION = '@Local Night AI';
  for (const event of events) {
    if (event.type !== 'message' || event.message?.type !== 'text') continue;
    const userText = event.message.text;
    if (!userText.startsWith(BOT_MENTION)) continue;
    const replyToken = event.replyToken;
    const prompt = userText.slice(BOT_MENTION.length).trim();
    try {
      const reply = await callOpenAI(prompt);
      await lineClient.replyMessage(replyToken, { type: 'text', text: reply });
    } catch (err) {
      console.error('OpenAI or reply error:', err);
      try {
        await lineClient.replyMessage(replyToken, {
          type: 'text',
          text: 'すみません、エラーで応答できませんでした。',
        });
      } catch (e) {
        console.error('Reply failed:', e);
      }
    }
  }

  res.sendStatus(200);
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Bot listening on port ${PORT}`);
  });
}

export default app;
