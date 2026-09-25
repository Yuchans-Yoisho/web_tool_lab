# ちょい決めツール

ルーレット、あみだくじ、サイコロを個別URLで公開する調査用の静的サイトです。サーバー処理、データベース、外部パッケージはありません。公開前の確認項目は PREPUBLISH.md にあります。

## ローカルで確認

このディレクトリで Python の簡易サーバーを起動します。

    python3 -m http.server 8000 --bind 127.0.0.1

http://127.0.0.1:8000/ を開きます。

## 公開手順

静的サイトを配信できるサービスへ、このディレクトリ全体を配置します。ビルドコマンドは不要です。公開前に実際の URL と配信サービスを決め、プライバシーページの配信事業者に関する説明を更新してください。

GitHub Pages を選ぶ場合の手順:

1. GitHub で空の公開リポジトリを新規作成します。README やライセンスの自動追加は選ばず、空のまま作成します。
2. このディレクトリで以下を実行します。URL は作成したリポジトリのものに置き換えます。

       git remote add origin https://github.com/ACCOUNT/REPOSITORY.git
       git push -u origin main

3. リポジトリ設定の Pages → Build and deployment → Deploy from a branch → main / (root) を選びます。
4. 表示された公開 URL を開き、3つの機能、プライバシーページ、HTTPS を確認します。

GitHub Pages は公開リポジトリの内容が閲覧可能になるため、鍵や個人情報を入れないでください。GitHub Pages の通常のURLは、たとえば https://ACCOUNT.github.io/REPOSITORY/roulette.html です。独自ドメインのユーザーサイトを作り、プロジェクトのリポジトリ名を tool にすると https://example.com/tool/roulette.html のようなURLにもできます。現在の相対リンクはどちらの配置にも対応します。

公開 URL が決まったら sitemap.xml を生成します。

    python3 scripts/make_sitemap.py https://example.com/tool/

## GA4

GA4 のウェブデータストリームを作り、assets/config.js の TOOL_LAB_GA_ID に測定 ID（G- で始まるもの）を設定してから公開します。未設定では Google のスクリプトを読み込まず、解析イベントも送信しません。公開後に Tag Assistant またはブラウザの Network タブで送信を確認します。

イベントは tool_generate（3ツール）と tool_reveal（あみだくじの結果表示）で、tool_name パラメータにツール名を設定します。GA4 で tool_name をイベントスコープのカスタムディメンションとして登録すると、ツール別の集計に使えます。入力文字列・結果文字列は送信しません。

Search Console には公開後にサイトの所有権を登録し、検索クエリ・表示回数・クリック数を確認します。サイトマップは公開 URL が決まってから追加します。

## セキュリティ上の設計

- 入力はすべてブラウザ内で処理し、保存も送信もしません。
- ユーザー入力を HTML として挿入せず、textContent を使います。
- 候補数と各行の長さを制限します。
- crypto.getRandomValues を使い、範囲への変換には偏りを避ける方法を使います。
- Content Security Policy で読み込み先と通信先を制限します。配信先が決まれば HTTP ヘッダー側でも設定できます。

公開リポジトリに解析の管理者権限、API キー、個人情報を置かないでください。GA4 の測定 ID は秘密情報ではありません。
