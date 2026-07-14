/**
 * Serial queue for window-scroll animations.
 *
 * Rapid-fire navigation keys (d/u/n/N, held-down j/k) each trigger a smooth
 * scroll. Firing several `window.scrollTo` calls back-to-back interrupts
 * whatever animation is already running, which looks janky, and any command
 * that decides its target based on "what's visible right now" (n/N) needs
 * that read to happen only once the previous scroll has actually settled -
 * otherwise it sees a mid-animation snapshot instead of the resting state.
 *
 * This queue runs one scroll at a time and offers two coalescing strategies
 * so holding a key down doesn't build an ever-growing backlog:
 * - `enqueueAbsolute` with a `coalesceKey` replaces the target of any
 *   not-yet-started task sharing that key, so only the latest survives
 *   (chapter jumps: each new target already accounts for every prior press).
 * - `enqueueDelta` sums into any not-yet-started task sharing its key, so
 *   repeated nudges accumulate into one bigger scroll (the j/k page nudges).
 *
 * On top of that, each scroll's speed scales up proportionally with how many
 * tasks are currently waiting behind it - re-read every frame, so a backlog
 * that grows or drains mid-animation speeds it up or back down immediately,
 * rather than playing back a fixed number of equal-paced animations one at
 * a time - and is floored by distance, so a single huge jump (gg/G across a
 * long book) still finishes within a bounded max duration instead of
 * crawling along at the same fixed speed as a short scroll.
 */

interface QueueTask {
  kind: "absolute" | "delta";
  coalesceKey?: string;
  getTargetY?: () => number | null;
  delta?: number;
  suppressTracking: boolean;
  // Callers waiting on this task - a coalesced task can have more than one,
  // since several enqueue calls may have merged into it before it ran.
  resolvers: Array<() => void>;
}

// Scroll speed at an empty queue (no backlog waiting behind the current
// animation), and how many extra multiples of it a deep backlog can reach.
// Speed scales up proportionally with LIVE queue depth (re-read every frame,
// see `scrollWindowTo`) so a backlog that grows mid-animation speeds it up
// immediately, and drains faster the deeper it gets, instead of playing back
// a fixed number of equal-paced animations one at a time.
const BASE_SPEED_PX_PER_MS = 3.5;
const MAX_SPEED_MULTIPLIER = 8;
// However far a single scroll has to travel, its speed is also floored so
// the whole trip can't take longer than this - otherwise a huge jump (e.g.
// gg/G across a long book) would crawl along at the same fixed speed as a
// short one and take proportionally forever.
const MAX_DURATION_MS = 600;
// The mirror of MAX_DURATION_MS: a short trip's speed is also capped so the
// trip can't take *less* than this. Without it, a small nudge (the j/k
// ~100px page step) finishes in a frame or two at BASE_SPEED and reads as an
// instant jump instead of a scroll. Only bites for trips short enough that
// base speed would otherwise blow past it; longer trips (d/u, chapter jumps)
// stay at base speed since their distance keeps them above this ceiling.
const MIN_DURATION_MS = 150;
// Caps how large a single frame's step can be after a dropped frame or a
// backgrounded tab, so the queue can't "teleport" past its target.
const MAX_FRAME_DELTA_MS = 50;

/**
 * Smoothly scrolls the window to an absolute Y offset at a speed that scales
 * proportionally with how many tasks are currently queued up behind it -
 * re-read every frame, so a backlog that grows or drains mid-animation
 * speeds it up or back down immediately - and is also floored so the whole
 * trip can't exceed MAX_DURATION_MS regardless of how far it has to travel.
 * Resolves once the scroll has fully settled, with a couple of animation
 * frames of grace so any IntersectionObserver callbacks triggered by the
 * new position get a chance to fire before the caller proceeds.
 * @param targetY - Absolute vertical scroll offset to animate to.
 * @param getQueueDepth - Called every frame; returns the current number of tasks waiting behind this one.
 * @returns Promise that resolves once the scroll (and settle grace period) completes.
 */
