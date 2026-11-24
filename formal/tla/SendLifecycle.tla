--------------------------- MODULE SendLifecycle ----------------------------
EXTENDS Naturals, Sequences, FiniteSets

CONSTANTS Sends, LastGeneration, MaxOutcomes
ASSUME Sends \subseteq Nat \ {0}

VARIABLES state, sends, invalidated, audit
vars == <<state, sends, invalidated, audit>>

Generations == 0..LastGeneration
Outcomes == {"ok", "authError", "error"}
ProviderResults == {"cacheable", "uncacheable", "failure"}
Phases == {"new", "compile", "stream", "authStart", "authPending", "check",
           "renewStart", "renewPending", "retryReserve", "retryCheck",
           "render", "succeeded", "failed"}
Settled == {"succeeded", "failed"}
NoOutcome == [generation |-> 0, kind |-> "none"]
NoToken == [generation |-> 0, epoch |-> 0, id |-> <<0, FALSE>>]

Fresh(g, epoch) ==
  [generation |-> g, writeEpoch |-> epoch, queue |-> <<>>, outcomesAdded |-> 0,
   failOnce |-> FALSE, armedOnce |-> FALSE, sentMail |-> <<>>, cache |-> NoToken, tokenEvent |-> NoToken]

Init ==
  /\ state = Fresh(0, 0)
  /\ sends = [s \in Sends |-> [generation |-> 0, phase |-> "new",
                              outcome |-> NoOutcome, epoch |-> 0, renewals |-> 0]]
  /\ invalidated = {}
  /\ audit = [staleMail |-> FALSE, staleQueue |-> FALSE,
                staleWrite |-> FALSE, lostFailOnce |-> FALSE]

IsCurrent(s) == sends[s].generation = state.generation
Selected == IF Len(state.queue) = 0 THEN NoOutcome
            ELSE [generation |-> Head(state.queue).generation, kind |-> Head(state.queue).kind]
Remaining == IF Len(state.queue) = 0 THEN <<>> ELSE Tail(state.queue)

Enqueue(kind) ==
  /\ state.outcomesAdded < MaxOutcomes
  /\ state' = [state EXCEPT !.outcomesAdded = @ + 1,
       !.queue = Append(@, [generation |-> state.generation, serial |-> state.outcomesAdded + 1, kind |-> kind])]
  /\ UNCHANGED <<sends, invalidated, audit>>

ArmFailOnce ==
  /\ ~state.armedOnce
  /\ state' = [state EXCEPT !.failOnce = TRUE, !.armedOnce = TRUE]
  /\ UNCHANGED <<sends, invalidated, audit>>

Reset ==
  /\ state.generation < LastGeneration
  /\ state' = Fresh(state.generation + 1, state.writeEpoch)
  /\ invalidated' = {}
  /\ UNCHANGED <<sends, audit>>

\* beginSend captures the context synchronously before either plugin runs.
BeginSend(s) ==
  /\ sends[s].phase = "new"
  /\ sends' = [sends EXCEPT ![s] = [@ EXCEPT !.generation = state.generation,
                          !.outcome = Selected, !.phase = "compile"]]
  /\ state' = [state EXCEPT !.queue = Remaining]
  /\ UNCHANGED <<invalidated, audit>>

Move(s, phase) == sends' = [sends EXCEPT ![s].phase = phase]

Settle(s, phase) ==
  sends' = [sends EXCEPT ![s].phase = phase, ![s].outcome = NoOutcome, ![s].epoch = 0]

Plugin(s, from, to) ==
  /\ sends[s].phase = from
  /\ Move(s, to) \/ Settle(s, "failed")
  /\ UNCHANGED <<state, invalidated>>

