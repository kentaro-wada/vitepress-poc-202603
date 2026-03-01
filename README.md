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

ブランチをプッシュするたびに対応するディレクトリへ自動デプロイされ、他バージョンのディレクトリには影響しません。一度デプロイされたディレクトリは削除されないため、過去のバージョンのドキュメントも保持され続けます。

---

## ファイル構成

```
your-repo/
├── docs/
│   └── .vitepress/
│       ├── config.ts
│       ├── sidebar.ts
│       └── generate-office-pages.ts
└── .github/
    └── workflows/
        └── deploy-docs.yml          # デプロイワークフロー
```

### docs/.vitepress/config.ts

```ts
import { defineConfig } from 'vitepress'

const version = process.env.DOCS_VERSION ?? 'main'
const navVersions = ['main', 'v1.1.0'] // 必要なバージョンをここに列挙

const isBuild = process.env.NODE_ENV === 'production'; // 環境変数でビルドかどうかを判定

const generatedFiles = isBuild ? generateOfficePages() : []; // ビルド時のみ一時ファイルを生成

export default defineConfig({
  base: `/your-repo/docs/${version}/`,
  title: `MyDocs (${version})`,
  themeConfig: {
    nav: navVersions.map(v => ({ text: v, link: `https://your-org.github.io/your-repo/docs/${v}/` }))
  },
  buildEnd() {
    cleanupOfficePages(generatedFiles)
  },
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

---

## 運用手順

### 導入時（初回のみ）

**1. ワークフローファイルを配置してmainにプッシュする**

上記2ファイルをリポジトリに追加してプッシュします。プッシュと同時にワークフローが発火し、`docs/main/` へのデプロイが完了します。

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

`docs/.vitepress/config.ts` の `navVersions` に新バージョンを追加します。

```ts
const navVersions = ['main', 'v1.1.0', 'v1.2.0'] // 新バージョンを追加
```

この変更を **mainブランチとバージョンブランチの両方** にコミットします。

```bash
# mainブランチに反映
git checkout main
git add docs/.vitepress/config.ts
git commit -m "docs: add v1.2.0 to nav"
git push origin main

# バージョンブランチにも反映
git checkout v1.2.0
git merge main  # または cherry-pick
git push origin v1.2.0
```
