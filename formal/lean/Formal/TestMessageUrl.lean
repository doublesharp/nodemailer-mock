import Std

namespace Formal.TestMessageUrl

-- Work in UTF-8 bytes. The unescaped ASCII set is encodeURIComponent's set.
def unescaped (byte : UInt8) : Bool :=
  let n := byte.toNat
  decide ((65 ≤ n ∧ n ≤ 90) ∨ (97 ≤ n ∧ n ≤ 122) ∨ (48 ≤ n ∧ n ≤ 57) ∨
    n ∈ ([33, 39, 40, 41, 42, 45, 46, 95, 126] : List Nat))

def hexDigit (n : Nat) : UInt8 :=
  UInt8.ofNat (if n < 10 then 48 + n else 55 + n)

def encodeByte (byte : UInt8) : List UInt8 :=
  if unescaped byte then [byte]
  else [37, hexDigit (byte.toNat / 16), hexDigit (byte.toNat % 16)]

def percentEncode (text : String) : List UInt8 :=
  text.toUTF8.data.toList.flatMap encodeByte

def delimiter (byte : UInt8) : Bool :=
  decide (byte.toNat = 47 ∨ byte.toNat = 63 ∨ byte.toNat = 35)

private theorem hexDigit_safe (n : Nat) (nibble : n < 16) : delimiter (hexDigit n) = false := by
  unfold hexDigit delimiter
  split <;> simp only [UInt8.toNat_ofNat', decide_eq_false_iff_not] <;> omega

private theorem encoded_byte_safe (source output : UInt8)
    (member : output ∈ encodeByte source) : delimiter output = false := by
  unfold encodeByte at member
  split at member
  · rename_i plain
    simp only [List.mem_singleton] at member
    subst output
    simp [unescaped] at plain
    simp only [delimiter, decide_eq_false_iff_not]
    omega
  · simp only [List.mem_cons, List.not_mem_nil, or_false] at member
    rcases member with equal | equal | equal <;> subst output
    · decide
    · have byteRange := source.toNat_lt_size
      change source.toNat < 256 at byteRange
      exact hexDigit_safe _ (by omega)
    · exact hexDigit_safe _ (by omega)

theorem percentEncode_no_path_or_query_delimiters (text : String) (byte : UInt8)
    (member : byte ∈ percentEncode text) : delimiter byte = false := by
  obtain ⟨source, _, encoded⟩ := List.mem_flatMap.mp member
  exact encoded_byte_safe source byte encoded

-- Percent occurs in every expanded byte, so a percent-free encoded output
-- came entirely from single-byte, unescaped inputs.
private theorem unchanged_if_no_percent (bytes : List UInt8)
    (absent : (37 : UInt8) ∉ bytes.flatMap encodeByte) :
    bytes.flatMap encodeByte = bytes := by
  induction bytes with
  | nil => rfl
  | cons head tail ih =>
    simp only [List.flatMap_cons, List.mem_append, not_or] at absent
    have unescapedHead : unescaped head = true := by
      cases h : unescaped head
      · simp [encodeByte, h] at absent
      · rfl
    simp [encodeByte, unescapedHead, ih absent.2]

def invalidSegments : List (List UInt8) := [[], [46], [46, 46]]

def messageSegment (text : String) : Option (List UInt8) :=
  if text.toUTF8.data.toList ∈ invalidSegments then none else some (percentEncode text)

theorem messageSegment_no_empty_or_dot_segments (text : String) (segment : List UInt8)
    (found : messageSegment text = some segment) : segment ∉ invalidSegments := by
  unfold messageSegment at found
  split at found
  · contradiction
  · rename_i accepted
    have encoded : percentEncode text = segment := Option.some.inj found
    intro invalid
    have markerAbsent : (37 : UInt8) ∉ segment := by
      have safe : ∀ candidate ∈ invalidSegments, (37 : UInt8) ∉ candidate := by decide
      exact safe segment invalid
    rw [← encoded] at markerAbsent
    have unchanged := unchanged_if_no_percent text.toUTF8.data.toList markerAbsent
    have sourceIsSegment : text.toUTF8.data.toList = segment := unchanged.symm.trans encoded
    exact accepted (sourceIsSegment.symm ▸ invalid)

def stripTrailingSlashes (chars : List Char) : List Char :=
  (chars.reverse.dropWhile (· == '/')).reverse

private theorem dropSlashes_head (chars : List Char) :
    (chars.dropWhile (· == '/')).head? ≠ some '/' := by
  induction chars with
  | nil => simp
  | cons head tail ih =>
    by_cases slash : head = '/'
    · simpa [List.dropWhile_cons, slash] using ih
    · simp [slash]

theorem stripTrailingSlashes_no_trailing_slash (chars : List Char) :
    (stripTrailingSlashes chars).getLast? ≠ some '/' := by
  simpa [stripTrailingSlashes, List.getLast?_reverse] using dropSlashes_head chars.reverse

-- Track the first opening bracket since the last closing bracket. When the final
-- character arrives, check the same nonempty span used by the slice operation.
def scanBrackets (index : Nat) (opening : Option Nat) : List Char → Option (Nat × Nat)
  | [] => none
  | [last] =>
    if last = ']' then
      opening.bind fun openIndex =>
        if openIndex + 1 < index then some (openIndex, index) else none
    else none
  | char :: next :: rest =>
    let opening := if char = ']' then none else
      if char = '[' then opening.or (some index) else opening
    scanBrackets (index + 1) opening (next :: rest)

def bracketSpan (chars : List Char) : Option (Nat × Nat) :=
  scanBrackets 0 none chars

private theorem scanBrackets_bounds (chars : List Char) (index : Nat) (opening : Option Nat)
    (openIndex closeIndex : Nat)
    (found : scanBrackets index opening chars = some (openIndex, closeIndex)) :
    openIndex + 1 < closeIndex ∧ closeIndex + 1 = index + chars.length := by
  induction chars generalizing index opening with
  | nil => simp [scanBrackets] at found
  | cons char rest ih =>
    cases rest with
    | nil =>
      simp only [scanBrackets] at found
      split at found
      · cases opening with
        | none => simp at found
        | some candidate =>
          simp only [Option.bind_some] at found
          split at found
          · rename_i nonempty
            simp only [Option.some.injEq, Prod.mk.injEq] at found
            obtain ⟨rfl, rfl⟩ := found
            exact ⟨nonempty, rfl⟩
          · simp at found
      · simp at found
    | cons next rest =>
      simp only [scanBrackets] at found
      obtain ⟨nonempty, last⟩ := ih _ _ found
      simp only [List.length_cons] at last ⊢
      exact ⟨nonempty, by omega⟩

theorem bracketSpan_valid_bounds (chars : List Char) (openIndex closeIndex : Nat)
    (found : bracketSpan chars = some (openIndex, closeIndex)) :
    openIndex + 1 < closeIndex ∧ closeIndex + 1 = chars.length ∧
      openIndex + 1 < chars.length ∧ closeIndex < chars.length := by
  obtain ⟨nonempty, last⟩ := scanBrackets_bounds chars 0 none openIndex closeIndex found
  exact ⟨nonempty, by omega, by omega, by omega⟩

end Formal.TestMessageUrl
