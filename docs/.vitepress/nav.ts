import { type DefaultTheme } from 'vitepress'

const navVersions = ['main', 'v1.1.0'] // 必要なバージョンをここに列挙

export function generateNav() : DefaultTheme.NavItem[] {
  return navVersions.map(v => 
    ({ 
        text: v,
        link: `https://kentaro-wada.github.io/vitepress-poc-202603/docs/${v}/`
    })
)
}