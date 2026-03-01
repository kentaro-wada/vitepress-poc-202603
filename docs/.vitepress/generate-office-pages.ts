import fs from 'fs'
import path from 'path'

// ドキュメントのルートディレクトリを設定
const DOCS_ROOT = path.resolve(__dirname, '..')

// 対応するOfficeファイルの拡張子リスト
const OFFICE_EXTS = ['.xlsx', '.docx', '.pptx', '.xls', '.doc', '.ppt']

// GitHub上のベースURLを設定
const GITHUB_BASE = 'https://github.com/your-org/your-repo/blob/main/docs'

// 生成されたMarkdownファイルのパスを格納する配列
const GENERATED: string[] = []

// 指定されたディレクトリを再帰的に探索する関数
function walk(dir: string, relBase: string) {
  // ディレクトリ内のエントリを取得
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    // 隠しファイルやディレクトリをスキップ
    if (entry.name.startsWith('.')) continue

    const fullPath = path.join(dir, entry.name) // エントリのフルパス
    const relPath = `${relBase}/${entry.name}` // エントリの相対パス

    if (entry.isDirectory()) {
      // ディレクトリの場合、再帰的に探索
      walk(fullPath, relPath)
    } else if (OFFICE_EXTS.includes(path.extname(entry.name).toLowerCase())) {
      // Officeファイルの場合、対応するMarkdownファイルを生成
      const mdPath = fullPath + '.link.md' // Markdownファイルのパス
      const githubUrl = `${GITHUB_BASE}${relPath}` // GitHub上のURL

      // Markdownファイルの内容を生成して書き込み
      fs.writeFileSync(mdPath, 
        `---
title: ${entry.name}
---

# ${entry.name}

このファイルはOfficeドキュメントです。

<a href="${githubUrl}" target="_blank" rel="noopener" class="office-link-button">
  GitHubで開く →
</a>
`, 'utf-8')

      // 生成されたファイルのパスを記録
      GENERATED.push(mdPath)
    }
  }
}

// Officeファイルに対応するMarkdownファイルを生成する関数
export function generateOfficePages() {
  walk(DOCS_ROOT, '') // ルートディレクトリから探索を開始
  return GENERATED // 生成されたファイルのリストを返す
}

// 生成されたMarkdownファイルを削除する関数
export function cleanupOfficePages(files: string[]) {
  for (const f of files) {
    // ファイルが存在する場合に削除
    if (fs.existsSync(f)) fs.unlinkSync(f)
  }
}