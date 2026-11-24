------------------------------ MODULE MockPool ------------------------------
EXTENDS Naturals, Sequences, FiniteSets

CONSTANTS Jobs, MaxConnections, MaxMessages, RateLimit, MaxRequeues, LastGeneration
ASSUME /\ Jobs \subseteq Nat \ {0}
       /\ MaxConnections > 0 /\ MaxMessages > 0 /\ RateLimit > 0

VARIABLES pool, jobs, submitted, staleTimers, audit
vars == <<pool, jobs, submitted, staleTimers, audit>>

Slots == 1..MaxConnections
Generations == 0..LastGeneration
Statuses == {"new", "queued", "running", "resolved", "rejected"}
Results == {"success", "disconnect", "failure"}
TimerKinds == {"rate", "idle", "retry", "clear"}
EmptySlot == [job |-> 0, messages |-> MaxMessages]

Fresh(g) ==
  [generation |-> g, queue |-> <<>>, active |-> 0,
   slots |-> [slot \in Slots |-> EmptySlot],
   closed |-> FALSE, cleared |-> FALSE, clearCount |-> 0,
   clearPending |-> FALSE, idleState |-> TRUE, rateCount |-> 0,
   rateTimer |-> FALSE, idleTimer |-> FALSE, retryImmediate |-> FALSE]

Init ==
  /\ pool = Fresh(0)
  /\ jobs = [j \in Jobs |-> [status |-> "new", generation |-> 0, requeues |-> 0]]
  /\ submitted = {}
  /\ staleTimers = {}
  /\ audit = [closedStart |-> FALSE, staleMutation |-> FALSE]

IsIdle(p) ==
  ~p.closed /\ p.active < MaxConnections /\ Len(p.queue) = 0 /\ p.rateCount < RateLimit

\* Recompute idle and arm the timers that drain would schedule.
Housekeep(p) ==
  [p EXCEPT
     !.idleState = IsIdle(p),
     !.rateTimer = ~p.closed /\ (p.rateTimer \/ p.rateCount = RateLimit),
     !.idleTimer = ~p.closed /\ (p.idleTimer \/
       (p.active = 0 /\ Len(p.queue) = 0 /\ \E slot \in Slots : p.slots[slot] # EmptySlot))]

Submit(j) ==
  /\ jobs[j].status = "new"
  /\ submitted' = submitted \cup {j}
  /\ IF pool.closed
     THEN /\ jobs' = [jobs EXCEPT ![j].status = "rejected"]
          /\ UNCHANGED pool
     ELSE /\ jobs' = [jobs EXCEPT ![j] = [@ EXCEPT !.status = "queued",
                                                              !.generation = pool.generation]]
          /\ pool' = Housekeep([pool EXCEPT !.queue = Append(@, j), !.idleTimer = FALSE])
  /\ UNCHANGED staleTimers

Dispatch ==
  /\ ~pool.closed /\ ~pool.retryImmediate /\ Len(pool.queue) > 0
  /\ pool.active < MaxConnections /\ pool.rateCount < RateLimit
  /\ LET free == {s \in Slots : pool.slots[s].job = 0}
         existing == {s \in free : pool.slots[s] # EmptySlot}
         candidates == IF existing = {} THEN free ELSE existing
         slot == CHOOSE s \in candidates : \A other \in candidates : s <= other
         j == Head(pool.queue)
         messages == IF existing = {} THEN 0 ELSE pool.slots[slot].messages
     IN /\ pool' = Housekeep([pool EXCEPT
              !.slots[slot] = [job |-> j, messages |-> messages],
              !.queue = Tail(@), !.active = @ + 1, !.rateCount = @ + 1])
        /\ jobs' = [jobs EXCEPT ![j].status = "running"]
  /\ UNCHANGED <<submitted, staleTimers>>

Settled(result) == IF result = "success" THEN "resolved" ELSE "rejected"

CompleteCurrent(j, result) ==
  /\ jobs[j].status = "running" /\ jobs[j].generation = pool.generation
  /\ LET slot == CHOOSE s \in Slots : pool.slots[s].job = j
         messages == pool.slots[slot].messages + (IF result = "success" THEN 1 ELSE 0)
         requeue == result = "disconnect" /\ ~pool.closed /\ jobs[j].requeues < MaxRequeues
     IN /\ pool' = Housekeep([pool EXCEPT
              !.active = @ - 1,
              !.slots[slot] = IF messages = MaxMessages THEN EmptySlot
                              ELSE [job |-> 0, messages |-> messages],
              !.queue = IF requeue THEN Append(@, j) ELSE @,
              !.retryImmediate = @ \/ requeue])
        /\ jobs' = [jobs EXCEPT ![j].status = IF requeue THEN "queued" ELSE Settled(result),
                               ![j].requeues = IF requeue THEN @ + 1 ELSE @]
  /\ UNCHANGED <<submitted, staleTimers>>

