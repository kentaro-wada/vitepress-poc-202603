import { type DefaultTheme } from 'vitepress'
import fs from 'fs';
import path from 'path';

// ドキュメントのルートディレクトリを設定
const DOCS_ROOT = path.resolve(__dirname, '..');

// Officeファイルの拡張子リスト
const OFFICE_EXTS = ['.xlsx', '.docx', '.pptx', '.xls', '.doc', '.ppt'];

const OPENAPI_EXTS = ['.yaml', '.yml']

// ファイルがOfficeファイルかどうかを判定する関数
function isOfficeFile(name: string) {
  return OFFICE_EXTS.includes(path.extname(name).toLowerCase());
}

// 指定されたディレクトリ内のアイテムを再帰的に構築する関数
function buildItems(dir: string, urlBase: string): DefaultTheme.SidebarItem[] {
  // ディレクトリ内のエントリを取得し、名前順にソート
  const entries = fs.readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name, 'ja'));

  const items: DefaultTheme.SidebarItem[] = []; // サイドバーアイテムのリスト

  for (const entry of entries) {
    // 隠しファイルをスキップ
    if (entry.name.startsWith('.')) continue;

    const fullPath = path.join(dir, entry.name); // エントリのフルパス
    const urlPath = `${urlBase}/${entry.name}`; // URLパス

    if (entry.isDirectory()) {
      // ディレクトリの場合、再帰的に子アイテムを構築
      const children = buildItems(fullPath, urlPath);
      items.push({
        text: entry.name, // ディレクトリ名を表示
        collapsed: false, // アコーディオンを展開状態に設定
        items: children, // 子アイテムを設定
      });
    } else if (entry.name.endsWith('.md')) {
      // Markdownファイルの場合
      if (entry.name.endsWith('.link.md')) {
        // `.link.md`ファイルはスキップ
        continue;
      }
      if (entry.name === 'index.md') {
        // index.mdはトップページとして扱う
        items.unshift({
          text: 'トップページ',
          link: urlBase,
        });
      } else {
        // その他のMarkdownファイルを追加
        items.push({
          text: entry.name.replace(/\.md$/, ''), // 拡張子を除去して表示
          link: urlPath.replace(/\.md$/, ''), // 拡張子を除去してリンクを設定
        });
      }
    } else if (isOfficeFile(entry.name)) {
      // Officeファイルの場合
      items.push({
        text: `📎 ${entry.name}`, // ファイル名を表示
        link: `${urlPath}.link`, 
      });
    } else if (OPENAPI_EXTS.includes(path.extname(entry.name).toLowerCase())) {
        items.push({
          text: `📄 ${entry.name.replace(/\.(yaml|yml)$/, '')}`,
          link: `${urlPath}.api`,  // .yaml.api.md → .yaml.api
        })
      }
  }

  return items; // 構築したアイテムを返す
}

// サイドバーを生成する関数
export function generateSidebar() {

  // トップレベルのディレクトリを取得
  const topDirs = fs.readdirSync(DOCS_ROOT, { withFileTypes: true })
    .filter(e => e.isDirectory() && !e.name.startsWith('.')) // 隠しディレクトリをスキップ
    .sort((a, b) => a.name.localeCompare(b.name, 'ja'));

  const sidebar: Record<string, DefaultTheme.SidebarItem[]> = {};

  for (const dir of topDirs) {
    const key = `/${dir.name}/`; // サイドバーのキーを設定
    sidebar[key] = buildItems(path.join(DOCS_ROOT, dir.name), `/${dir.name}`); // アイテムを構築
  }

  return sidebar;
}