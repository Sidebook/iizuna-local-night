import 'dotenv/config';
import express from 'express';
import { middleware, Client } from '@line/bot-sdk';
import OpenAI from 'openai';

const {
  LINE_CHANNEL_SECRET,
  LINE_CHANNEL_ACCESS_TOKEN,
  OPENAI_API_KEY,
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

const app = express();

app.get('/health', (req, res) => {
  res.send('ok');
});

app.post('/webhook', middleware(lineConfig), async (req, res) => {
  res.sendStatus(200);
  const events = req.body?.events ?? [];
  console.log('webhook events:', JSON.stringify(events));
  for (const event of events) {
    if (event.type !== 'message' || event.message?.type !== 'text') continue;
    const userText = event.message.text;
    const replyToken = event.replyToken;
    try {
      const reply = await callOpenAI(userText);
      await lineClient.replyMessage(replyToken, { type: 'text', text: reply });
    } catch (err) {
      console.error('OpenAI or reply error:', err);
      await lineClient.replyMessage(replyToken, {
        type: 'text',
        text: 'すみません、エラーで応答できませんでした。',
      });
    }
  }
});

async function callOpenAI(userMessage) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: userMessage }],
    max_tokens: 1024,
  });
  const content = completion.choices[0]?.message?.content?.trim();
  return content || '（応答が空でした）';
}

app.listen(PORT, () => {
  console.log(`Bot listening on port ${PORT}`);
});