CompleteStale(j, result) ==
  /\ jobs[j].status = "running" /\ jobs[j].generation < pool.generation
  /\ jobs' = [jobs EXCEPT ![j].status = Settled(result)]
  /\ UNCHANGED <<pool, submitted, staleTimers>>

RejectQueued ==
  [j \in Jobs |-> IF jobs[j].status = "queued"
                  THEN [jobs[j] EXCEPT !.status = "rejected"] ELSE jobs[j]]

Close ==
  /\ ~pool.closed
  /\ pool' = Housekeep([pool EXCEPT !.closed = TRUE, !.queue = <<>>, !.retryImmediate = FALSE])
  /\ jobs' = RejectQueued
  /\ UNCHANGED <<submitted, staleTimers>>

ClearClosed ==
  /\ pool.closed /\ pool.active = 0 /\ ~pool.cleared
  /\ pool' = [pool EXCEPT !.cleared = TRUE, !.clearPending = TRUE,
                          !.slots = [slot \in Slots |-> EmptySlot]]
  /\ UNCHANGED <<jobs, submitted, staleTimers>>

Fire(kind) ==
  /\ CASE kind = "rate" ->
            /\ pool.rateTimer
            /\ pool' = Housekeep([pool EXCEPT !.rateTimer = FALSE, !.rateCount = 0])
       [] kind = "idle" ->
            /\ pool.idleTimer
            /\ pool' = [pool EXCEPT !.idleTimer = FALSE, !.slots = [s \in Slots |-> EmptySlot]]
       [] kind = "retry" ->
            /\ pool.retryImmediate
            /\ pool' = [pool EXCEPT !.retryImmediate = FALSE]
       [] kind = "clear" ->
            /\ pool.clearPending
            /\ pool' = [pool EXCEPT !.clearPending = FALSE, !.clearCount = @ + 1]
  /\ UNCHANGED <<jobs, submitted, staleTimers>>

\* A rate window can also expire between drain calls before the timer was armed.
ExpireWindow ==
  /\ ~pool.closed /\ pool.rateCount > 0 /\ ~pool.rateTimer
  /\ pool' = Housekeep([pool EXCEPT !.rateCount = 0])
  /\ UNCHANGED <<jobs, submitted, staleTimers>>

Armed(kind) ==
  CASE kind = "rate" -> pool.rateTimer
    [] kind = "idle" -> pool.idleTimer
    [] kind = "retry" -> pool.retryImmediate
    [] kind = "clear" -> pool.clearPending

ResetPool ==
  /\ pool.generation < LastGeneration
  /\ pool' = Fresh(pool.generation + 1)
  \* Keep callbacks that were already scheduled and may still reach the fence.
  /\ staleTimers' = staleTimers \cup {<<kind, pool.generation>> : kind \in
                       {timer \in TimerKinds : Armed(timer)}}
  /\ UNCHANGED submitted

Reset == ResetPool /\ jobs' = RejectQueued

\* A completion may trigger reset while inspecting the error. The old job still
\* settles, and the rest of the completion must leave the new generation alone.
ReentrantReset(j) ==
  /\ jobs[j].status = "running" /\ jobs[j].generation = pool.generation
  /\ ResetPool
  /\ jobs' = [RejectQueued EXCEPT ![j].status = "rejected"]

FireStale(timer) ==
  /\ timer \in staleTimers /\ timer[2] < pool.generation
  /\ staleTimers' = staleTimers \ {timer}
  /\ UNCHANGED <<pool, jobs, submitted>>

