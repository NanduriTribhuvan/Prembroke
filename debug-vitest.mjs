import { startVitest } from 'vitest/node'

process.on('unhandledRejection', (e) => {
  console.error('UNHANDLED', e)
})

try {
  const vitest = await startVitest('test', ['src/shared/__tests__/calc.test.ts'], {
    watch: false
  })
  await vitest?.close()
} catch (e) {
  console.error('CAUGHT', e)
}
