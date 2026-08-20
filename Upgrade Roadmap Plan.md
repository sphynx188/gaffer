# Soccer Coach Web App — Product & Feature Roadmap

## Overview

A coaching management web application designed primarily for soccer coaches working with younger players (roughly ages 9–12).

The overall design direction is a **Football Manager-style coaching dashboard**: information is presented through useful widgets, dashboards, calendars, team management tools, and interactive tactical/drill boards.

The goal is to make the app a central place for planning teams, sessions, drills, tactics, attendance, and coaching information.

---

# Current Core App

## Coach Dashboard

When the coach logs in, they see a central dashboard containing:

- Week-by-week calendar
- Upcoming/current sessions
- Coaching schedule
- Overview of their teams

## Teams

The coach can manage multiple teams.

Each team has its own dashboard with a Football Manager-style overview and widgets.

### Team Overview

Provides a quick summary of the team and useful information.

### Roster

Shows all players registered to the team.

### Attendance / Availability

Weekly attendance tracking where the coach can record whether each player attended.

The longer-term purpose is to use attendance data for end-of-season reviews, e.g. identifying players who attended only a certain percentage of sessions.

### Sessions

Coaches can create sessions for a specific team.

Sessions should automatically connect to:

- The team's calendar
- The coach's calendar

Sessions can contain drills selected from the Drill Library.

---

# Drill Creator

The Drill Creator should eventually become a full interactive 2D football drill-design tool.

## Creating a Drill

Clicking **Create Drill** opens a 2D football pitch editor.

### Pitch Options

The coach can choose:

- Full pitch
- 3/4 pitch
- Half pitch
- Quarter pitch

The pitch can also be displayed as:

- Portrait
- Landscape

This allows the coach to choose the amount of space appropriate for the drill.

## Equipment / Objects

The editor should have a right-hand tools panel, similar in concept to a simplified Photoshop-style editor.

Objects can be dragged onto the pitch and repositioned.

Possible objects include:

- Flat markers / cones
- Witches' hats
- Mannequins
- Player markers
- Ball

More equipment can be added later.

## Movement & Passing Arrows

The coach should be able to draw different types of movement indicators.

### Ball Movement

Shows where the ball travels or where a pass is played.

### Player Movement

Shows where a player moves.

The two arrow types should be visually distinguishable.

## Drill Phases

A drill should support multiple phases.

Example:

**Phase 1 → Phase 2 → Phase 3 → Phase 4**

Each phase can have a different arrangement of:

- Players
- Equipment
- Ball
- Passing arrows
- Movement arrows

The coach can switch between phases to explain how the drill progresses.

## Future Animation

The long-term goal is for drill phases to become animated.

Eventually:

- Players can move
- The ball can move
- Passes can play
- Player movements can play
- The drill can be viewed as a sequence

However, animation is a later-stage feature.

### Initial Goal

Build an excellent **static, interactive, multi-phase drill creator** first.

---

# Drill Library

Drills created in the Drill Creator should be saved into a reusable Drill Library.

The Drill Creator does **not** need to be team-specific.

A coach should be able to:

1. Create a drill
2. Save it
3. Find it later in their Drill Library
4. Add it to a session

When creating a session, the coach can select/drag drills from the library into the session.

This means a drill only needs to be created once and can be reused across multiple teams and sessions.

---

# Tactic Creator

The Tactic Creator is separate from the Drill Creator.

Unlike drills, tactics are **team-specific**.

## Creating a Tactic

Click **Tactics**.

The coach then selects the team they want to create the tactic for.

The team's roster is automatically loaded.

## Tactical Board

The tactic creator uses a **full football pitch**.

Players appear in a panel beside the pitch.

Players should be automatically grouped/sorted by position:

1. Goalkeepers
2. Defenders
3. Midfielders
4. Attackers

The coach can drag individual players onto the pitch.

Players should represent the actual players from the selected team's roster, rather than generic player dots.

## Tactical Drawing Tools

Similar to the Drill Creator, the coach can draw tactical instructions.

Examples:

- Player movement arrows
- Ball/pass arrows
- Runs
- Positioning
- Tactical shape
- Passing patterns
- Pressing movements
- Build-up movements

The objective is for the board to feel like something a professional soccer coach could actually use to explain tactics.

## Static Tactics

The initial version should support static tactical diagrams.

For example:

