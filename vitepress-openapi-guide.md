# vitepress-openapi 実装ガイド

## 前提条件

- VitePress 1.x系（安定版）を使用すること
- `package.json` に `"type": "module"` が設定されていること
- `config.ts` ではなく `config.mts` を使用すること

```bash
npm install vitepress@latest
npm install vitepress-openapi
npm install js-yaml
npm install -D @types/js-yaml
```

---

## 表示の仕組み

```
ビルド時（Node.js）
  generate-openapi-pages.ts
    → yamlを走査
    → 中継mdを生成（<OASpecFromFile spec-path="..." /> を含む）
    → VitePressがmdをHTMLとしてビルド
    → この時点では <OASpecFromFile> はプレースホルダーのまま

ブラウザ実行時
    → ページを開くとVueが起動
    → OASpecFromFile.vue の onMounted が発火
    → import.meta.glob でyamlを非同期読み込み
    → useOpenapi({ spec }) でスペックをセット
    → <OASpec /> がレンダリングされUIが表示される
```

骨格のHTMLはビルド時に生成されるが、**OpenAPIのUI部分はブラウザ上でランタイムにレンダリングされる**。
これがVitePressの検索インデックスが効かない根本原因で、検索インデックスはビルド時のmdのテキストコンテンツを対象にするため、ランタイムで描画されるコンテンツは対象外になる。

---

## ファイル構成

```
docs/
├── .vitepress/
│   ├── config.mts
│   ├── sidebar.ts
│   ├── generate-office-pages.ts
│   ├── generate-openapi-pages.ts
│   └── theme/
│       ├── index.ts
│       ├── OASpecFromFile.vue
│       └── custom.css
└── 機能分類A/
    └── 共通/
        └── API仕様/
            └── エンドポイント1.yaml
```

---

## 1. theme/index.ts

`OASpecFromFile` をグローバルコンポーネントとして登録する。
`useOpenapi` はページごとに動的に呼び出すため、ここでは呼ばない。

```ts
import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import { theme } from 'vitepress-openapi/client'
import 'vitepress-openapi/dist/style.css'
import './custom.css'
import OASpecFromFile from './OASpecFromFile.vue'

export default {
  extends: DefaultTheme,
  async enhanceApp(ctx) {
    theme.enhanceApp(ctx as any)
    ctx.app.component('OASpecFromFile', OASpecFromFile)
  }
} satisfies Theme
```

---

## 2. theme/OASpecFromFile.vue

### ポイント
- `import.meta.glob` のパスは `.vitepress/theme/` からの相対パスで指定する
- `docs/` 配下のyamlを対象にする場合は `../../` から始まる
- `spec-path` には `docs/` からの相対パスを渡す

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useOpenapi, OASpec } from 'vitepress-openapi/client'
import jsYaml from 'js-yaml'

const props = defineProps<{ specPath: string }>()
const ready = ref(false)

onMounted(async () => {
  // ../../ は .vitepress/theme/ から docs/ への相対パス
  const modules = import.meta.glob('../../**/*.{yaml,yml}', { as: 'raw' })

  const key = `../../${props.specPath}`

  const loader = modules[key]
  if (!loader) {
    console.error(`OpenAPI spec not found: ${key}`)
    return
  }

  const raw = await loader()
  const spec = jsYaml.load(raw) as object
  useOpenapi({ spec })
  ready.value = true
})
</script>

<template>
  <OASpec v-if="ready" />
  <p v-else>Loading...</p>
</template>
```

---

## 3. generate-openapi-pages.ts

ビルド前にyamlを走査し、中継mdページを一時生成する。
ビルド後に `buildEnd()` で削除する。

検索インデックスに対応するため、yamlからテキストを抽出して非表示divとして中継mdに埋め込む。
VitePressはビルド時にmdのテキストコンテンツをインデックス化するため、この非表示divが検索対象になる。
ブラウザ上では `display: none` で非表示にする（後述のcss参照）。

```ts
import fs from 'fs'
import path from 'path'
import jsYaml from 'js-yaml'

const DOCS_ROOT = path.resolve(__dirname, '..')
const OPENAPI_EXTS = ['.yaml', '.yml']

function isOpenApiSpec(filePath: string): boolean {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    return /^(openapi|swagger)\s*:/m.test(content)
  } catch {
    return false
  }
}

function extractSearchText(spec: any): string {
  const texts: string[] = []

  // API全体の情報
  if (spec.info?.title)       texts.push(spec.info.title)
  if (spec.info?.description) texts.push(spec.info.description)

  // 各エンドポイントの情報
  for (const [, pathItem] of Object.entries(spec.paths ?? {})) {
    for (const [, operation] of Object.entries(pathItem as any)) {
      if (typeof operation !== 'object') continue
      if (operation.summary)     texts.push(operation.summary)
      if (operation.description) texts.push(operation.description)
      if (operation.operationId) texts.push(operation.operationId)
      for (const tag of operation.tags ?? []) texts.push(tag)
      for (const param of operation.parameters ?? []) {
        if (param.name)        texts.push(param.name)
        if (param.description) texts.push(param.description)
      }
    }
  }

  // スキーマ
  for (const [name, schema] of Object.entries(spec.components?.schemas ?? {})) {
    texts.push(name)
    if ((schema as any).description) texts.push((schema as any).description)
    for (const [propName, prop] of Object.entries((schema as any).properties ?? {})) {
      texts.push(propName)
      if ((prop as any).description) texts.push((prop as any).description)
    }
  }

  return texts.filter(Boolean).join(' ')
}