\* These monitors compare the histories of actions with actual pre/post state.
\* Keeping them sticky makes violations visible to TLC as state invariants.
Observe(action, starts, stale) ==
  /\ action
  /\ audit' = [closedStart |-> audit.closedStart \/ (starts /\ pool.closed),
                staleMutation |-> audit.staleMutation \/ (stale /\ pool' # pool)]

ObserveReentrant(j) ==
  /\ ReentrantReset(j)
  /\ audit' = [audit EXCEPT !.staleMutation = @ \/ pool' # Fresh(pool.generation + 1)]

StartJob == Observe(Dispatch, TRUE, FALSE)

FinishJob(j) ==
  \E result \in Results :
    Observe(CompleteCurrent(j, result), FALSE, FALSE) \/
    Observe(CompleteStale(j, result), FALSE, TRUE)

FireTimer(kind) == Observe(Fire(kind), FALSE, FALSE)
Clear == Observe(ClearClosed, FALSE, FALSE)

Quiescent ==
  /\ pool.closed /\ pool.cleared /\ ~pool.clearPending /\ submitted = Jobs
  /\ \A j \in Jobs : jobs[j].status \in {"resolved", "rejected"}
  /\ UNCHANGED vars

Next ==
  \/ \E j \in Jobs : Observe(Submit(j), FALSE, FALSE) \/ FinishJob(j) \/
                      ObserveReentrant(j)
  \/ StartJob
  \/ Clear
  \/ Observe(Close \/ Reset \/ ExpireWindow, FALSE, FALSE)
  \/ \E kind \in TimerKinds : FireTimer(kind)
  \/ \E timer \in staleTimers : Observe(FireStale(timer), FALSE, TRUE)
  \/ Quiescent

Spec == Init /\ [][Next]_vars
  /\ WF_vars(StartJob) /\ WF_vars(Clear)
  /\ (\A j \in Jobs : WF_vars(FinishJob(j)))
  /\ (\A kind \in TimerKinds : WF_vars(FireTimer(kind)))

QueueJobs == {pool.queue[i] : i \in 1..Len(pool.queue)}
BusySlots == {s \in Slots : pool.slots[s].job # 0}
BusyJobs == {pool.slots[s].job : s \in BusySlots}
AllocatedSlots == {s \in Slots : pool.slots[s] # EmptySlot}

TypeOK ==
  /\ pool \in [generation : Generations, queue : UNION {[1..n -> Jobs] : n \in 0..Cardinality(Jobs)},
              active : 0..Cardinality(Jobs), slots : [Slots -> [job : Jobs \cup {0},
              messages : 0..MaxMessages]], closed : BOOLEAN, cleared : BOOLEAN, clearCount : Nat,
              clearPending : BOOLEAN, idleState : BOOLEAN, rateCount : Nat,
              rateTimer : BOOLEAN, idleTimer : BOOLEAN, retryImmediate : BOOLEAN]
  /\ jobs \in [Jobs -> [status : Statuses, generation : Generations, requeues : Nat]]
  /\ submitted \subseteq Jobs
  /\ staleTimers \subseteq TimerKinds \X Generations
  /\ audit \in [closedStart : BOOLEAN, staleMutation : BOOLEAN]
  /\ pool.idleState = IsIdle(pool)

CapacityBounded ==
  /\ pool.active <= MaxConnections
  /\ pool.active = Cardinality(BusySlots)
  /\ Cardinality(BusyJobs) = pool.active
  /\ Cardinality(AllocatedSlots) <= MaxConnections
  /\ \A s \in AllocatedSlots : pool.slots[s].messages < MaxMessages

RateBounded == pool.rateCount <= RateLimit
NoDispatchWhenClosed == ~audit.closedStart
ClearValid ==
  /\ pool.cleared => pool.closed /\ pool.active = 0
  /\ pool.clearCount <= 1
  /\ (pool.clearPending \/ pool.clearCount = 1) => pool.cleared
GenerationFencing == ~audit.staleMutation
RequeueBounded == \A j \in Jobs : jobs[j].requeues <= MaxRequeues

NoLostJobs ==
  /\ submitted = {j \in Jobs : jobs[j].status # "new"}
  /\ QueueJobs = {j \in Jobs : jobs[j].status = "queued"}
  /\ Cardinality(QueueJobs) = Len(pool.queue)
  /\ BusyJobs = {j \in Jobs : jobs[j].status = "running" /\ jobs[j].generation = pool.generation}
  /\ \A j \in Jobs :
       /\ jobs[j].generation <= pool.generation
       /\ (j \in QueueJobs => jobs[j].generation = pool.generation)

JobsSettle ==
  \A j \in Jobs : (j \in submitted) ~> (jobs[j].status \in {"resolved", "rejected"})

ClosedPoolClears ==
  \A g \in Generations :
    (pool.generation = g /\ pool.closed) ~> (pool.generation # g \/ pool.cleared)

=============================================================================
