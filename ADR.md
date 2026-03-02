# ADR: VitePress ドキュメントサイト構成

## ADR-001: ブランチバージョン別デプロイ構成

### ステータス
採用

### コンテキスト
VitePressを使ってmainブランチと開発中のバージョンブランチのドキュメントをGitHub Pagesに公開する必要がある。

### 決定
ブランチごとに独立してビルド・デプロイし、gh-pagesブランチ上の以下のディレクトリ構成に配置する。

```
docs/
├── main/
└── v1.1.0/
```

- `DOCS_VERSION` 環境変数でビルド時の `base` パスを切り替える
- `peaceiris/actions-gh-pages` の `keep_files: true` により他バージョンのディレクトリを保持する
- ブランチプッシュをトリガーに GitHub Actions で自動デプロイする

### 却下した代替案
- 単一ブランチにまとめてビルドする → バージョン間の依存が生まれ管理が複雑になる

---

## ADR-002: ドキュメントのディレクトリ構成

### ステータス
採用

### コンテキスト
mdドキュメント・Officeドキュメント・OpenAPI仕様書を同一リポジトリで管理する必要がある。

### 決定
すべてのドキュメントを `docs/` 配下の同一ディレクトリ構成で管理する。

```
docs/
└── 機能分類A/
    └── 共通/
        └── 設計書種別1/
            ├── 設計書.md
            ├── 設計書.xlsx
            └── API仕様.yaml
```

### 却下した代替案
- Officeファイルを `office-docs/` に分離する → mdと管理場所が分散し、ディレクトリ構成の一貫性が失われる
- OpenAPIファイルを `docs/public/` に配置する → mdやOfficeファイルと同居できない（publicは静的ファイルの公開専用ディレクトリのため、mdが通常ページとしてレンダリングされなくなる）

---

## ADR-003: サイドバーの自動生成

### ステータス
採用

### コンテキスト
ドキュメントやディレクトリが増えるたびにサイドバーを手動編集するのは運用コストが高い。

### 決定
`sidebar.ts` でビルド時にディレクトリを再帰的に走査し、サイドバーを動的に構築する。ファイル種別ごとに以下のように扱う。

| ファイル種別 | サイドバーの表示 |
|---|---|
| `.md` | 通常リンク |
| Office系 (`.xlsx` `.docx` 等) | 📎 付きリンク（中継ページへ） |
| OpenAPI (`.yaml` `.yml`) | 📄 付きリンク（変換後mdへ） |
| ディレクトリ | collapsed グループ |

---

## ADR-004: Officeドキュメントの表示方法

### ステータス
採用

### コンテキスト
VitePressはOfficeファイルを直接レンダリングできない。

### 決定
ビルド時に `generate-office-pages.ts` がOfficeファイルを走査し、GitHubのファイルURLへのリンクを表示する中継mdページ（`.link.md`）を一時生成する。ビルド後に `buildEnd()` で削除する。Officeファイル本体は `srcExclude` でビルド成果物から除外する。

```
ビルド前: generate-office-pages.ts が .link.md を生成
ビルド中: VitePressが .link.md をページとして処理
ビルド後: buildEnd() で .link.md を削除
```

---

## ADR-005: OpenAPI仕様書の表示方法

### ステータス
採用（変更あり、ADR-006参照）

### コンテキスト
OpenAPIのyamlファイルをVitePressで閲覧可能な形式で表示する必要がある。

### 経緯と変更
当初は `vitepress-openapi` プラグインを使いブラウザ上で動的レンダリングする方針を採用した。しかし以下の問題が発生した。

- `import.meta.glob` のパス解決が複雑でデバッグコストが高い
- VitePressの検索インデックスが動的レンダリングコンテンツに効かない
- 検索対応のために別途テキスト抽出ロジックが必要になり構成が複雑化した

これらの問題を受けてADR-006に移行した。

---

## ADR-006: OpenAPI仕様書の表示方法（変更後）

### ステータス
採用

### コンテキスト
ADR-005の動的レンダリング方式では構成が複雑になりすぎた。よりシンプルで検索にも対応できる方式に切り替える。

### 決定
ビルド時に `@scalar/openapi-to-markdown` でyamlをmdに変換し、VitePressの通常ページとして表示する。

```
ビルド前: generate-openapi-pages.ts が yaml を md に変換
ビルド中: VitePressが変換済みmdを通常ページとして処理（検索インデックスも自動対応）
ビルド後: buildEnd() で生成mdを削除
```

### ライブラリ選定理由

以下の候補を比較した。

| ライブラリ | 最終更新 | 評価 |
|---|---|---|
| widdershins | 5年前 | ❌ メンテ停止 |
| openapi-markdown | 6年前 | ❌ 論外 |
| openapi-generator-cli | 活発 | △ Java実行環境が必要 |
| @scalar/openapi-to-markdown | 1日前 | ✅ 採用 |

`@scalar/openapi-to-markdown` を選定した理由は以下の通り。

- 更新が非常に活発（Scalarプロジェクトが母体）
- Node.jsから直接呼び出せるためVitePressのビルドパイプラインに組み込みやすい
- Java実行環境が不要

### 却下した代替案
- `vitepress-openapi` による動的レンダリング（ADR-005）→ 構成の複雑化・検索非対応
- redoc-cliでHTML化してiframe埋め込み → 検索非対応・VitePressのデザインと乖離
- yamlをコードブロックで表示 → 可読性が低い

---

## ADR-007: 日本語検索対応

### ステータス
採用

### コンテキスト
VitePressのローカル検索はデフォルトでスペースを単語区切りとするため、日本語の検索精度が低い。

### 決定
`Intl.Segmenter` を使った日本語トークナイズをインデックス作成時（`options`）と検索実行時（`searchOptions`）の両方に設定する。片方だけでは効果がない。

```ts
miniSearch: {
  options: {
    tokenize: (term) => { /* Intl.Segmenter による分割 */ }
  },
  searchOptions: {
    tokenize: (term) => { /* 同上 */ }
  }
}
```

### 却下した代替案
- `text.split('')` による1文字分割 → 機能するが精度が低い
- `_tokenize` オプション → 型定義に存在しない非公式オプション
- `vitepress-plugin-search` → 追加ライブラリの導入が必要
