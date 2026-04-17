import { buildCli } from './cli.js'

type RuntimeProcess = {
  argv: string[]
  exitCode?: number
}

const runtimeProcess = (globalThis as { process?: RuntimeProcess }).process

export async function main(argv = runtimeProcess?.argv ?? []): Promise<void> {
  buildCli().parse(argv)
}
