// What the doodle (Task F.4) does on each pointer, focus and key event: a pure reducer shared by nothing but the
// loader in src/components/Doodle.astro, unit-tested in tests/doodles.test.ts.
//
// - Mouse hover or keyboard focus opens the speech bubble and plays the animation once. It plays again only when the
//   bubble opens again (a new hover or focus), never while it's open.
// - A mouse click or Enter follows the link.
// - Touch has no hover: the first tap opens the bubble (with "Tap again to read more"), animates and cancels the
//   navigation ("armed"); the second tap follows the link; a tap anywhere else closes it.
// - WCAG 1.4.13: the bubble stays while the pointer is on the doodle or the bubble (the loader listens on the wrapper
//   holding both) or focus is on the link, and Esc closes it without moving focus or the pointer.
//
// Reduced motion doesn't change these rules: the loader skips the animation and opens only the bubble.

export interface DoodleState {
  open: boolean;
  hovered: boolean;
  focused: boolean;
  /** Touch only: the first tap opened the bubble, so the next tap on the link follows it. Shows the tap hint. */
  armed: boolean;
}

export const INITIAL_STATE: DoodleState = { open: false, hovered: false, focused: false, armed: false };

export type DoodleEvent =
  | { type: 'enter' | 'leave'; pointerType: string }
  | { type: 'focus' | 'blur' | 'escape' | 'outside' }
  | { type: 'click'; via: 'touch' | 'pointer' | 'keyboard' };

export interface Reaction {
  state: DoodleState;
  /** Play the animation (the loader skips it with reduced motion). */
  animate: boolean;
  /** Cancel the link's navigation (only the first tap). */
  preventNavigation: boolean;
}

const react = (state: DoodleState, animate = false, preventNavigation = false): Reaction => ({
  state,
  animate,
  preventNavigation,
});

/** Opens the bubble if it's closed, and animates only then. */
const open = (state: DoodleState, change: Partial<DoodleState>) =>
  react({ ...state, ...change, open: true }, !state.open);

const close = (state: DoodleState, change: Partial<DoodleState> = {}) =>
  react({ ...state, ...change, open: false, armed: false });

export function reduce(state: DoodleState, event: DoodleEvent): Reaction {
  switch (event.type) {
    case 'enter':
      // A touch "enter" comes with every tap; taps are handled by click.
      return event.pointerType === 'touch' ? react(state) : open(state, { hovered: true });
    case 'leave':
      if (event.pointerType === 'touch') return react(state);
      return state.focused || state.armed ? react({ ...state, hovered: false }) : close(state, { hovered: false });
    case 'focus':
      return open(state, { focused: true });
    case 'blur':
      // On touch, a tap on the bubble's text moves focus to the page: the armed bubble stays until a tap elsewhere.
      return state.hovered || state.armed ? react({ ...state, focused: false }) : close(state, { focused: false });
    case 'escape':
      return state.open ? close(state) : react(state);
    case 'outside':
      return state.open || state.armed ? close(state, { hovered: false }) : react(state);
    case 'click':
      if (event.via !== 'touch' || state.armed) return react(state);
      return { ...open(state, { armed: true }), preventNavigation: true };
  }
}
