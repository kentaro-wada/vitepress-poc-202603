# VitePress ドキュメント GitHub Pages 公開ガイド

VitePressを使用してブランチバージョン別のmdドキュメントをGitHub Pagesに公開するための構成と運用手順です。

## デプロイ構成

各ブランチのドキュメントを以下のディレクトリ構成でGitHub Pagesに公開します。

```
https://your-org.github.io/your-repo/
└── docs/
    ├── main/       ← mainブランチのドキュメント
    └── v1.1.0/     ← バージョンブランチのドキュメント
```

ブランチをプッシュするたびに対応するディレクトリへ自動デプロイされ、他バージョンのディレクトリには影響しません。

---

## ファイル構成

```
your-repo/
├── docs/
│   └── .vitepress/
│       └── config.ts
└── .github/
    └── workflows/
        ├── deploy-docs.yml          # デプロイワークフロー
        └── delete-docs-version.yml  # バージョン削除ワークフロー
```

### docs/.vitepress/config.ts

```ts
import { defineConfig } from 'vitepress'

const version = process.env.DOCS_VERSION ?? 'main'

export default defineConfig({
  base: `/your-repo/docs/${version}/`,
  title: `MyDocs (${version})`,
  themeConfig: {
    nav: [
      { text: 'main',   link: 'https://your-org.github.io/your-repo/docs/main/' },
      { text: 'v1.1.0', link: 'https://your-org.github.io/your-repo/docs/v1.1.0/' },
    ]
  }
})
```

### .github/workflows/deploy-docs.yml

```yaml
name: Deploy Docs

on:
  push:
    branches:
      - main
      - 'v[0-9]+.[0-9]+.[0-9]+'
    paths:
      - 'docs/**'
      - '.github/workflows/deploy-docs.yml'

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - name: Set version label
        id: version
        run: echo "label=${GITHUB_REF_NAME}" >> $GITHUB_OUTPUT

      - name: Build VitePress
        env:
          DOCS_VERSION: ${{ steps.version.outputs.label }}
        run: npm run docs:build

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: docs/.vitepress/dist
          destination_dir: docs/${{ steps.version.outputs.label }}
          keep_files: true  # 他バージョンのディレクトリを保持する
```

### .github/workflows/delete-docs-version.yml

```yaml
name: Delete Docs Version

on:
  workflow_dispatch:
    inputs:
      version:
        description: '削除するバージョン (例: v1.1.0)'
        required: true
        type: string

jobs:
  delete:
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - uses: actions/checkout@v4
        with:
          ref: gh-pages

      - name: Delete version directory
        run: |
          TARGET="docs/${{ github.event.inputs.version }}"
          if [ -d "$TARGET" ]; then
            git rm -rf "$TARGET"
            git config user.name "github-actions[bot]"
            git config user.email "github-actions[bot]@users.noreply.github.com"
            git commit -m "docs: remove ${{ github.event.inputs.version }}"
            git push
          else
            echo "::error::ディレクトリ '$TARGET' が存在しません"
            exit 1
          fi
```

---

## 運用手順

### 導入時（初回のみ）

**1. ワークフローファイルを配置してmainにプッシュする**

上記3ファイルをリポジトリに追加してプッシュします。プッシュと同時にワークフローが発火し、`docs/main/` へのデプロイが完了します。

**2. GitHub PagesのSourceを設定する**

リポジトリの Settings → Pages で以下のように設定します。

| 項目 | 値 |
|------|----|
| Source | `gh-pages` ブランチ |
| Folder | `/ (root)` |

> gh-pagesブランチはワークフロー初回実行時に自動生成されるため、ワークフロー実行後に設定します。

**3. バージョン選択用のindexページを追加する（任意）**

`/docs/` へのアクセスを `main` に自動リダイレクトするページを手動でgh-pagesブランチにコミットします。

```bash
git fetch origin gh-pages
git checkout gh-pages
mkdir -p docs
echo '<meta http-equiv="refresh" content="0; url=./main/">' > docs/index.html
git add docs/index.html
git commit -m "docs: add index redirect"
git push origin gh-pages
git checkout main
```

---

### 新バージョンを追加するとき

**1. バージョンブランチを作成してプッシュする**

```bash
git checkout -b v1.1.0
git push origin v1.1.0
```

プッシュと同時にワークフローが発火し、`docs/v1.1.0/` へのデプロイが完了します。

**2. config.ts のナビゲーションに新バージョンを追記する**

`docs/.vitepress/config.ts` の `nav` に追記します。

```ts
nav: [
  { text: 'main',   link: '...docs/main/' },
  { text: 'v1.1.0', link: '...docs/v1.1.0/' },  // 追加
]
```

この変更を **mainブランチとバージョンブランチの両方** にコミットします。

```bash
# mainブランチに反映
git checkout main
git add docs/.vitepress/config.ts
git commit -m "docs: add v1.1.0 to nav"
git push origin main

# バージョンブランチにも反映
git checkout v1.1.0
git merge main  # または cherry-pick
git push origin v1.1.0
```

---

### 不要なバージョンを削除するとき

**1. GitHub ActionsのUIから削除ワークフローを実行する**

Actions → **Delete Docs Version** → **Run workflow** を開き、削除するバージョン名（例: `v1.1.0`）を入力して実行します。gh-pagesブランチの該当ディレクトリが削除されます。

**2. config.ts のナビゲーションから削除する**

残っている全ブランチの `config.ts` から該当バージョンのnav項目を削除してコミットします。

---

## 操作まとめ

| タイミング | 操作 | 自動/手動 |
|---|---|---|
| 初回導入 | ワークフローファイルをmainにプッシュ | 手動（1回のみ） |
| 初回導入 | GitHub PagesのSource設定 | 手動（1回のみ） |
| 初回導入 | `docs/index.html` をgh-pagesに追加 | 手動（1回のみ・任意） |
| mdを更新 | 対象ブランチにプッシュ | **自動**（プッシュで発火） |
| バージョン追加 | バージョンブランチを作成・プッシュ | **自動**（プッシュで発火） |
| バージョン追加 | config.ts のnavに追記・両ブランチにコミット | 手動 |
| バージョン削除 | Delete Docs Version ワークフローを実行 | 手動 |
| バージョン削除 | config.ts のnavから削除・残ブランチにコミット | 手動 |
