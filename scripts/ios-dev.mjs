#!/usr/bin/env node

import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const EXAMPLE_DIR = join(REPO_ROOT, 'apps/example')
const METRO_TMP_DIR = join(EXAMPLE_DIR, '.expo/metro-tmp')
const DEFAULT_PORT = 8081
const MAX_PORT = 8181

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? REPO_ROOT,
    encoding: options.encoding,
    env: options.env ?? process.env,
    stdio: options.stdio ?? 'inherit',
  })
}

function capture(command, args, options = {}) {
  try {
    return run(command, args, {
      ...options,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  } catch {
    return null
  }
}

function observeChild(child) {
  return new Promise((resolve) => {
    child.once('error', (error) => resolve({ error }))
    child.once('exit', (code, signal) => resolve({ code, signal }))
  })
}

function assertChildSucceeded(outcome, label) {
  if (outcome.error) throw outcome.error
  if (outcome.code !== 0) {
    throw new Error(`${label} exited with code ${outcome.code ?? outcome.signal}.`)
  }
}

export function stopChildren(children, signalProcess = process.kill) {
  for (const child of children) {
    if (child.exitCode !== null || child.pid === undefined) continue
    try {
      signalProcess(-child.pid, 'SIGTERM')
    } catch {
      child.kill('SIGTERM')
    }
  }
}

export function assertNotInterrupted(signal, action) {
  if (signal) throw new Error(`Cannot ${action} after ${signal}.`)
}

export function hasExampleAppKey(environmentValue, envFileContents) {
  if (environmentValue?.trim()) return true
  if (envFileContents === undefined) return false

  try {
    return Boolean(parseEnv(envFileContents).EXPO_PUBLIC_YOUVERSION_APP_KEY?.trim())
  } catch {
    return false
  }
}

function runtimeVersion(runtime) {
  const match = runtime.match(/iOS-(\d+)(?:-(\d+))?(?:-(\d+))?$/)
  if (!match) return [0, 0, 0]
  return match.slice(1).map((part) => Number(part ?? 0))
}

function compareVersions(left, right) {
  for (let index = 0; index < left.length; index += 1) {
    const difference = right[index] - left[index]
    if (difference !== 0) return difference
  }
  return 0
}

export function parseAvailableIphones(simctlOutput) {
  const { devices } = JSON.parse(simctlOutput)

  return Object.entries(devices)
    .filter(([runtime]) => runtime.includes('SimRuntime.iOS-'))
    .flatMap(([runtime, runtimeDevices]) =>
      runtimeDevices
        .filter(
          (device) =>
            device.isAvailable !== false &&
            device.deviceTypeIdentifier?.startsWith('com.apple.CoreSimulator.SimDeviceType.iPhone-'),
        )
        .map((device) => ({ ...device, runtime })),
    )
    .sort((left, right) => {
      if (left.state === 'Booted' && right.state !== 'Booted') return -1
      if (right.state === 'Booted' && left.state !== 'Booted') return 1

      const versionOrder = compareVersions(
        runtimeVersion(left.runtime),
        runtimeVersion(right.runtime),
      )
      return versionOrder || left.name.localeCompare(right.name)
    })
}

export function chooseSimulator(devices, requestedDevice) {
  if (devices.length === 0) {
    throw new Error(
      'No available iPhone simulator was found. Install an iOS runtime in Xcode Device Hub.',
    )
  }

  if (!requestedDevice) return devices[0]

  const requested = requestedDevice.toLowerCase()
  const device = devices.find(
    (candidate) =>
      candidate.udid.toLowerCase() === requested || candidate.name.toLowerCase() === requested,
  )

  if (!device) {
    const names = [...new Set(devices.map((candidate) => candidate.name))]
    throw new Error(
      `Simulator "${requestedDevice}" was not found. Available iPhones: ${names.join(', ')}`,
    )
  }

  return device
}

export function isPortAvailable(port) {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.unref()
    server.once('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        resolve(false)
        return
      }
      reject(error)
    })
    server.listen(port, () => {
      server.close(() => resolve(true))
    })
  })
}

export async function findAvailablePort(startPort = DEFAULT_PORT, isAvailable = isPortAvailable) {
  for (let port = startPort; port <= MAX_PORT; port += 1) {
    if (await isAvailable(port)) return port
  }
  throw new Error(`No free Metro port found from ${startPort} through ${MAX_PORT}.`)
}

