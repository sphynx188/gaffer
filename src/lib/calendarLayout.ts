import type { CalendarSession } from '../store'
import { timeToMinutes } from './date'

export interface LaidOutSession {
  session: CalendarSession
  top: number // px from the top of the day column
  height: number // px
  leftPct: number // 0-100, position within the day column
  widthPct: number // 0-100, width within the day column
}

const MIN_HEIGHT_PX = 28

interface TimedItem {
  session: CalendarSession
  startMin: number
  endMin: number
}

// Standard calendar/day-view event layout: sessions that overlap in time
// split into side-by-side lanes instead of drawing on top of each other
// (two teams training at the same time is the common case this exists for).
//
// 1. Sort by start time, then partition into overlap "clusters" — a new
//    cluster starts whenever a session begins at/after the latest end time
//    seen so far (nothing from the current cluster is still running).
// 2. Within each cluster, greedily assign a lane per session: the first
//    lane whose previous occupant has already ended takes it, otherwise a
//    new lane opens. Cluster width = lanes used; each session gets
//    leftPct/widthPct from its lane index over that width.
export function layoutDayColumn(sessions: CalendarSession[], rangeStartMin: number, pxPerMin: number): LaidOutSession[] {
  const timed: TimedItem[] = sessions
    .filter((s) => s.start_time != null)
    .map((s) => {
      const startMin = timeToMinutes(s.start_time!)
      return { session: s, startMin, endMin: startMin + s.duration_minutes }
    })
    .sort((a, b) => a.startMin - b.startMin)

  if (timed.length === 0) return []

  const clusters: TimedItem[][] = []
  let current: TimedItem[] = []
  let clusterMaxEnd = -Infinity
  for (const item of timed) {
    if (current.length > 0 && item.startMin >= clusterMaxEnd) {
      clusters.push(current)
      current = []
      clusterMaxEnd = -Infinity
    }
    current.push(item)
    clusterMaxEnd = Math.max(clusterMaxEnd, item.endMin)
  }
  if (current.length > 0) clusters.push(current)

  const result: LaidOutSession[] = []
  for (const cluster of clusters) {
    const laneFreeFrom: number[] = []
    const laneOf = new Map<TimedItem, number>()
    for (const item of cluster) {
      let lane = laneFreeFrom.findIndex((freeFrom) => freeFrom <= item.startMin)
      if (lane === -1) {
        lane = laneFreeFrom.length
        laneFreeFrom.push(item.endMin)
      } else {
        laneFreeFrom[lane] = item.endMin
      }
      laneOf.set(item, lane)
    }
    const clusterWidth = laneFreeFrom.length
    for (const item of cluster) {
      const lane = laneOf.get(item)!
      result.push({
        session: item.session,
        top: (item.startMin - rangeStartMin) * pxPerMin,
        height: Math.max((item.endMin - item.startMin) * pxPerMin, MIN_HEIGHT_PX),
        leftPct: (lane / clusterWidth) * 100,
        widthPct: 100 / clusterWidth,
      })
    }
  }

  return result
}
