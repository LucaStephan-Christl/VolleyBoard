import { useActivePlan, useApp } from '../lib/store'

/** Choose / create / duplicate / rename / delete a lineup plan (e.g. "5-1 · Maciek"). */
export function PlanBar() {
  const plans = useApp((s) => s.plans)
  const plan = useActivePlan()
  const { setActivePlan, addPlan, renamePlan, deletePlan } = useApp.getState()

  return (
    <div className="planbar">
      <label className="planbar-select">
        <span className="muted">Lineup plan</span>
        <select value={plan.id} onChange={(e) => setActivePlan(e.target.value)}>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <button
        className="btn small"
        onClick={() => {
          const name = prompt('Name for the new plan (starts as a copy of this lineup, with default positions):', `${plan.name} (new)`)
          if (name) addPlan(name)
        }}
      >
        ＋ New
      </button>
      <button
        className="btn small"
        title="Copy including all hand-placed positions and notes"
        onClick={() => {
          const name = prompt('Name for the duplicate:', `${plan.name} copy`)
          if (name) addPlan(name, plan.id)
        }}
      >
        ⧉ Duplicate
      </button>
      <button
        className="btn small"
        onClick={() => {
          const name = prompt('Rename plan:', plan.name)
          if (name) renamePlan(plan.id, name)
        }}
      >
        ✎ Rename
      </button>
      <button
        className="btn small danger"
        disabled={plans.length <= 1}
        onClick={() => {
          if (confirm(`Delete plan "${plan.name}"?`)) deletePlan(plan.id)
        }}
      >
        🗑
      </button>
    </div>
  )
}