function portOwner(port) {
  const fields = capture('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-Fpc'])
  if (!fields) return null

  const pid = fields
    .split('\n')
    .find((line) => line.startsWith('p'))
    ?.slice(1)
  const command = fields
    .split('\n')
    .find((line) => line.startsWith('c'))
    ?.slice(1)
  const cwd = pid
    ? capture('lsof', ['-a', '-p', pid, '-d', 'cwd', '-Fn'])
        ?.split('\n')
        .find((line) => line.startsWith('n'))
        ?.slice(1)
    : null

  return { command, cwd, pid }
}

function describePortOwner(owner) {
  if (!owner) return 'another process'
  const process = [owner.command, owner.pid && `PID ${owner.pid}`].filter(Boolean).join(', ')
  return owner.cwd ? `${process || 'a process'} in ${owner.cwd}` : process
}

export function parseArguments(argv) {
  const options = {
    clean: false,
    doctor: false,
    help: false,
    device: process.env.IOS_SIMULATOR,
    port: undefined,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--') continue
    if (argument === '--clean') options.clean = true
    else if (argument === '--doctor') options.doctor = true
    else if (argument === '--help' || argument === '-h') options.help = true
    else if (argument === '--device' || argument === '-d') {
      if (argv[index + 1] === undefined) {
        throw new Error(`${argument} requires a simulator name or UDID.`)
      }
      options.device = argv[index + 1]
      index += 1
    } else if (argument === '--port' || argument === '-p') {
      if (argv[index + 1] === undefined) {
        throw new Error(`${argument} requires a port number.`)
      }
      options.port = Number(argv[index + 1])
      index += 1
    } else {
      throw new Error(`Unknown argument: ${argument}`)
    }
  }

  if (
    options.port !== undefined &&
    (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535)
  ) {
    throw new Error('--port requires a number from 1 through 65535.')
  }

  return options
}

export function buildDevClientUrl(slug, port) {
  const metroUrl = encodeURIComponent(`http://127.0.0.1:${port}`)
  return `exp+${slug}://expo-development-client/?url=${metroUrl}`
}

export function buildExpoEnvironment(port) {
  const metroUrl = `http://127.0.0.1:${port}`
  return {
    ...process.env,
    EXPO_PACKAGER_PROXY_URL: metroUrl,
    RCT_METRO_PORT: String(port),
  }
}

function readSimulators() {
  const output = capture('xcrun', ['simctl', 'list', 'devices', 'available', '-j'])
  if (!output) {
    throw new Error(
      'Unable to read iOS simulators. Run `xcode-select -p` and open Xcode Device Hub.',
    )
  }
  return parseAvailableIphones(output)
}

export async function metroIsReady(port, projectRoot = EXAMPLE_DIR) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/status`, {
      signal: AbortSignal.timeout(500),
    })
    return (
      (await response.text()).trim() === 'packager-status:running' &&
      response.headers.get('x-react-native-project-root') === encodeURI(projectRoot)
    )
  } catch {
    return false
  }
}

async function waitForMetro(port, childOutcome, timeoutMs = 30_000) {
  const startedAt = Date.now()
  let outcome
  void childOutcome.then((value) => {
    outcome = value
  })

  while (Date.now() - startedAt < timeoutMs) {
    if (outcome) {
      if (outcome.error) throw outcome.error
      throw new Error(`Metro exited with code ${outcome.code ?? outcome.signal}.`)
    }
    if (await metroIsReady(port)) return
    const owner = portOwner(port)
    if (owner && owner.cwd !== EXAMPLE_DIR) {
      const error = new Error(`Metro port ${port} was claimed by ${describePortOwner(owner)}.`)
      error.code = 'METRO_PORT_CONFLICT'
      throw error
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  throw new Error(`Metro was not ready for ${EXAMPLE_DIR} on port ${port} within 30 seconds.`)
}

function printHelp() {
  console.log(`Usage: pnpm dev:ios [options]

Options:
  --device, -d <name|UDID>  Target a specific iPhone simulator
  --port, -p <port>         Use a specific Metro port
  --clean                   Regenerate ios/ and clear Metro's cache
  --doctor                  Check the local iOS development environment
  --help, -h                Show this help

