# ちょい決めツール

ルーレット、あみだくじ、サイコロを個別URLで公開する調査用の静的サイトです。サーバー処理、データベース、外部パッケージはありません。確認項目は PREPUBLISH.md にあります。

公開サイト: https://yuchans-yoisho.github.io/web_tool_lab/

GitHub Pages の github.io URL で無広告公開し、GA4 と Search Console で利用状況を調べます。独自ドメインや収益化は、調査結果を見てから判断します。

## ローカルで確認

このディレクトリで Python の簡易サーバーを起動します。

    python3 -m http.server 8000 --bind 127.0.0.1

http://127.0.0.1:8000/ を開きます。

## 公開と更新

公開リポジトリ: https://github.com/Yuchans-Yoisho/web_tool_lab

`main` ブランチのルートを GitHub Pages で配信しています。静的ファイルだけで構成され、ビルドコマンドは不要です。更新時はローカルのチェックを通し、`main` にコミットして `git push origin main` で反映します。公開URLを変更したときは、canonical URL とサイトマップを合わせて更新します。

サイトマップの生成コマンド:

    python3 scripts/make_sitemap.py https://yuchans-yoisho.github.io/web_tool_lab/

GitHub Pages はリポジトリの内容が閲覧可能になるため、鍵や個人情報を入れないでください。

## GA4

GA4 のウェブデータストリームの測定 ID（G- で始まるもの）を assets/config.js に設定しています。タグの挿入までは実ブラウザで確認済みです。GA4 のリアルタイム画面で実際の受信を確認します。

イベントは tool_generate（3ツール）と tool_reveal（あみだくじの結果表示）で、tool_name パラメータにツール名を設定します。GA4 で tool_name をイベントスコープのカスタムディメンションとして登録すると、ツール別の集計に使えます。入力文字列・結果文字列は送信しません。

Search Console にサイトの所有権を登録し、検索クエリ・表示回数・クリック数を確認します。サイトマップは公開 URL に配置済みです。

調査ではツール別の閲覧数、利用回数、再訪、検索表示回数・クリック数を記録します。無広告の期間は売上が発生しないため、GA4 だけで黒字化を判断せず、収益化を検討する段階で広告収入等の見込みと運用費用を別途試算します。

## セキュリティ上の設計

- 入力はすべてブラウザ内で処理し、保存も送信もしません。
- ユーザー入力を HTML として挿入せず、textContent を使います。
- 候補数と各行の長さを制限します。
- crypto.getRandomValues を使い、範囲への変換には偏りを避ける方法を使います。
- Content Security Policy で読み込み先と通信先を制限します。配信先が決まれば HTTP ヘッダー側でも設定できます。

公開リポジトリに解析の管理者権限、API キー、個人情報を置かないでください。GA4 の測定 ID は秘密情報ではありません。
