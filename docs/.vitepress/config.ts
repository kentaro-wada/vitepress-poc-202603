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
  srcExclude: ['**/*.xlsx', '**/*.docx', '**/*.pptx', '**/*.xls', '**/*.doc', '**/*.ppt'],
  
  themeConfig: {
    nav: generateNav(),
    sidebar: generateSidebar(),

  },

  buildEnd() {
    cleanupOfficePages(generatedFiles)
  },
})
