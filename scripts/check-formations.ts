/**
 * Sanity check: every default serve-receive formation must be legal under the overlap rules
 * (the serving team may position freely, so other phases are not checked),
 * and rotating six times must bring the lineup back to the start.
 * Run with `npm test`.
 */
import { DEFAULT_PLAYERS, makeDefaultPlans } from '../src/lib/defaults'
import { PHASES, ROTATIONS, SLOT_NAMES, checkOverlap, courtAt, lineupAt, overlapApplies, positionsFor } from '../src/lib/formation'

let failures = 0
const fail = (msg: string) => {
  failures++
  console.error('✗', msg)
}

for (const plan of makeDefaultPlans()) {
  // rotation cycle
  const back = lineupAt(plan.base, 7)
  if (back.join() !== plan.base.join()) fail(`${plan.name}: rotation 7 should equal rotation 1`)

  // rotation 2: P2 player moves to P1, P1 player moves to P6
  const r2 = lineupAt(plan.base, 2)
  if (r2[0] !== plan.base[1] || r2[5] !== plan.base[0] || r2[1] !== plan.base[2]) fail(`${plan.name}: wrong rotation order`)

  for (const rot of ROTATIONS) {
    for (const phase of PHASES) {
      const pts = positionsFor(plan, DEFAULT_PLAYERS, rot, phase.id)
      const court = courtAt(plan, DEFAULT_PLAYERS, rot, phase.id)
      const line = court.map((c, i) => `${SLOT_NAMES[i]}=${c.player.name}`).join(' ')
      if (!overlapApplies(phase.id)) {
        console.log(`${plan.name} R${rot} ${phase.short.padEnd(7)} ${line}`)
        continue
      }
      const v = checkOverlap(pts)
      console.log(`${plan.name} R${rot} ${phase.short.padEnd(7)} ${line} ${v.length ? '← ILLEGAL' : ''}`)
      for (const x of v) fail(`${plan.name} R${rot} ${phase.id}: ${x.message}`)
    }
  }
}

if (failures) throw new Error(`${failures} formation problem(s)`)
console.log('\nAll default formations are legal ✓')