Set IOS_SIMULATOR to make a simulator name or UDID the default.`)
}

function check(label, value, okay = Boolean(value)) {
  console.log(`${okay ? 'PASS' : 'FAIL'}  ${label}: ${value || 'not found'}`)
  return okay
}

async function doctor() {
  console.log(`Repository: ${REPO_ROOT}`)
  console.log(`Commit: ${capture('git', ['rev-parse', '--short', 'HEAD']) ?? 'unknown'}`)

  let healthy = true
  healthy = check('Node', capture('node', ['--version'])) && healthy
  healthy = check('pnpm', capture('pnpm', ['--version'])) && healthy
  healthy = check('Xcode', capture('xcodebuild', ['-version'])) && healthy
  healthy = check('CocoaPods', capture('pod', ['--version'])) && healthy
  healthy =
    check(
      'Dependencies',
      existsSync(join(REPO_ROOT, 'node_modules')) ? 'installed' : 'run pnpm install',
      existsSync(join(REPO_ROOT, 'node_modules')),
    ) && healthy
  const envFilePath = join(EXAMPLE_DIR, '.env')
  let envFileContents
  try {
    envFileContents = readFileSync(envFilePath, 'utf8')
  } catch {}
  const appKeyConfigured = hasExampleAppKey(
    process.env.EXPO_PUBLIC_YOUVERSION_APP_KEY,
    envFileContents,
  )
  healthy =
    check(
      'Example app key',
      appKeyConfigured
        ? 'configured'
        : 'copy apps/example/.env or export EXPO_PUBLIC_YOUVERSION_APP_KEY',
      appKeyConfigured,
    ) && healthy

  try {
    const devices = readSimulators()
    healthy =
      check(
        'Available iPhones',
        devices
          .map((device) => `${device.name} (${device.state}, ${device.udid})`)
          .join('\n                   '),
        devices.length > 0,
      ) && healthy
  } catch (error) {
    healthy = check('Available iPhones', error.message, false) && healthy
  }

  const defaultPortFree = await isPortAvailable(DEFAULT_PORT)
  const owner = defaultPortFree ? null : portOwner(DEFAULT_PORT)
  console.log(
    `INFO  Metro port ${DEFAULT_PORT}: ${defaultPortFree ? 'available' : `occupied by ${describePortOwner(owner)}`}`,
  )
  if (!defaultPortFree) {
    try {
      console.log(`INFO  Next free Metro port: ${await findAvailablePort(DEFAULT_PORT + 1)}`)
    } catch (error) {
      healthy = check('Next free Metro port', error.message, false) && healthy
    }
  }

  console.log(
    `INFO  Native iOS project: ${existsSync(join(EXAMPLE_DIR, 'ios')) ? 'generated' : 'will be generated on first run'}`,
  )

  if (!healthy) process.exitCode = 1
}

async function dev(options) {
  const devices = readSimulators()
  const simulator = chooseSimulator(devices, options.device)
  const appConfig = JSON.parse(readFileSync(join(EXAMPLE_DIR, 'app.json'), 'utf8'))
  const slug = appConfig.expo.slug
  const activeChildren = new Set()
  const childOutcomes = new Map()
  let interruptedSignal

  const startChild = (command, args, childOptions = {}) => {
    assertNotInterrupted(interruptedSignal, `start ${command}`)
    const child = spawn(command, args, {
      cwd: childOptions.cwd ?? REPO_ROOT,
      detached: true,
      env: childOptions.env ?? process.env,
      stdio: childOptions.pipeOutput ? ['inherit', 'pipe', 'pipe'] : 'inherit',
    })
    child.stdout?.pipe(process.stdout)
    child.stderr?.pipe(process.stderr)
    activeChildren.add(child)
    const outcome = observeChild(child).then((result) => {
      activeChildren.delete(child)
      return result
    })
    childOutcomes.set(child, outcome)
    return { child, outcome }
  }

  const runChild = async (command, args, childOptions) => {
    const { outcome } = startChild(command, args, childOptions)
    const result = await outcome
    assertChildSucceeded(result, childOptions?.label ?? command)
  }

  const interrupt = (signal) => {
    interruptedSignal ??= signal
    stopChildren(activeChildren)
  }
  const handleSigint = () => interrupt('SIGINT')
  const handleSigterm = () => interrupt('SIGTERM')
  process.once('SIGINT', handleSigint)
  process.once('SIGTERM', handleSigterm)

  console.log(`Repository: ${REPO_ROOT}`)
  console.log(`Commit: ${capture('git', ['rev-parse', '--short', 'HEAD'])}`)
  console.log(`Simulator: ${simulator.name} (${simulator.udid})`)

  try {
    run('open', ['-a', 'Simulator'])
    await runChild('xcrun', ['simctl', 'bootstatus', simulator.udid, '-b'], {
      label: 'Simulator boot',
    })

    if (options.clean) {
      console.log('Regenerating the native iOS project...')
      await runChild('pnpm', ['exec', 'expo', 'prebuild', '--clean', '--platform', 'ios'], {
        cwd: EXAMPLE_DIR,
        label: 'Expo prebuild',
      })
    }

    let port = options.port ?? DEFAULT_PORT
    let metro
    while (!metro) {
      if (!(await isPortAvailable(port))) {
        assertNotInterrupted(interruptedSignal, 'continue Metro startup')
        const owner = portOwner(port)
        if (options.port !== undefined) {
          throw new Error(
            `Metro port ${port} is occupied by ${describePortOwner(owner)}. Choose another port instead of reusing a server from another checkout.`,
          )
        }
        const nextPort = await findAvailablePort(port + 1)
        console.log(
          `Metro port ${port} is occupied by ${describePortOwner(owner)}; using ${nextPort}.`,
        )
        port = nextPort
      }

      console.log(`Metro: http://127.0.0.1:${port}`)
      const metroArguments = [
        'exec',
        'expo',
        'start',
        '--dev-client',
        '--lan',
        '--port',
        String(port),
      ]
      if (options.clean) metroArguments.push('--clear')

      mkdirSync(METRO_TMP_DIR, { recursive: true })
      const attempt = startChild('pnpm', metroArguments, {
        cwd: EXAMPLE_DIR,
        env: { ...buildExpoEnvironment(port), TMPDIR: METRO_TMP_DIR },
        pipeOutput: true,
      })

      try {
        await waitForMetro(port, attempt.outcome)
        assertNotInterrupted(interruptedSignal, 'continue Metro startup')
        metro = attempt
      } catch (error) {
        stopChildren([attempt.child])
        await attempt.outcome
        if (
          options.port === undefined &&
          !interruptedSignal &&
          (error.code === 'METRO_PORT_CONFLICT' || !(await isPortAvailable(port)))
        ) {
          const nextPort = await findAvailablePort(port + 1)
          console.log(`Metro port ${port} was claimed during startup; retrying on ${nextPort}.`)
          port = nextPort
          continue
        }
        throw error
      }
    }

    const build = startChild(
      'pnpm',
      ['exec', 'expo', 'run:ios', '--no-bundler', '--device', simulator.udid],
      {
        cwd: EXAMPLE_DIR,
        env: buildExpoEnvironment(port),
      },
    )
    const firstExit = await Promise.race([
      build.outcome.then((outcome) => ({ source: 'build', outcome })),
      metro.outcome.then((outcome) => ({ source: 'metro', outcome })),
    ])
    if (firstExit.source === 'metro') {
      stopChildren([build.child])
      await build.outcome
      assertChildSucceeded(firstExit.outcome, 'Metro')
      throw new Error('Metro exited before the iOS build completed.')
    }
    assertChildSucceeded(firstExit.outcome, 'Expo iOS build')

    assertNotInterrupted(interruptedSignal, 'open the app')
    run('xcrun', ['simctl', 'openurl', simulator.udid, buildDevClientUrl(slug, port)])
    console.log(
      `\nRunning ${slug} on ${simulator.name} from ${REPO_ROOT}. Press Ctrl-C to stop Metro.`,
    )
    assertChildSucceeded(await metro.outcome, 'Metro')
  } catch (error) {
    if (interruptedSignal) {
      process.exitCode = interruptedSignal === 'SIGINT' ? 130 : 143
      return
    }
    throw error
  } finally {
    stopChildren(activeChildren)
    await Promise.allSettled(childOutcomes.values())
    process.removeListener('SIGINT', handleSigint)
    process.removeListener('SIGTERM', handleSigterm)
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }
  if (options.doctor) {
    await doctor()
    return
  }
  await dev(options)
}

const isDirectRun =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]

if (isDirectRun) {
  main().catch((error) => {
    console.error(`\n${error.message}`)
    process.exit(1)
  })
}
