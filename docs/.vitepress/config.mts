import { defineConfig } from 'vitepress'

const version = process.env.DOCS_VERSION ?? 'main'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  base: `/vitepress-poc-202603/docs/${version}/`,  // GitHub Pages用にリポジトリ名を含める
  title: "My Awesome Project",
  description: "A VitePress Site",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'main', link: 'https://kentaro-wada.github.io/vitepress-poc-202603/docs/main/' },
      { text: 'v1.1.0', link: 'https://kentaro-wada.github.io/vitepress-poc-202603/docs/v1.1.0/' }
    ],

    sidebar: [
      {
        text: 'Examples',
        items: [
          { text: 'Markdown Examples', link: '/markdown-examples' },
          { text: 'Runtime API Examples', link: '/api-examples' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/vuejs/vitepress' }
    ]
  }
})
