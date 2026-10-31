import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import electronBinary from 'electron'

const userDataPath = mkdtempSync(join(tmpdir(), 'stok-takip-stress-'))
const testFile = fileURLToPath(new URL('./database.stress.test.js', import.meta.url))

try {
  const result = spawnSync(electronBinary, ['--no-sandbox', '--disable-gpu', testFile], {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, STOK_TEST_USER_DATA: userDataPath }
  })

  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
  if (result.error) throw result.error
  process.exitCode = result.status ?? 1
} finally {
  rmSync(userDataPath, { recursive: true, force: true })
}
