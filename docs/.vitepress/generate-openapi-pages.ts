import fs from 'fs'
import path from 'path'
import { createMarkdownFromOpenApi } from '@scalar/openapi-to-markdown'

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

const GENERATED: string[] = []

async function walk(dir: string) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue

    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      await walk(fullPath)
    } else if (OPENAPI_EXTS.includes(path.extname(entry.name).toLowerCase())) {
      if (!isOpenApiSpec(fullPath)) continue

      const spec = fs.readFileSync(fullPath, 'utf-8')
      const title = entry.name.replace(/\.(yaml|yml)$/, '')
      const mdPath = fullPath + '.api.md'

      // yaml文字列をそのまま渡す
      const body = await createMarkdownFromOpenApi(spec)

      fs.writeFileSync(mdPath, `---
title: ${title}
---

${body}
`, 'utf-8')

      GENERATED.push(mdPath)
    }
  }
}

export async function generateOpenApiPages() {
  await walk(DOCS_ROOT)
  return GENERATED
}

export function cleanupOpenApiPages(files: string[]) {
  for (const f of files) {
    if (fs.existsSync(f)) fs.unlinkSync(f)
  }
}