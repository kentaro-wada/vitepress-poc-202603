import { defineConfig } from 'vitepress'
import { generateNav } from './nav'
import { generateSidebar } from './sidebar'
import { generateOfficePages, cleanupOfficePages } from './generate-office-pages'

const version = process.env.DOCS_VERSION ?? 'main'

const generatedFiles = process.env.NODE_ENV === 'production' ? generateOfficePages() : []; // ビルド時のみ一時ファイルを生成

// https://vitepress.dev/reference/site-config
export default defineConfig({
  base: `/vitepress-poc-202603/docs/${version}/`,  // GitHub Pages用にリポジトリ名を含める
  title: "My Awesome Project",
  description: "A VitePress Site",
  
  // OfficeファイルをVitePressのビルド成果物に含めない
  srcExclude: ['**/*.xlsx', '**/*.docx', '**/*.pptx', '**/*.xls', '**/*.doc', '**/*.ppt'
    , '**/*.yaml', '**/*.yml', '**/*.json'  // OpenAPIスペック本体も除外
  ],
  
  themeConfig: {
    nav: generateNav(),
    sidebar: generateSidebar(),
    search: {
      provider: 'local',
      options: {
        miniSearch: {
          // インデックス構築時（options）と検索時（searchOptions）で同じトークナイザーを使用
          // 日本語の場合：Intl.Segmenterを使って単語単位で分割し、さらにCJK文字は文字単位でも分割して部分一致検索を可能にする
          // 例：「ドキュメント」は「ド」「キ」「ュ」「メ」「ン」「ト」と「ドキュメント」の両方で検索可能 
          // 英語の場合：単語単位で分割し、1文字のトークンは無視（例："a"や"i"など）
          // 例：「VitePress」は「vitepress」で検索可能、「Vite」や「Press」では検索できない  
          options: {
            tokenize: (text: string) => {
              const segmenter = new Intl.Segmenter('ja', { granularity: 'word' })
              const tokens: string[] = []
              
              // CJK文字の正規表現
              const cjkRegex = /[\u3000-\u9fff\uac00-\ud7af\uf900-\ufaff]/
              
              for (const segment of segmenter.segment(text)) {
                const { segment: word } = segment
                if (cjkRegex.test(word)) {
                  // 日本語: 文字単位に分割（部分一致検索のため）
                  tokens.push(...word.split(''))
                  tokens.push(word) // 単語全体も追加
                } else if (word.trim() && word.length > 1) {
                  // 英語: 単語単位
                  tokens.push(word.toLowerCase())
                }
              }
              return tokens
            },
          },
          searchOptions: {
            tokenize: (text: string) => {
              const segmenter = new Intl.Segmenter('ja', { granularity: 'word' })
              const tokens: string[] = []
              const cjkRegex = /[\u3000-\u9fff\uac00-\ud7af\uf900-\ufaff]/
              
              for (const segment of segmenter.segment(text)) {
                const { segment: word } = segment
                if (cjkRegex.test(word)) {
                  tokens.push(...word.split(''))
                  tokens.push(word)
                } else if (word.trim() && word.length > 1) {
                  tokens.push(word.toLowerCase())
                }
              }
              return tokens
            },
          },
        },
        locales: {
          root: {
            translations: {
              button: { buttonText: '検索', buttonAriaLabel: '検索' },
              modal: {
                noResultsText: '見つかりませんでした',
                resetButtonTitle: 'クリア',
                footer: { selectText: '選択', navigateText: '移動', closeText: '閉じる' },
              },
            },
          },
        },
      },
    },
  },

  buildEnd() {
    cleanupOfficePages(generatedFiles)
  },
})
