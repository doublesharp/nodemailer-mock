import Std

namespace Formal.OAuthCache

-- An omitted expiry permits use of a configured token. Only a stated future
-- expiry permits reuse of a provisioned token from the cache.
def isExpiryValid (expiry : Option Int) (now : Int) : Bool :=
  match expiry with
  | none => true
  | some expires => decide (expires > now)

def isCacheable (expiry : Option Int) (now : Int) : Bool :=
  match expiry with
  | none => false
  | some expires => decide (expires > now)

theorem zero_expiry_never_valid (now : Int) (nonnegative : 0 ≤ now) :
    isExpiryValid (some 0) now = false ∧ isCacheable (some 0) now = false := by
  simp [isExpiryValid, isCacheable, Int.not_lt.mpr nonnegative]

structure Token where
  value : String
  identity : Nat
  expires : Option Int
  deriving DecidableEq

structure State where
  generation : Nat
  writeEpoch : Nat
  version : String → Nat
  cache : String → Option Token

def lookup (state : State) (user : String) (identity : Nat) (now : Int) : Option Token :=
  match state.cache user with
  | none => none
  | some token =>
    if decide (token.identity = identity) && isCacheable token.expires now then some token else none

theorem cached_token_always_unexpired (state : State) (user : String) (identity : Nat)
    (now : Int) (token : Token) (found : lookup state user identity now = some token) :
    ∃ expires, token.expires = some expires ∧ expires > now := by
  unfold lookup at found
  split at found
  · contradiction
  · rename_i cached _
    split at found
    · rename_i valid
      have same : cached = token := Option.some.inj found
      subst cached
      simp only [Bool.and_eq_true] at valid
      cases h : token.expires with
      | none => simp [isCacheable, h] at valid
      | some expires =>
        exact ⟨expires, rfl, by simpa [isCacheable, h] using valid.2⟩
    · contradiction

def setCache (state : State) (user : String) (value : Option Token) : State :=
  { state with cache := fun candidate => if candidate = user then value else state.cache candidate }

def advanceVersion (state : State) (user : String) : State :=
  let nextEpoch := state.writeEpoch + 1
  { state with
    writeEpoch := nextEpoch
    version := fun candidate => if candidate = user then nextEpoch else state.version candidate }

def startRenew (state : State) (user : String) : State :=
  setCache (advanceVersion state user) user none

-- Provider failure returns the state as it was at completion, with no event.
def completeWrite (state : State) (user : String) (generation epoch : Nat)
    (result : Option Token) (now : Int) : State × Option Token :=
  if generation = state.generation ∧ epoch = state.version user then
    match result with
    | none => (state, none)
    | some token =>
      let committed := advanceVersion state user
      (setCache committed user (if isCacheable token.expires now then some token else none), some token)
  else (state, none)

theorem failed_renewal_evicts_stale_token (state : State) (user : String) (now : Int) :
    let started := startRenew state user
    ((completeWrite started user started.generation (started.version user) none now).1.cache user) =
      none := by
  simp [completeWrite, startRenew, setCache]

theorem stale_write_rejected (state : State) (user : String) (generation epoch : Nat)
    (result : Option Token) (now : Int)
    (stale : generation ≠ state.generation ∨ epoch ≠ state.version user) :
    completeWrite state user generation epoch result now = (state, none) := by
  rcases stale with stale | stale <;> simp [completeWrite, stale]

end Formal.OAuthCache
