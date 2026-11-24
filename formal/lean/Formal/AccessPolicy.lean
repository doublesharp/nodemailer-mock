import Std

namespace Formal.AccessPolicy

structure AccessPolicy where
  disableFileAccess : Bool
  disableUrlAccess : Bool
  deriving DecidableEq

def merge (left right : AccessPolicy) : AccessPolicy :=
  ⟨left.disableFileAccess || right.disableFileAccess, left.disableUrlAccess || right.disableUrlAccess⟩

def effective (transport defaults message : AccessPolicy) : AccessPolicy :=
  merge (merge transport defaults) message

theorem merge_assoc (a b c : AccessPolicy) :
    merge (merge a b) c = merge a (merge b c) := by
  cases a; cases b; cases c
  simp [merge, Bool.or_assoc]

theorem merge_comm (a b : AccessPolicy) : merge a b = merge b a := by
  cases a; cases b
  simp [merge, Bool.or_comm]

theorem merge_idem (a : AccessPolicy) : merge a a = a := by
  cases a
  simp [merge]

theorem merge_monotonic_file (transport defaults message : AccessPolicy)
    (disabled : transport.disableFileAccess = true ∨ defaults.disableFileAccess = true ∨
      message.disableFileAccess = true) :
    (effective transport defaults message).disableFileAccess = true := by
  simpa [effective, merge, Bool.or_assoc] using disabled

theorem merge_monotonic_url (transport defaults message : AccessPolicy)
    (disabled : transport.disableUrlAccess = true ∨ defaults.disableUrlAccess = true ∨
      message.disableUrlAccess = true) :
    (effective transport defaults message).disableUrlAccess = true := by
  simpa [effective, merge, Bool.or_assoc] using disabled

-- Classification is the boundary with WHATWG URL parsing. An external href
-- is subject to URL policy; an external path is classified as HTTP(S) or file.
inductive Source where
  | inline | file | url | dataUri
  deriving DecidableEq

structure References where
  href : Option Source := none
  path : Option Source := none
  deriving DecidableEq

inductive Content where
  | falsy | inline | nested (references : References)
  deriving DecidableEq

structure Descriptor where
  outer : References
  content : Content := .falsy
  deriving DecidableEq

def hrefSource : Source → Source
  | .file => .url
  | source => source

def References.sources (refs : References) : List Source :=
  [refs.href.map hrefSource, refs.path].filterMap id

def Descriptor.sources (descriptor : Descriptor) : List Source :=
  descriptor.outer.sources ++
    match descriptor.content with
    | .nested refs => refs.sources
    | .falsy | .inline => []

-- Preflight inspects the outer fields even when content is present. Falsy
-- content can therefore fall back to an outer source only after it is checked.
theorem falsy_content_checks_outer (refs : References) :
    (Descriptor.mk refs .falsy).sources = refs.sources := by
  simp [Descriptor.sources]

structure Attachment where
  descriptor : Descriptor
  raw : Option Descriptor := none

structure MessageContent where
  raw : Option Descriptor := none
  text : Option Descriptor := none
  html : Option Descriptor := none
  watchHtml : Option Descriptor := none
  amp : Option Descriptor := none
  icalEvent : Option Descriptor := none
  alternatives : List Descriptor := []
  attachments : List Attachment := []

def MessageContent.descriptors (message : MessageContent) : List Descriptor :=
  [message.raw, message.text, message.html, message.watchHtml, message.amp, message.icalEvent].filterMap id ++
    message.alternatives ++ message.attachments.map Attachment.descriptor ++
    message.attachments.filterMap Attachment.raw

inductive AccessError where
  | EFILEACCESS | EURLACCESS
  deriving DecidableEq

def check (policy : AccessPolicy) : Source → Option AccessError
  | .file => if policy.disableFileAccess then some .EFILEACCESS else none
  | .url => if policy.disableUrlAccess then some .EURLACCESS else none
  | .inline | .dataUri => none

def violations (policy : AccessPolicy) (message : MessageContent) : List AccessError :=
  (message.descriptors.flatMap Descriptor.sources).filterMap (check policy)

def preflight (policy : AccessPolicy) (message : MessageContent) : Option AccessError :=
  (violations policy message).head?

private theorem preflight_rejects {policy : AccessPolicy} {message : MessageContent}
    {source : Source} {error : AccessError} {descriptor : Descriptor}
    (present : descriptor ∈ message.descriptors) (referenced : source ∈ descriptor.sources)
    (checked : check policy source = some error) :
    error ∈ violations policy message ∧ ∃ firstError, preflight policy message = some firstError := by
  have reported : error ∈ violations policy message :=
    List.mem_filterMap.mpr ⟨source, List.mem_flatMap.mpr ⟨descriptor, present, referenced⟩, checked⟩
  refine ⟨reported, ?_⟩
  unfold preflight
  cases h : violations policy message with
  | nil => simp [h] at reported
  | cons first rest => exact ⟨first, rfl⟩

-- Each offending source accounts for its own error. The first violation
-- determines the error returned for a message with several violations.
theorem preflight_blocks_file_access (policy : AccessPolicy) (message : MessageContent)
    (descriptor : Descriptor) (present : descriptor ∈ message.descriptors)
    (disabled : policy.disableFileAccess = true) (localFile : Source.file ∈ descriptor.sources) :
    AccessError.EFILEACCESS ∈ violations policy message ∧
      ∃ error, preflight policy message = some error :=
  preflight_rejects present localFile (by simp [check, disabled])

theorem preflight_blocks_url_access (policy : AccessPolicy) (message : MessageContent)
    (descriptor : Descriptor) (present : descriptor ∈ message.descriptors)
    (disabled : policy.disableUrlAccess = true) (remoteUrl : Source.url ∈ descriptor.sources) :
    AccessError.EURLACCESS ∈ violations policy message ∧
      ∃ error, preflight policy message = some error :=
  preflight_rejects present remoteUrl (by simp [check, disabled])

theorem data_uri_never_rejected (policy : AccessPolicy) : check policy .dataUri = none := rfl

-- MockAttachments selects the first nonempty top-level path or href.
-- The refs store only present sources, with empty strings represented by none.
def attachmentTarget (attachment : Attachment) : Option Source :=
  attachment.descriptor.outer.path.or attachment.descriptor.outer.href

inductive AttachmentAction where
  | pass | substitute | reject (error : AccessError)
  deriving DecidableEq

def prepareAttachment (policy : AccessPolicy) (rendersContent allowRemoteAttachments : Bool)
    (attachment : Attachment) : AttachmentAction :=
  if attachmentTarget attachment = some .url then
    if policy.disableUrlAccess then
      if rendersContent then .reject .EURLACCESS else .pass
    else if allowRemoteAttachments then .pass else .substitute
  else .pass

theorem default_attachment_isolation (policy : AccessPolicy) (attachment : Attachment)
    (remoteUrl : attachmentTarget attachment = some .url) :
    prepareAttachment policy true false attachment = .reject .EURLACCESS ∨
      prepareAttachment policy true false attachment = .substitute := by
  cases h : policy.disableUrlAccess <;> simp [prepareAttachment, remoteUrl, h]

theorem ordinary_send_preserves_unread_attachment (policy : AccessPolicy) (attachment : Attachment)
    (remoteUrl : attachmentTarget attachment = some .url) (disabled : policy.disableUrlAccess = true) :
    prepareAttachment policy false false attachment = .pass := by
  simp [prepareAttachment, remoteUrl, disabled]

end Formal.AccessPolicy
