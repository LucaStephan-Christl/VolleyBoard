import type { PersistedData, Plan, Player } from './types'

export interface SharedStrategy {
  v: 1
  players: Player[]
  plans: Plan[]
  activePlanId: string
}

const toB64Url = (bytes: Uint8Array) => {
  let s = ''
  bytes.forEach((b) => (s += String.fromCharCode(b)))
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const fromB64Url = (str: string) => {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4)
  const bin = atob(b64)
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

async function streamToBytes(stream: ReadableStream<Uint8Array>) {
  const buf = await new Response(stream).arrayBuffer()
  return new Uint8Array(buf)
}

/** Encode strategy (roster + plans, not stats) to a compact url-safe string. */
export async function encodeStrategy(data: PersistedData): Promise<string> {
  const payload: SharedStrategy = { v: 1, players: data.players, plans: data.plans, activePlanId: data.activePlanId }
  const raw = new TextEncoder().encode(JSON.stringify(payload))
  if (typeof CompressionStream !== 'undefined') {
    const cs = new CompressionStream('gzip')
    const w = cs.writable.getWriter()
    void w.write(raw)
    void w.close()
    return 'g' + toB64Url(await streamToBytes(cs.readable))
  }
  return 'j' + toB64Url(raw)
}

export async function decodeStrategy(code: string): Promise<SharedStrategy> {
  const kind = code[0]
  const bytes = fromB64Url(code.slice(1))
  let raw = bytes
  if (kind === 'g') {
    const ds = new DecompressionStream('gzip')
    const w = ds.writable.getWriter()
    void w.write(bytes)
    void w.close()
    raw = await streamToBytes(ds.readable)
  }
  const parsed = JSON.parse(new TextDecoder().decode(raw)) as SharedStrategy
  if (parsed.v !== 1 || !Array.isArray(parsed.players) || !Array.isArray(parsed.plans)) throw new Error('Not a valid share link')
  return parsed
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
