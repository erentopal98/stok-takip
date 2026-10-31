import { spawn, spawnSync } from 'node:child_process'
import { createServer } from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const viteCli = path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js')
const electronCli = path.join(projectRoot, 'node_modules', 'electron', 'cli.js')
const startPort = 5173
const maxPort = 5190
const viteTimeoutMs = 90000
let viteProcess = null
let electronProcess = null
let isShuttingDown = false

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

async function fetchWithTimeout(url, timeoutMs = 1500) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function isThisProjectVite(port) {
  const baseUrl = `http://127.0.0.1:${port}`
  try {
    const [page, viteClient] = await Promise.all([
      fetchWithTimeout(`${baseUrl}/`),
      fetchWithTimeout(`${baseUrl}/@vite/client`),
    ])
    const html = await page.text()
    return page.ok && viteClient.ok && html.includes('<title>stok-takip</title>')
  } catch {
    return false
  }
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = createServer()
    server.once('error', () => resolve(false))
    server.listen(port, '127.0.0.1', () => {
      server.close(() => resolve(true))
    })
  })
}

async function findVitePort() {
  for (let port = startPort; port <= maxPort; port += 1) {
    if (await isThisProjectVite(port)) {
      console.log(`[VITE] Mevcut Stok Takip Vite sunucusu kullanılacak: http://127.0.0.1:${port}`)
      return { port, reuse: true }
    }
    if (await isPortAvailable(port)) return { port, reuse: false }
  }
  throw new Error(`${startPort}-${maxPort} aralığında kullanılabilir bir geliştirme portu bulunamadı.`)
}

function spawnLogged(label, command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    ...options,
  })
  child.on('error', (error) => console.error(`[${label}] Süreç başlatılamadı:`, error))
  return child
}

async function waitForVite(port, child) {
  const pageUrl = `http://127.0.0.1:${port}/`
  const deadline = Date.now() + viteTimeoutMs
  while (Date.now() < deadline) {
    if (child?.exitCode !== null && child?.exitCode !== undefined) {
      throw new Error(`Vite beklenmedik şekilde kapandı (kod ${child.exitCode}).`)
    }
    try {
      const response = await fetchWithTimeout(pageUrl, 1000)
      if (response.ok) return
    } catch {
      // Vite may still be optimizing dependencies on a cold start.
    }
    await delay(300)
  }
  throw new Error(`Vite sunucusu ${viteTimeoutMs / 1000} saniye içinde yanıt vermedi: ${pageUrl}`)
}

function stopProcessTree(child) {
  if (!child || child.exitCode !== null || child.killed) return
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  } else {
    child.kill('SIGTERM')
  }
}

async function shutdown(exitCode = 0) {
  if (isShuttingDown) return
  isShuttingDown = true
  stopProcessTree(electronProcess)
  stopProcessTree(viteProcess)
  await delay(100)
  process.exit(exitCode)
}

process.on('SIGINT', () => { void shutdown(130) })
process.on('SIGTERM', () => { void shutdown(143) })

async function main() {
  const { port, reuse } = await findVitePort()
  const devServerUrl = `http://127.0.0.1:${port}`

  if (!reuse) {
    viteProcess = spawnLogged('VITE', process.execPath, [
      viteCli, '--host', '127.0.0.1', '--port', String(port), '--strictPort',
    ])
    viteProcess.once('exit', (code) => {
      if (electronProcess && !isShuttingDown) {
        console.error(`[VITE] Geliştirme sunucusu kapandı (kod ${code}).`)
        void shutdown(code || 1)
      }
    })
  }

  await waitForVite(port, reuse ? null : viteProcess)

  electronProcess = spawnLogged('ELECTRON', process.execPath, [electronCli, '.'], {
    env: {
      ...process.env,
      NODE_ENV: 'development',
      VITE_DEV_SERVER_URL: devServerUrl,
    },
  })

  const exitCode = await new Promise((resolve, reject) => {
    electronProcess.once('error', reject)
    electronProcess.once('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)))
  })
  await shutdown(exitCode)
}

main().catch(async (error) => {
  console.error('Geliştirme uygulaması başlatılamadı:', error.message)
  await shutdown(1)
})
