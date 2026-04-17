import { buildCli } from './cli.js'

type RuntimeProcess = {
  argv: string[]
  exitCode?: number
}

const runtimeProcess = (globalThis as { process?: RuntimeProcess }).process

export async function main(argv = runtimeProcess?.argv ?? []): Promise<void> {
  buildCli().parse(argv)
}

const currentFile = new URL(import.meta.url).pathname

if (runtimeProcess?.argv[1] === currentFile) {
  void main().catch((error: unknown) => {
    console.error(error)
    runtimeProcess.exitCode = 1
  })
}