**4-3-3 — Build Up**

Showing:

- Formation
- Player positions
- Movement arrows
- Passing arrows
- Tactical shape

The tactic can then be saved and reused.

---

# Animated Tactics — Future Feature

The eventual goal is for the Tactic Creator to support animated tactical sequences.

The coach should be able to create a play and then press:

**▶ Play**

The tactical sequence then plays out on the pitch.

For example:

1. Defender receives the ball
2. Midfielder moves into space
3. Winger makes a run
4. Ball is passed
5. Players reposition
6. Next movement occurs

Eventually the coach should be able to effectively **build and play back an entire tactical sequence**.

The first version does not need animation.

### Development approach

Build:

**Static tactical board → Interactive sequences → Animation/playback**

---

# Overall Product Structure

The main coaching workflow should eventually look something like:

**Coach Dashboard**
↓
**Teams**
↓
**Team Dashboard**
- Overview
- Roster
- Attendance
- Sessions
- Tactics

And separately:

**Drill Library**
↓
**Drill Creator**

Drills can then be inserted into:

**Team Session**
↓
**Selected Drills**

While tactics are:

**Team**
↓
**Tactics**
↓
**Tactical Board**
↓
**Static / Animated Tactical Play**

---

# Development Philosophy

Do not try to build every advanced feature immediately.

Prioritise:

1. Strong basic functionality
2. Clean and intuitive UI
3. Excellent drag-and-drop interactions
4. Reusable drills and sessions
5. Reliable team/player data
6. Static drill and tactic creation
7. Multi-phase functionality
8. Animation later

The ultimate vision is a polished **soccer coaching operating system** that combines:

- Team management
- Player management
- Attendance
- Scheduling
- Session planning
- Drill creation
- Drill libraries
- Tactical planning
- Tactical playback
- Coaching information

The app should feel purpose-built for a soccer coach rather than like a generic CRM or calendar application.


---

# Authentication & Mobile Experience

## Current Login

The current authentication flow uses an email-based magic link:

1. Coach enters their email
2. An authentication email is sent
3. Coach clicks the magic link
4. Coach is signed in

This works, but it is currently too cumbersome for frequent mobile use.

There is also a current Supabase email-rate limitation, meaning repeated failed/incorrect login attempts can prevent another authentication email from being sent for a period of time.

## Future Authentication System

The goal is to move toward a more traditional, persistent login system.

### Coach Account

Each coach should have their own account with:

- Username/email
- Password
- Unique Coach ID

The Coach ID should be associated with all of the coach's:

- Teams
- Players
- Sessions
- Attendance records
- Drills
- Tactics
- Calendar events
- Other coaching data

The coach should effectively have a persistent identity within the application rather than relying on a magic-link login every time.

### Team Assignment

Teams should be linked to the coach's Coach ID.

This allows the system to determine:

> Which teams belong to this coach?

and automatically display the appropriate teams, sessions, players and other information after login.

---

# Mobile-First Coaching Workflow

A major goal of the application is to make common coaching tasks extremely quick on a phone.

The first mobile version does **not necessarily need to be a native iOS/Android application**.

A responsive web application that works properly on mobile is sufficient as an initial stage.

## Key Mobile Use Case — Post-Training Attendance

After a training session finishes, the coach should be able to:

1. Open the app on their phone
2. Log in quickly
3. Open the relevant team/session
4. Complete attendance
5. Save it
6. Close the app

The entire process should be significantly easier and faster than using a Google Sheet on a phone.

## Mobile UX Principle

Common actions should require as few taps as possible.

Particularly:

- Attendance
- Session information
- Calendar
- Team/player information

The app should feel like a tool a coach can use **immediately after training while everything is fresh in their mind**.

---

# Future Native Mobile App

The initial goal is a responsive web application that works well on mobile.

Longer term, the application could become a dedicated mobile application, potentially published through:

- Apple App Store
- Android / Google Play

The underlying product should therefore be designed with mobile use in mind from the beginning, even if native apps are not built initially.

### Development progression

**Desktop web app → Responsive mobile web app → Native iOS/Android app (later)**

---

# Authentication Priority

The current magic-link system can remain during development if necessary, but eventually the authentication system should be upgraded to:

**Persistent Coach Account → Secure Username/Password Login → Coach ID → Teams & Data**

The priority is to make logging in fast, reliable and practical for repeated use on mobile.
