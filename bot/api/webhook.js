import { Client, validateSignature, LINE_SIGNATURE_HTTP_HEADER_NAME } from '@line/bot-sdk';
import OpenAI from 'openai';

export const config = {
  api: { bodyParser: false },
};

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function callOpenAI(openai, userMessage) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: userMessage }],
    max_tokens: 1024,
  });
  const content = completion.choices[0]?.message?.content?.trim();
  return content || '（応答が空でした）';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const {
    LINE_CHANNEL_SECRET,
    LINE_CHANNEL_ACCESS_TOKEN,
    OPENAI_API_KEY,
  } = process.env;

  if (!LINE_CHANNEL_SECRET || !LINE_CHANNEL_ACCESS_TOKEN || !OPENAI_API_KEY) {
    console.error('Missing LINE or OpenAI env vars');
    return res.status(500).json({ error: 'Server config error' });
  }

  const rawBody = await getRawBody(req);
  const signature = req.headers[LINE_SIGNATURE_HTTP_HEADER_NAME];
  if (!signature || !validateSignature(rawBody, LINE_CHANNEL_SECRET, signature)) {
    return res.status(401).end();
  }

  let body;
  try {
    body = JSON.parse(rawBody.toString());
  } catch {
    return res.status(400).end();
  }

  res.status(200).end();

  const events = body.events ?? [];
  const lineClient = new Client({
    channelSecret: LINE_CHANNEL_SECRET,
    channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN,
  });
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  for (const event of events) {
    if (event.type !== 'message' || event.message?.type !== 'text') continue;
    const userText = event.message.text;
    const replyToken = event.replyToken;
    try {
      const reply = await callOpenAI(openai, userText);
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
}
