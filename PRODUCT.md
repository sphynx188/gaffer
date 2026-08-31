# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary customers are **clubs and academies** (B2B/enterprise), not
individual solo coaches. Within an organization, **Technical Directors and
lead coaches hold admin-level access** — they design drills and tactics and
share them with the other coaches at the club. Other coaches at the org use
and reuse that shared library.

This is the confirmed target market and role model going forward. It
supersedes the "single external user, no public signup" framing in the
existing `CLAUDE.md`/`HANDOFF.md` — those documents describe the current
solo-built implementation's history, not the product's intended audience or
business model. See Capabilities and Constraints below for the resulting
gap between product direction and current architecture.

## Product Purpose

Gaffer exists to stop clubs from losing their own coaching knowledge. Coaches
routinely design training sessions but have no way to record and reuse the
drills and tactics they run, so they keep reinventing ideas instead of
capitalizing on what already worked. Gaffer gives a club/academy a persistent
library of its own drills and tactics that its coaches can build on over
time, share internally, and carry with them if they move between teams
within the org — so the club's style of coaching is preserved rather than
lost with staff turnover.

## Positioning

Distinct from generic team-management tools (TeamSnap, spreadsheets, a
personal session planner): Gaffer's mechanism is an **organization-owned,
reusable drill/tactics library with sharing across an org's coaches** —
not scheduling or roster tracking for a single team or a single coach.
The business model is B2B: sell to clubs/academies, with the library
becoming a retained, transferable asset of the organization rather than
of any one coach.

## Operating Context

Coaches use the drill/tactics design surface (Konva-based pitch canvas,
equipment placement, movement arrows, pitch size/orientation) and session
planning/scheduling/attendance tracking day to day, including pitch-side on
a phone or tablet. Team/session/roster/attendance workflows already exist
in the current build; the organization/club layer (accounts spanning
multiple coaches, admin roles, shared libraries) does not yet.

## Capabilities and Constraints

- Confirmed roles: **Technical Director / lead coach** = admin-level,
  creates and shares drills/tactics; **coach** = uses/reuses the shared
  library. Finer-grained permissions (what exactly a non-admin coach can
  or can't do, whether parent/player accounts ever exist) were not
  specified — undecided, not to be invented.
- **Known architecture gap**: the current codebase is built single-tenant,
  single-user — one Supabase-authenticated user, no org/club data model,
  no cross-coach sharing, no admin-vs-coach role distinction (see
  `CLAUDE.md`: "single shared Zustand store," "single external user").
  This is a real, currently-unresolved gap between confirmed product
  direction and what's built, not a discrepancy to silently paper over in
  design work.
- Terminology: "club" / "academy" = the paying organization; "Technical
  Director" / "lead coach" = admin role; "coach" = library consumer.

## Brand Commitments

Product name "Gaffer" is retained.

## Evidence on Hand

`HANDOFF.md`, `CLAUDE.md`, and `DESIGN.md` document the current solo-built
implementation's architecture and history in detail — real and useful as
evidence of what's built, but not evidence of the target audience or
business model, which this file now records separately.

## Product Principles

1. A club's coaching knowledge (drills, tactics) is an organizational asset
   to be captured, reused, and preserved — not something that lives in one
   coach's head or personal notes.
2. The product serves clubs/academies as paying B2B customers first; it is
   no longer scoped as a personal tool for a single coach.
3. Admin roles (Technical Director / lead coach) curate and share; other
   coaches consume and reuse — future permissions and UI should reflect
   that hierarchy once built.
4. Design and data-model work going forward must not assume a single
   logged-in user — multi-coach, multi-team organizations are the target,
   even though the current build doesn't yet implement that.
