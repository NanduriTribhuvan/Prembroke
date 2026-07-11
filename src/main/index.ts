import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { registerHermesIpc } from './hermes'
import { registerNewsIpc } from './news'
import { registerCalendarIpc } from './calendar'
import { registerOllamaIpc } from './ollama'
import { registerCloudAiIpc } from './cloudai'
import { registerEdgarIpc } from './edgar'
import { registerOptionsIpc } from './options'
import { registerExchangeIpc } from './exchange'
import { registerDeribitIpc } from './deribit'
import { registerDexIpc } from './dex'
import { registerMacroIpc } from './macro'
import { registerPricingIpc } from './pricing'

/** Window/taskbar icon. In dev this resolves to the repo's build resource; in a
 *  packaged build the embedded exe icon is used (this path is absent and ignored). */
const APP_ICON = join(__dirname, '../../build/icon.ico')

function loadRenderer(win: BrowserWindow, query?: string): void {
  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'] + (query ? `?${query}` : ''))
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), query ? { search: query } : undefined)
  }
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1600,
    height: 920,
    minWidth: 1240,
    minHeight: 720,
    show: false,
    backgroundColor: '#0b0a07',
    title: 'Prembroke — Conviction Terminal',
    icon: APP_ICON,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  win.on('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  loadRenderer(win)
}

/** Open a chromeless single-module window the user can drag to another monitor. */
function createPopout(moduleId: string): void {
  const win = new BrowserWindow({
    width: 760,
    height: 560,
    show: false,
    backgroundColor: '#0b0a07',
    title: `Prembroke · ${moduleId}`,
    icon: APP_ICON,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })
  win.on('ready-to-show', () => win.show())
  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })
  loadRenderer(win, `popout=${encodeURIComponent(moduleId)}`)
}

app.whenReady().then(() => {
  registerHermesIpc()
  registerNewsIpc()
  registerCalendarIpc()
  registerOllamaIpc()
  registerCloudAiIpc()
  registerEdgarIpc()
  registerOptionsIpc()
  registerExchangeIpc()
  registerDeribitIpc()
  registerDexIpc()
  registerMacroIpc()
  registerPricingIpc()
  ipcMain.handle('window:popout', (_e, moduleId: string) => createPopout(String(moduleId)))
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
