import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { EventEmitter, once } from 'node:events'
import { createServer as createHttpServer } from 'node:http'
import { createServer } from 'node:net'
import { test } from 'node:test'

import {
  assertNotInterrupted,
  buildDevClientUrl,
  buildExpoEnvironment,
  chooseSimulator,
  findAvailablePort,
  isPortAvailable,
  metroIsReady,
  parseArguments,
  parseAvailableIphones,
  stopChildren,
} from './ios-dev.mjs'

const simctlOutput = JSON.stringify({
  devices: {
    'com.apple.CoreSimulator.SimRuntime.iOS-25-0': [
      {
        name: 'iPhone 16 Pro',
        udid: 'old-shutdown',
        state: 'Shutdown',
        isAvailable: true,
      },
      {
        name: 'iPhone 16',
        udid: 'old-booted',
        state: 'Booted',
        isAvailable: true,
      },
    ],
    'com.apple.CoreSimulator.SimRuntime.iOS-26-5': [
      {
        name: 'iPhone 17 Pro',
        udid: 'new-shutdown',
        state: 'Shutdown',
        isAvailable: true,
      },
      {
        name: 'iPad Pro',
        udid: 'ipad',
        state: 'Booted',
        isAvailable: true,
      },
      {
        name: 'iPhone unavailable',
        udid: 'unavailable',
        state: 'Shutdown',
        isAvailable: false,
      },
    ],
  },
})

test('parseAvailableIphones prefers a booted iPhone and excludes unavailable devices', () => {
  const devices = parseAvailableIphones(simctlOutput)

  assert.deepEqual(
    devices.map(({ name, udid }) => ({ name, udid })),
    [
      { name: 'iPhone 16', udid: 'old-booted' },
      { name: 'iPhone 17 Pro', udid: 'new-shutdown' },
      { name: 'iPhone 16 Pro', udid: 'old-shutdown' },
    ],
  )
})

test('chooseSimulator targets an explicit name or UDID instead of the booted default', () => {
  const devices = parseAvailableIphones(simctlOutput)

  assert.equal(chooseSimulator(devices).udid, 'old-booted')
  assert.equal(chooseSimulator(devices, 'iPhone 17 Pro').udid, 'new-shutdown')
  assert.equal(chooseSimulator(devices, 'NEW-SHUTDOWN').name, 'iPhone 17 Pro')
})

test('chooseSimulator reports available names when an explicit device is missing', () => {
  const devices = parseAvailableIphones(simctlOutput)

  assert.throws(
    () => chooseSimulator(devices, 'iPhone 99'),
    /Available iPhones: iPhone 16, iPhone 17 Pro, iPhone 16 Pro/,
  )
})

test('findAvailablePort skips ports already owned by another process', async () => {
  const occupied = new Set([8081, 8082])

  assert.equal(await findAvailablePort(8081, async (port) => !occupied.has(port)), 8083)
})

test('isPortAvailable detects a server listening outside IPv4 localhost', async (context) => {
  const server = createServer()
  await new Promise((resolve) => server.listen(0, '::', resolve))
  context.after(() => server.close())

  assert.equal(await isPortAvailable(server.address().port), false)
})

test('metroIsReady requires a running Metro for the expected project root', async (context) => {
  const projectRoot = '/expected project/π'
  const server = createHttpServer((request, response) => {
    assert.equal(request.url, '/status')
    response.setHeader('X-React-Native-Project-Root', encodeURI(projectRoot))
    response.end('packager-status:running')
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  context.after(() => server.close())
  const port = server.address().port

  assert.equal(await metroIsReady(port, projectRoot), true)
  assert.equal(await metroIsReady(port, '/another/worktree'), false)
})

test('stopChildren interrupts each active child without touching exited children', () => {
  const active = Object.assign(new EventEmitter(), {
    exitCode: null,
    pid: 123,
    signals: [],
    kill(signal) {
      this.signals.push(signal)
    },
  })
  const exited = Object.assign(new EventEmitter(), {
    exitCode: 0,
    pid: 456,
    signals: [],
    kill(signal) {
      this.signals.push(signal)
    },
  })

  const processSignals = []
  stopChildren(new Set([active, exited]), (pid, signal) => processSignals.push({ pid, signal }))

  assert.deepEqual(processSignals, [{ pid: -123, signal: 'SIGTERM' }])
  assert.deepEqual(active.signals, [])
  assert.deepEqual(exited.signals, [])
})

test('stopChildren terminates a command and its grandchild process', async (context) => {
  const child = spawn(
    process.execPath,
    [
      '-e',
      `const { spawn } = require('node:child_process');
       const grandchild = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)']);
       console.log(grandchild.pid);
       setInterval(() => {}, 1000);`,
    ],
    { detached: true, stdio: ['ignore', 'pipe', 'ignore'] },
  )
  context.after(() => {
    try {
      process.kill(-child.pid, 'SIGKILL')
    } catch {}
  })
  const [line] = await once(child.stdout, 'data')
  const grandchildPid = Number(line.toString().trim())

  stopChildren([child])
  const [, signal] = await once(child, 'exit')

  assert.equal(signal, 'SIGTERM')
  await assert.rejects(
    async () => {
      for (let attempts = 0; attempts < 20; attempts += 1) {
        process.kill(grandchildPid, 0)
        await new Promise((resolve) => setTimeout(resolve, 25))
      }
    },
    { code: 'ESRCH' },
  )
})

test('an interrupt during an async probe prevents the next command from starting', async () => {
  const probe = Promise.withResolvers()
  let interruptedSignal
  let commandStarted = false
  const flow = (async () => {
    await probe.promise
    assertNotInterrupted(interruptedSignal, 'start Metro')
    commandStarted = true
  })()

  interruptedSignal = 'SIGTERM'
  probe.resolve()

  await assert.rejects(flow, /Cannot start Metro after SIGTERM/)
  assert.equal(commandStarted, false)
})

test('parseArguments accepts the argument separator forwarded by pnpm', () => {
  assert.equal(parseArguments(['--', '--port', '8083']).port, 8083)
})

test('buildDevClientUrl pins the development client to this Metro port', () => {
  assert.equal(
    buildDevClientUrl('example', 8083),
    'exp+example://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8083',
  )
})

test('buildExpoEnvironment pins Expo and React Native to this Metro port', () => {
  const environment = buildExpoEnvironment(8083)

  assert.equal(environment.EXPO_PACKAGER_PROXY_URL, 'http://127.0.0.1:8083')
  assert.equal(environment.RCT_METRO_PORT, '8083')
})
