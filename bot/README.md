# LINE Bot (OpenAI)

LINE のメッセージを OpenAI API に送り、返答をそのまま返すボットです。

## セットアップ

1. [LINE Developers](https://developers.line.biz/) でチャネル（Messaging API）を作成する
2. [OpenAI](https://platform.openai.com/) で API キーを取得する
3. `bot/` でパッケージをインストール

   ```bash
   cd bot && npm install
   ```

4. 環境変数を設定（`.env` を作るか、`.env.example` をコピーして編集）

   - `LINE_CHANNEL_SECRET` … LINE チャネルのシークレット
   - `LINE_CHANNEL_ACCESS_TOKEN` … LINE チャネルのアクセストークン
   - `OPENAI_API_KEY` … OpenAI の API キー
   - `PORT` … サーバー番号（省略時は 3000）

## 起動

```bash
npm start
```

開発時は `npm run dev` でファイル変更時に再起動されます。

## Webhook

- LINE の Webhook URL を `https://<あなたのドメイン>/webhook` に設定する
- ローカル確認には ngrok などで HTTPS のトンネルを張る

## エンドポイント

- `GET /health` … 死活確認（ローカル用）
- `POST /webhook` … LINE からの Webhook（署名検証あり）

## Vercel にデプロイする

1. [Vercel](https://vercel.com) でプロジェクトをインポート（リポジトリの **ルートではなく `bot` をルートにしたい場合**は、Vercel の「Root Directory」を `bot` に設定する）
2. 環境変数を設定する（Settings → Environment Variables）
   - `LINE_CHANNEL_SECRET`
   - `LINE_CHANNEL_ACCESS_TOKEN`
   - `OPENAI_API_KEY`
3. デプロイ後、LINE の Webhook URL を  
   `https://<あなたのVercelドメイン>/webhook`  
   に設定する

**ルートがリポジトリ直下のとき**は、Vercel の「Root Directory」に `bot` を指定すると、`api/` と `vercel.json` が正しく使われます。
