import { chmod, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { build } from 'esbuild'

const currentDir = dirname(fileURLToPath(import.meta.url))
const cliRoot = resolve(currentDir, '..')
const entryFile = resolve(cliRoot, 'src/bin.ts')
const outFile = resolve(cliRoot, '..', 'bin', 'skill-governor')

await mkdir(dirname(outFile), { recursive: true })

await build({
  entryPoints: [entryFile],
  outfile: outFile,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  banner: {
    js: '#!/usr/bin/env node',
  },
  legalComments: 'none',
})

await chmod(outFile, 0o755)