\* One user and credential identity are shared by all sends, so a committed
\* cache entry can serve any current send's initial authorization. Initial
\* provisions read the current version. A commit or renewal advances it.
BeginAuth(s) ==
  /\ sends[s].phase = "authStart"
  /\ IF ~IsCurrent(s) \/ state.cache # NoToken
     THEN /\ Move(s, "check")
          /\ UNCHANGED state
     ELSE /\ sends' = [sends EXCEPT ![s].phase = "authPending",
                                   ![s].epoch = state.writeEpoch]
          /\ UNCHANGED state
  /\ UNCHANGED invalidated

FinishProvision(s, result, renew) ==
  /\ sends[s].phase = IF renew THEN "renewPending" ELSE "authPending"
  /\ LET token == [generation |-> sends[s].generation, epoch |-> state.writeEpoch + 1,
                   id |-> <<s, renew>>]
     IN IF result = "failure"
        THEN /\ Settle(s, "failed")
             /\ UNCHANGED state
        ELSE /\ sends' = [sends EXCEPT ![s].phase = IF renew THEN "retryReserve" ELSE "check",
                                      ![s].epoch = 0]
             /\ state' = IF IsCurrent(s) /\ sends[s].epoch = state.writeEpoch
                         THEN [state EXCEPT !.writeEpoch = token.epoch, !.tokenEvent = token,
                                    !.cache = IF result = "cacheable" THEN token ELSE NoToken]
                         ELSE state
  /\ UNCHANGED invalidated

CheckOutcome(s, retry) ==
  /\ sends[s].phase = IF retry THEN "retryCheck" ELSE "check"
  /\ LET selected == sends[s].outcome
         useFailOnce == selected = NoOutcome /\ IsCurrent(s) /\ state.failOnce
         kind == IF selected # NoOutcome THEN selected.kind ELSE IF useFailOnce THEN "authError" ELSE "ok"
     IN /\ state' = IF useFailOnce THEN [state EXCEPT !.failOnce = FALSE] ELSE state
        /\ sends' = [sends EXCEPT ![s].outcome = NoOutcome,
             ![s].phase = CASE kind = "ok" -> "render"
                            [] kind = "authError" /\ ~retry /\ IsCurrent(s) -> "renewStart"
                            [] OTHER -> "failed"]
  /\ UNCHANGED invalidated

BeginRenew(s) ==
  /\ sends[s].phase = "renewStart"
  /\ IF IsCurrent(s)
     THEN /\ sends' = [sends EXCEPT ![s].phase = "renewPending",
                  ![s].epoch = state.writeEpoch + 1, ![s].renewals = @ + 1]
          /\ state' = [state EXCEPT !.writeEpoch = @ + 1, !.cache = NoToken]
          /\ invalidated' = IF state.cache = NoToken THEN invalidated
                            ELSE invalidated \cup {state.cache.id}
     ELSE /\ Settle(s, "failed")
          /\ UNCHANGED <<state, invalidated>>

ReserveRetry(s) ==
  /\ sends[s].phase = "retryReserve"
  /\ IF IsCurrent(s)
     THEN /\ sends' = [sends EXCEPT ![s].phase = "retryCheck", ![s].outcome = Selected]
          /\ state' = [state EXCEPT !.queue = Remaining]
     ELSE /\ Settle(s, "failed")
          /\ UNCHANGED state
  /\ UNCHANGED invalidated

Render(s) ==
  /\ sends[s].phase = "render"
  /\ \/ /\ Settle(s, "succeeded")
        /\ state' = IF IsCurrent(s) THEN [state EXCEPT !.sentMail = Append(@, s)] ELSE state
     \/ /\ Settle(s, "failed")
        /\ UNCHANGED state
  /\ UNCHANGED invalidated

