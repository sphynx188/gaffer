import type { TourStep } from '../components/design/editor/onboarding/tourSteps'

// The app-shell walkthrough (2026-09-01) — what a coach sees the first time
// they land on Home, and specifically the moment right after redeeming an
// invite (JoinPage sends them to `/?joined=1`, which forces this open even
// for someone who has dismissed it before).
//
// Reuses the editors' tour machinery wholesale rather than building a second
// one: `OnboardingTour` was already presentational and knows nothing about
// what it is pointing at, and `useOnboardingTour(steps, seenKey)` was already
// parameterised by both. This file is only content.
//
// TWO ARRIVALS, TWO TOURS. They are not variations on a theme — the two
// people have opposite problems, and one script cannot serve both:
//
//   An INVITED COACH did not choose this product, was not sold it, and may
//   never have heard of it; their Technical Director sent them a link. They
//   arrive at a club that already HAS a library, and that library is the
//   thing they were invited for. Their tour leads with it.
//
//   A FOUNDER just created a club that is completely empty. Telling them to
//   "start with the library" points at nothing — the first version of this
//   file did exactly that, because it was written for the invite flow and
//   then reused for everyone. Their tour leads with making the first drill,
//   which is the only thing on this screen that can produce anything.
//
// Which one runs is decided by whether the club has any boards at all, not
// by role: an admin who joins a club that is already full is, for the
// purposes of this walkthrough, in the coach's situation, and an empty
// library is wrong to point at whoever is looking.
//
// Deliberately five steps each. The editors' tours run to ten because a coach
// who has opened an editor has already committed to using the thing; someone
// who has just clicked a link from their boss, or just typed a club name, has
// not. The rule is to reach value fast, not to teach everything.
export const APP_TOUR_SEEN_KEY = 'gaffer-onboarding-app-shell-seen'

// The club switcher step is identical in both and says the same thing about
// ownership, which is the one idea the whole product rests on — a club's
// work belongs to the club, not to whoever happened to draw it.
const CLUB_STEP: TourStep = {
  id: 'club',
  anchor: 'club-switcher',
  title: 'This is your club',
  body: "Everything in Gaffer belongs to this club, not to you personally — so it stays put as coaches come and go. If you're in more than one, switch between them here.",
  placement: 'bottom',
}

const SETTINGS_STEP: TourStep = {
  id: 'settings',
  anchor: 'nav-settings',
  title: 'Your profile lives here',
  body: 'Set the name your club sees you under, and switch between light and dark. That is the whole tour — have a look around.',
  placement: 'right',
  openNav: true,
}

// Arrived by invite, into a club that already has work in it.
export const COACH_TOUR_STEPS: TourStep[] = [
  CLUB_STEP,
  {
    id: 'library',
    anchor: 'nav-library',
    title: 'Start with the library',
    body: 'Every drill and tactic your club has built, in one place. This is what you were invited to — open anything to see how it works, or run it in your next session.',
    placement: 'right',
    openNav: true,
  },
  {
    id: 'create',
    anchor: 'nav-create',
    title: 'Add your own',
    body: 'Design a drill or a tactic on a real pitch — place players, draw runs, then play it back to see it move. Whatever you make joins the club library.',
    placement: 'right',
    openNav: true,
  },
  {
    id: 'home',
    anchor: 'nav-home',
    title: 'Home picks up where you left off',
    body: 'The boards you opened most recently sit here, so getting back to the session you were planning is one tap rather than a search.',
    placement: 'right',
    openNav: true,
  },
  SETTINGS_STEP,
]

// Just created the club. Nothing exists yet, so every step has to point at
// something that still makes sense when the library is empty.
export const FOUNDER_TOUR_STEPS: TourStep[] = [
  CLUB_STEP,
  {
    id: 'first-drill',
    anchor: 'home-new-drill',
    title: 'Start with one drill',
    body: "Place players on a real pitch, draw their runs, then play it back to watch it move. It's the fastest way to see what this is — take a session you already run and put it on the board.",
    placement: 'bottom',
  },
  {
    id: 'library',
    anchor: 'nav-library',
    title: 'It all collects here',
    body: 'Every drill and tactic you make lands in the club library, ready to reuse next season or group into collections for a block of training.',
    placement: 'right',
    openNav: true,
  },
  {
    id: 'coaches',
    anchor: 'nav-coaches',
    title: 'Then bring your coaches in',
    body: "Invite the rest of your staff and they get everything above from day one — they pick their own password, so you never handle it. Worth doing once there's something for them to open.",
    placement: 'right',
    openNav: true,
  },
  SETTINGS_STEP,
]
