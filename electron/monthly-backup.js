import { access, mkdir, rename, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'
import { getDatabase } from './database.js'

const BACKUP_HOUR = 23
const BACKUP_MINUTE = 55
let scheduledBackup = null
const activePeriods = new Set()

function formatPeriod(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function endOfMonthBackupTime(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, BACKUP_HOUR, BACKUP_MINUTE, 0, 0)
}

async function fileExists(filePath) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

async function createMonthlyBackup(period, reason) {
  if (activePeriods.has(period)) return
  activePeriods.add(period)

  const backupDirectory = join(app.getPath('userData'), 'backups')
  const backupPath = join(backupDirectory, `stok-takip-${period}.db`)
  const temporaryPath = `${backupPath}.${process.pid}.tmp`

  try {
    await mkdir(backupDirectory, { recursive: true })
    if (await fileExists(backupPath)) return

    await unlink(temporaryPath).catch(() => {})
    await getDatabase().backup(temporaryPath)
    await rename(temporaryPath, backupPath)
    await writeFile(`${backupPath}.json`, JSON.stringify({
      period,
      createdAt: new Date().toISOString(),
      reason,
      database: 'SQLite',
      backupFile: backupPath
    }, null, 2), 'utf8')
    console.info(`Aylık veritabanı yedeği oluşturuldu: ${backupPath}`)
  } catch (error) {
    await unlink(temporaryPath).catch(() => {})
    console.error(`Aylık veritabanı yedeği oluşturulamadı (${period}):`, error)
  } finally {
    activePeriods.delete(period)
  }
}

function scheduleNextBackup() {
  if (scheduledBackup) clearTimeout(scheduledBackup)

  const now = new Date()
  let target = endOfMonthBackupTime(now)
  if (target <= now) target = endOfMonthBackupTime(new Date(now.getFullYear(), now.getMonth() + 1, 1))

  scheduledBackup = setTimeout(async () => {
    await createMonthlyBackup(formatPeriod(target), 'scheduled')
    scheduleNextBackup()
  }, Math.max(1000, target.getTime() - now.getTime()))
  scheduledBackup.unref?.()
}

export function startMonthlyBackupScheduler() {
  const now = new Date()
  const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const previousMonthDeadline = endOfMonthBackupTime(previousMonth)

  if (now > previousMonthDeadline) {
    void createMonthlyBackup(formatPeriod(previousMonth), 'startup-catch-up')
  }

  if (now > endOfMonthBackupTime(now)) {
    void createMonthlyBackup(formatPeriod(now), 'startup-catch-up')
  }

  scheduleNextBackup()
}

export function stopMonthlyBackupScheduler() {
  if (scheduledBackup) clearTimeout(scheduledBackup)
  scheduledBackup = null
}