function scrollWindowTo(targetY: number, getQueueDepth: () => number): Promise<void> {
  return new Promise((resolve) => {
    const settle = () => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    };

    // Clamp the target into the actually scrollable range. window.scrollTo
    // silently clamps the position it applies, so an out-of-bounds target
    // (a j nudge past the bottom, a k nudge above the top) can never be
    // reached - window.scrollY plateaus at the boundary while `remaining`
    // stays > 1 forever, so the step loop below would spin indefinitely:
    // it never settles, jams the serial queue behind it, and keeps yanking
    // the page back toward the unreachable target every frame (fighting any
    // manual scroll away from the edge). Clamping makes the target reachable.
    const maxScrollY = Math.max(
      0,
      document.documentElement.scrollHeight - window.innerHeight
    );
    targetY = Math.max(0, Math.min(targetY, maxScrollY));

    const totalDistance = Math.abs(targetY - window.scrollY);
    if (totalDistance < 1) {
      settle();
      return;
    }

    // The whole trip's distance, known upfront, bounds the speed at both ends
    // so the trip lands within [MIN_DURATION_MS, MAX_DURATION_MS] - based on
    // total (not shrinking remaining) distance, which would otherwise let it
    // decelerate near the end. minSpeed keeps a huge jump from crawling;
    // maxSpeed keeps a tiny nudge from finishing in a single frame.
    const minSpeedForDuration = totalDistance / MAX_DURATION_MS;
    const maxSpeedForDuration = totalDistance / MIN_DURATION_MS;

    let lastTime = performance.now();
    const step = (now: number) => {
      const dt = Math.min(now - lastTime, MAX_FRAME_DELTA_MS);
      lastTime = now;

      const current = window.scrollY;
      const remaining = targetY - current;
      if (Math.abs(remaining) < 1) {
        window.scrollTo({ top: targetY, behavior: "auto" });
        settle();
        return;
      }

      const speedMultiplier = Math.min(MAX_SPEED_MULTIPLIER, 1 + getQueueDepth());
      // Clamp into the duration band. maxSpeedForDuration >= minSpeedForDuration
      // always (MIN_DURATION_MS < MAX_DURATION_MS), so the ceiling never fights
      // the floor: a long jump sits at/above base speed (floor irrelevant, ceiling
      // high), a short nudge is pulled down to the ceiling so it stays visible.
      const speed = Math.min(
        Math.max(BASE_SPEED_PX_PER_MS * speedMultiplier, minSpeedForDuration),
        maxSpeedForDuration
      );
      const moveBy = Math.sign(remaining) * Math.min(Math.abs(remaining), speed * dt);
      window.scrollTo({ top: current + moveBy, behavior: "auto" });
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

/**
 * Creates an independent scroll queue instance.
 * @returns The queue's public API: enqueueAbsolute, enqueueDelta, isChapterTrackingSuppressed.
 */
export function createScrollQueue() {
  const queue: QueueTask[] = [];
  let isRunning = false;
  let suppressCount = 0;

  const drain = async () => {
    if (isRunning) {
      return;
    }
    isRunning = true;
    while (queue.length > 0) {
      const task = queue.shift();
      if (!task) {
        continue;
      }
      const targetY = task.kind === "absolute" ? task.getTargetY!() : window.scrollY + (task.delta ?? 0);
      if (targetY === null) {
        task.resolvers.forEach((resolve) => resolve());
        continue;
      }
      if (task.suppressTracking) {
        suppressCount++;
      }
      try {
        // Pass a live accessor (not a snapshot) so tasks queued up *after*
        // this one starts running still speed up its animation immediately.
        await scrollWindowTo(targetY, () => queue.length);
      } finally {
        if (task.suppressTracking) {
          suppressCount--;
        }
      }
      task.resolvers.forEach((resolve) => resolve());
    }
    isRunning = false;
  };

  /**
   * Queues a jump to an absolute Y position, computed lazily once it's this
   * task's turn to run (so it can depend on state left behind by whatever
   * ran before it).
   * @param getTargetY - Called at execution time; returns the absolute Y to scroll to, or null to skip.
   * @param options.coalesceKey - If a not-yet-started task shares this key, its target is replaced instead of queueing a new task.
   * @param options.suppressTracking - Whether to mark chapter tracking as suppressed for the duration of this scroll.
   * @returns Promise that resolves once this (possibly coalesced) task completes or is skipped.
   */
  const enqueueAbsolute = (
    getTargetY: () => number | null,
    options: { coalesceKey?: string; suppressTracking?: boolean } = {}
  ): Promise<void> => {
    return new Promise((resolve) => {
      if (options.coalesceKey) {
        const existing = queue.find(
          (task) => task.kind === "absolute" && task.coalesceKey === options.coalesceKey
        );
        if (existing) {
          existing.getTargetY = getTargetY;
          existing.resolvers.push(resolve);
          return;
        }
      }
      queue.push({
        kind: "absolute",
        coalesceKey: options.coalesceKey,
        getTargetY,
        suppressTracking: options.suppressTracking ?? false,
        resolvers: [resolve],
      });
      drain();
    });
  };

  /**
   * Queues a relative scroll nudge. A nudge sharing `coalesceKey` with an
   * already-queued, not-yet-started nudge is summed into it instead of
   * queued separately, so holding a key down produces one growing scroll
   * rather than a backlog of tiny ones.
   * @param delta - Pixels to scroll by, relative to the position when this task actually runs.
   * @param coalesceKey - Key used to merge with an already-queued, not-yet-started nudge.
   * @param options.suppressTracking - Whether to mark chapter tracking as suppressed for the duration of this scroll.
   * @returns Promise that resolves once this (possibly coalesced) task completes.
   */
  const enqueueDelta = (
    delta: number,
    coalesceKey: string,
    options: { suppressTracking?: boolean } = {}
  ): Promise<void> => {
    return new Promise((resolve) => {
      const existing = queue.find((task) => task.kind === "delta" && task.coalesceKey === coalesceKey);
      if (existing) {
        existing.delta = (existing.delta ?? 0) + delta;
        existing.resolvers.push(resolve);
        return;
      }
      queue.push({
        kind: "delta",
        coalesceKey,
        delta,
        suppressTracking: options.suppressTracking ?? false,
        resolvers: [resolve],
      });
      drain();
    });
  };

  return {
    enqueueAbsolute,
    enqueueDelta,
    /**
     * Whether a suppress-tracking scroll is currently running or pending -
     * used to tell the reading-band chapter tracker to ignore intersection
     * changes caused by our own programmatic scroll.
     * @returns True while at least one suppress-tracking task is in flight.
     */
    isChapterTrackingSuppressed: () => suppressCount > 0,
  };
}
