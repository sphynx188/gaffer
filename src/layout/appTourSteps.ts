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
// WHO THIS IS FOR shapes every line of copy. An invited coach did not choose
// this product, was not sold it, and may never have heard of it — their
// Technical Director sent them a link. So the tour answers "what is this and
// what is in it for me", not "here are our features". It leads with the
// library, because a club's existing drills are the thing they were invited
// FOR and the only part that is valuable on day one; creating their own comes
// after.
//
// Deliberately five steps. The editors' tours run to ten because a coach who
// has opened an editor has already committed to using the thing; someone who
// has just clicked a link from their boss has not, and the reference's own
// rule is to get to value fast rather than teach everything.
export const APP_TOUR_SEEN_KEY = 'gaffer-onboarding-app-shell-seen'

export const APP_TOUR_STEPS: TourStep[] = [
  {
    id: 'club',
    anchor: 'club-switcher',
    title: 'This is your club',
    body: "Everything you see in Gaffer belongs to this club, not to you personally — so it stays put as coaches come and go. If you're in more than one, switch between them here.",
    placement: 'bottom',
  },
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
  {
    id: 'settings',
    anchor: 'nav-settings',
    title: 'Your profile lives here',
    body: 'Set the name your club sees you under, and switch between light and dark. That is the whole tour — have a look around.',
    placement: 'right',
    openNav: true,
  },
]
