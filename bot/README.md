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

   - `LINE_CHANNEL_SECRET` … **基本設定**タブの「Channel secret」
   - `LINE_CHANNEL_ACCESS_TOKEN` … **Messaging API設定**タブの「チャネルアクセストークン（長期）」で［発行］を押して表示されるトークン
   - `OPENAI_API_KEY` … OpenAI の API キー
   - `TAVILY_API_KEY` … （任意）Web検索ツール用。[Tavily](https://tavily.com/) で無料APIキー取得可
   **Access Token の場所:** [LINE Developers コンソール](https://developers.line.biz/console/) → チャネルを選択 → **「Messaging API設定」タブ**を開く → 「チャネルアクセストークン（長期）」の［発行］で取得（Channel ID / Channel Secret がある「基本設定」とは別タブです）。

## 起動（ローカル）

```bash
cd bot && npm install && npm start
```

Express サーバー（`index.js`）が起動し、`GET /health` と `POST /webhook` が使えます。LINE の Webhook 確認には ngrok などで HTTPS トンネルを張ってください。

## Webhook

- LINE の Webhook URL を `https://<あなたのドメイン>/webhook` に設定する
- 本番（Vercel）・ローカルとも **Express**（`index.js`）の `POST /webhook` が使われる

## Vercel にデプロイする

1. [Vercel](https://vercel.com) でプロジェクトをインポート（リポジトリの **ルートではなく `bot` をルートにしたい場合**は、Vercel の「Root Directory」を `bot` に設定する）
2. 環境変数を設定する（Settings → Environment Variables）
   - `LINE_CHANNEL_SECRET`
   - `LINE_CHANNEL_ACCESS_TOKEN`
   - `OPENAI_API_KEY`
   - `TAVILY_API_KEY`（任意・Web検索用）
3. デプロイ後、LINE の Webhook URL を  
   `https://<あなたのVercelドメイン>/webhook`  
   に設定する

**ルートがリポジトリ直下のとき**は、Vercel の「Root Directory」に `bot` を指定し、Framework を **Express** にしておくと `index.js` がエントリとしてビルドされます。

## 機能

- **Tool use**: モデルが `search_web` を必要に応じて呼び出します。
- **Thinking**: モデルが返す reasoning などは Vercel のログに `[thoughts]` として出し、返信テキストには含めません（reasoning 対応モデル利用時）。
- **公開Web検索**: 実装済み。`TAVILY_API_KEY` を設定すると有効です。
- **Instagram @iizuna.local.night のクロール**: 公式APIは投稿取得に審査が必要で、スクレイピングは利用規約違反のため**未実装**。実装する場合は Instagram Graph API（ビジネス/クリエイターアカウント）の利用申請が必要です。
- **Google Drive の RAG**: 実装は**やや重い**。サービスアカウントまたは OAuth、Drive API でファイル一覧・取得、テキスト抽出、Embedding + ベクトル検索の組み合わせが必要です。必要なら別モジュールで設計するのがおすすめです。