const GENERATED: string[] = []

function walk(dir: string) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue

    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      walk(fullPath)
    } else if (OPENAPI_EXTS.includes(path.extname(entry.name).toLowerCase())) {
      if (!isOpenApiSpec(fullPath)) continue

      const content = fs.readFileSync(fullPath, 'utf-8')
      const spec = jsYaml.load(content) as any
      const searchText = extractSearchText(spec)

      const relPath = path.relative(DOCS_ROOT, fullPath).replace(/\\/g, '/')
      const title = entry.name.replace(/\.(yaml|yml)$/, '')
      const mdPath = fullPath + '.api.md'

      fs.writeFileSync(mdPath, `---
title: ${title}
aside: false
outline: false
---

<div class="oa-search-index">
${searchText}
</div>

<OASpecFromFile spec-path="${relPath}" />
`, 'utf-8')

      GENERATED.push(mdPath)
    }
  }
}

export function generateOpenApiPages() {
  walk(DOCS_ROOT)
  return GENERATED
}

export function cleanupOpenApiPages(files: string[]) {
  for (const f of files) {
    if (fs.existsSync(f)) fs.unlinkSync(f)
  }
}
```

### 検索インデックスに含まれるフィールド

| フィールド | 例 |
|---|---|
| `info.title` | ユーザー管理API |
| `info.description` | ユーザーの取得・作成・更新・削除を行うAPI |
| `paths[*][*].summary` | ユーザー取得 |
| `paths[*][*].description` | 指定したIDのユーザー情報を取得します |
| `paths[*][*].operationId` | getUserById |
| `paths[*][*].tags` | Users |
| `paths[*][*].parameters[*].name` | userId |
| `paths[*][*].parameters[*].description` | ユーザーID |
| `components.schemas[*]` (name) | User |
| `components.schemas[*].description` | ユーザー情報 |
| `components.schemas[*].properties[*]` (name) | email |
| `components.schemas[*].properties[*].description` | メールアドレス |

---

## 4. sidebar.ts（OpenAPI対応部分）

```ts
const OPENAPI_EXTS = ['.yaml', '.yml']

// buildItems 内の分岐に追加
} else if (OPENAPI_EXTS.includes(path.extname(entry.name).toLowerCase())) {
  items.push({
    text: `📄 ${entry.name.replace(/\.(yaml|yml)$/, '')}`,
    link: `${urlPath}.api`,  // .yaml.api.md → .yaml.api
  })
}
```

---

## 5. config.mts

```ts
import { defineConfig } from 'vitepress'
import { generateSidebar } from './sidebar'
import { generateOfficePages, cleanupOfficePages } from './generate-office-pages'
import { generateOpenApiPages, cleanupOpenApiPages } from './generate-openapi-pages'

const version = process.env.DOCS_VERSION ?? 'main'
const generatedOffice = generateOfficePages()
const generatedOpenApi = generateOpenApiPages()

export default defineConfig({
  base: `/your-repo/docs/${version}/`,
  title: `MyDocs (${version})`,
  srcExclude: [
    '**/*.xlsx', '**/*.docx', '**/*.pptx',
    '**/*.yaml', '**/*.yml',
  ],
  themeConfig: {
    search: {
      provider: 'local',
      options: {
        miniSearch: {
          options: {
            tokenize: (term) => {
              if (typeof term === 'string') term = term.toLowerCase()
              const segmenter = Intl.Segmenter && new Intl.Segmenter('ja-JP', { granularity: 'word' })
              if (!segmenter) return [term]
              const tokens: string[] = []
              for (const seg of segmenter.segment(term)) {
                // @ts-ignore
                if (seg.segment.trim() !== '') tokens.push(seg.segment)
              }
              return tokens
            },
          },
          searchOptions: {
            tokenize: (term) => {
              if (typeof term === 'string') term = term.toLowerCase()
              const segmenter = Intl.Segmenter && new Intl.Segmenter('ja-JP', { granularity: 'word' })
              if (!segmenter) return [term]
              const tokens: string[] = []
              for (const seg of segmenter.segment(term)) {
                // @ts-ignore
                if (seg.segment.trim() !== '') tokens.push(seg.segment)
              }
              return tokens
            },
          },
        },
      },
    },
    sidebar: generateSidebar(),
  },
  buildEnd() {
    cleanupOfficePages(generatedOffice)
    cleanupOpenApiPages(generatedOpenApi)
  },
})
```

---

## 6. theme/custom.css

```css
/* Officeリンクボタン */
.office-link-button {
  display: inline-block;
  margin-top: 1rem;
  padding: 0.6rem 1.2rem;
  background-color: var(--vp-c-brand);
  color: #fff !important;
  border-radius: 6px;
  text-decoration: none;
  font-weight: bold;
}
.office-link-button:hover {
  opacity: 0.85;
}

/* 検索インデックス用テキスト（非表示） */
.oa-search-index {
  display: none;
}
```
