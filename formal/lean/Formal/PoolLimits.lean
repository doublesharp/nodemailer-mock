import Std

namespace Formal.PoolLimits

-- The finite positive input has already been floored. JavaScript's nonfinite
-- and missing values share the fallback branch.
def positiveInteger (input : Option Int) (fallback : Nat) : Nat :=
  match input with
  | some value => if value ≥ 1 then value.toNat else fallback
  | none => fallback

def maxConnections (input : Option Int) : Nat := positiveInteger input 5

def maxMessages (input : Option Int) : Nat := positiveInteger input 100

private theorem positiveInteger_pos (input : Option Int) (fallback : Nat)
    (positive : 0 < fallback) : 0 < positiveInteger input fallback := by
  cases input with
  | none => exact positive
  | some value =>
    by_cases valid : value ≥ 1
    · simp only [positiveInteger, ite_eq_left valid]
      omega
    · simpa [positiveInteger, valid] using positive

theorem maxConnections_pos (input : Option Int) : 0 < maxConnections input :=
  positiveInteger_pos input 5 (by decide)

theorem maxMessages_pos (input : Option Int) : 0 < maxMessages input :=
  positiveInteger_pos input 100 (by decide)

-- The sentinel -1 enables unlimited retry. The finite model uses a bounded cap.
def normalizeMaxRequeues (input : Option Int) : Int :=
  match input with
  | some value => if value ≥ -1 then value else 5
  | none => 5

def maxTimerDelay : Int := 2147483647

def clampTimerDelay (rateDelta now rateStarted : Int) : Int :=
  min rateDelta (max 1 (rateDelta - max 0 (now - rateStarted)))

theorem clampTimerDelay_bounds (rateDelta now rateStarted : Int)
    (range : 1 ≤ rateDelta ∧ rateDelta ≤ maxTimerDelay) :
    1 ≤ clampTimerDelay rateDelta now rateStarted ∧
      clampTimerDelay rateDelta now rateStarted ≤ maxTimerDelay := by
  unfold clampTimerDelay
  omega

structure PoolState where
  generation : Nat
  active : Nat
  queued : Nat
  maxConnections : Nat
  closed : Bool
  rateBlocked : Bool
  retryPending : Bool
  deriving DecidableEq

def isIdle (state : PoolState) : Bool :=
  !state.closed && decide (state.active < state.maxConnections) &&
    decide (state.queued = 0) && !state.rateBlocked

theorem closed_never_idle (state : PoolState) (closed : state.closed = true) :
    isIdle state = false := by
  simp [isIdle, closed]

def drainStep (state : PoolState) : PoolState :=
  if !state.closed && decide (0 < state.queued) &&
      decide (state.active < state.maxConnections) && !state.rateBlocked && !state.retryPending then
    { state with active := state.active + 1, queued := state.queued - 1 }
  else state

def completeStep (state : PoolState) (generation : Nat) (requeue : Bool) : PoolState :=
  if generation = state.generation ∧ state.active > 0 then
    if requeue && !state.closed then
      { state with active := state.active - 1, queued := state.queued + 1, retryPending := true }
    else { state with active := state.active - 1 }
  else state

theorem stale_completion_preserves_state (state : PoolState) (generation : Nat)
    (requeue : Bool) (stale : generation ≠ state.generation) :
    completeStep state generation requeue = state := by
  simp [completeStep, stale]

inductive Step : PoolState → PoolState → Prop where
  | drain (state : PoolState) : Step state (drainStep state)
  | complete (state : PoolState) (generation : Nat) (requeue : Bool) :
    Step state (completeStep state generation requeue)

inductive Steps : PoolState → PoolState → Prop where
  | refl (state : PoolState) : Steps state state
  | next {initial current final : PoolState} :
    Steps initial current → Step current final → Steps initial final

private theorem step_preserves_capacity {initial final : PoolState}
    (bounded : initial.active ≤ initial.maxConnections) (step : Step initial final) :
    final.active ≤ final.maxConnections := by
  cases step with
  | drain =>
    unfold drainStep
    split
    · rename_i dispatch
      simp only [Bool.and_eq_true, decide_eq_true_eq] at dispatch
      change initial.active + 1 ≤ initial.maxConnections
      omega
    · exact bounded
  | complete generation requeue =>
    unfold completeStep
    split
    · split <;> change initial.active - 1 ≤ initial.maxConnections <;> omega
    · exact bounded

theorem drain_and_complete_preserve_capacity {initial final : PoolState}
    (_positive : 1 ≤ initial.maxConnections) (bounded : initial.active ≤ initial.maxConnections)
    (steps : Steps initial final) : final.active ≤ final.maxConnections := by
  induction steps with
  | refl => exact bounded
  | next _ step ih => exact step_preserves_capacity ih step

end Formal.PoolLimits
