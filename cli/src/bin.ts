import { main } from './index.js'

type RuntimeProcess = {
  argv: string[]
  exitCode?: number
}

const runtimeProcess = (globalThis as { process?: RuntimeProcess }).process

void main(runtimeProcess?.argv ?? []).catch((error: unknown) => {
  console.error(error)
  if (runtimeProcess) {
    runtimeProcess.exitCode = 1
  }
})