\* Watch actual writes, consumption, and flag changes at each send action.
\* Reset and queue administration have their own actions.
Observe(action, s, completingProvision) ==
  /\ action
  /\ LET stale == ~IsCurrent(s)
         olderWrite == completingProvision /\ sends[s].epoch # state.writeEpoch
     IN audit' = [staleMail |-> audit.staleMail \/ (stale /\ state'.sentMail # state.sentMail),
         staleQueue |-> audit.staleQueue \/ (stale /\ state'.queue # state.queue),
         staleWrite |-> audit.staleWrite \/ ((stale \/ olderWrite) /\
              (state'.cache # state.cache \/ state'.tokenEvent # state.tokenEvent)),
         lostFailOnce |-> audit.lostFailOnce \/ (sends[s].outcome # NoOutcome /\ state.failOnce /\ ~state'.failOnce)]

Advance(s) ==
  \/ Observe(Plugin(s, "compile", "stream") \/ Plugin(s, "stream", "authStart") \/
       BeginAuth(s) \/ CheckOutcome(s, FALSE) \/ BeginRenew(s) \/ ReserveRetry(s) \/
       CheckOutcome(s, TRUE) \/ Render(s), s, FALSE)
  \/ \E result \in ProviderResults :
       Observe(FinishProvision(s, result, FALSE) \/ FinishProvision(s, result, TRUE), s, TRUE)

Quiescent ==
  /\ \A s \in Sends : sends[s].phase \in Settled
  /\ UNCHANGED vars

Next ==
  \/ \E s \in Sends : BeginSend(s) \/ Advance(s)
  \/ \E kind \in Outcomes : Enqueue(kind)
  \/ ArmFailOnce
  \/ Reset
  \/ Quiescent

Spec == Init /\ [][Next]_vars /\ (\A s \in Sends : WF_vars(Advance(s)))

Outcome == [generation : Generations, serial : 1..MaxOutcomes, kind : Outcomes]
TokenId == Sends \X BOOLEAN
Token == [generation : Generations, epoch : Nat, id : TokenId]

TypeOK ==
  /\ state \in [generation : Generations, writeEpoch : Nat,
       queue : UNION {[1..n -> Outcome] : n \in 0..MaxOutcomes}, outcomesAdded : 0..MaxOutcomes,
       failOnce : BOOLEAN, armedOnce : BOOLEAN, sentMail : UNION {[1..n -> Sends] : n \in 0..Cardinality(Sends)},
       cache : Token \cup {NoToken}, tokenEvent : Token \cup {NoToken}]
  /\ sends \in [Sends -> [generation : Generations, phase : Phases,
                   outcome : [generation : Generations, kind : Outcomes] \cup {NoOutcome}, epoch : Nat, renewals : Nat]]
  /\ invalidated \subseteq TokenId
  /\ audit \in [staleMail : BOOLEAN, staleQueue : BOOLEAN, staleWrite : BOOLEAN, lostFailOnce : BOOLEAN]
  /\ \A s \in Sends : sends[s].generation <= state.generation

NoStaleSentMail ==
  /\ ~audit.staleMail
  /\ \A i \in 1..Len(state.sentMail) :
       IsCurrent(state.sentMail[i]) /\ sends[state.sentMail[i]].phase = "succeeded"

NoStaleQueueSteal ==
  /\ ~audit.staleQueue
  /\ \A i \in 1..Len(state.queue) :
       /\ state.queue[i].generation = state.generation
       /\ i > 1 => state.queue[i - 1].serial < state.queue[i].serial
  /\ \A s \in Sends : sends[s].outcome # NoOutcome => sends[s].outcome.generation = sends[s].generation

NoStaleTokenCache ==
  /\ ~audit.staleWrite
  /\ \A token \in ({state.cache, state.tokenEvent} \ {NoToken}) :
       token.generation = state.generation /\ token.epoch <= state.writeEpoch

NoRejectedTokenCached == state.cache # NoToken => state.cache.id \notin invalidated
AtMostOneOAuthRenewal == \A s \in Sends : sends[s].renewals <= 1
QueuedOutcomePreservesFailOnce == ~audit.lostFailOnce

SendsSettle ==
  \A s \in Sends : (sends[s].phase # "new") ~> (sends[s].phase \in Settled)

=============================================================================
