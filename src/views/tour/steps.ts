// The guided demo: Engineer, then VP Engineering, then CFO. Copy points at the live numbers on screen
// rather than repeating them, so nothing here is hard-coded.
import type { TourStep } from './Tour';

export const TOUR_STEPS: TourStep[] = [
  {
    persona: 'Engineer', targets: ['eng-window'], title: 'This is Claude Code',
    body: 'Max W. on the Platform team is working in Claude Code, in the desktop app, on PLAT-2417: a real-sized infrastructure job. The session in the middle is the normal agent: its plan, then every read, edit and command.',
  },
  {
    persona: 'Engineer', targets: ['eng-panel'], title: 'A new extension panel',
    body: 'On the right is Economics, a new panel in the app. It prices the work before any code is written, then tracks spend against that price while the agent runs.',
  },
  {
    persona: 'Engineer', targets: ['eng-quote'], title: 'Approve the plan first',
    body: 'The quote comes from similar past work and is broken down by each part of the design. It is above Max’s auto-approve limit, so he approves it before the agent starts.',
    next: 'Approve and start →',
  },
  {
    persona: 'Engineer', targets: ['eng-selfheal'], title: 'Self-healing',
    body: 'As the agent works, the harness reads its log. When the agent repeats work with nothing changed, like re-reading the same file or re-running a failing test, the harness fixes it without asking. Each self-correction shows what it saved.',
    // Advance the run one step at a time so the page holds still while the card is up.
    before: async (c) => { c.click('eng-step'); await c.waitFor('[data-tour="eng-selfheal"] li'); },
  },
  {
    persona: 'Engineer', targets: ['eng-decide'], title: 'It needs your input',
    body: 'The job turned out to be 14 services, not the 6 in the plan, and spend passed the ceiling, so the run pauses. Each option shows its cost, and Max’s choice is drafted in the message box.',
    next: 'Finish the 6 planned →',
    before: async (c) => {
      for (let k = 0; k < 3; k++) { c.click('eng-step'); await c.sleep(250); }
      await c.waitFor('eng-decide');
    },
  },
  {
    persona: 'Engineer', targets: ['eng-receipt'], title: 'A receipt, not a surprise',
    body: 'The run ends with a receipt: what was quoted, what was spent, what the self-corrections saved, and why the numbers differ. It lands in the same store the VP and the CFO read from.',
    before: async (c) => { c.click('eng-send-decision'); await c.waitFor('eng-receipt'); },
  },
  {
    persona: 'VP Engineering', targets: ['vp-tiles'], title: 'Where the quarter is heading',
    body: 'The forecast for this quarter against plan comes first, then how much work started under an approved quote, how much spend stayed inside one, and how often quotes were right. Green means on track.',
  },
  {
    persona: 'VP Engineering', targets: ['vp-budget'], title: 'Budget by team and initiative',
    body: 'Budget against actual for each team, with its engineering manager, and each initiative under it. The VP can see where spend is running hot without reading a bill.',
  },
  {
    persona: 'VP Engineering', targets: ['vp-offplan'], title: 'Exceptions, not everything',
    body: 'Of every run this quarter, only the handful that went off plan are listed, each with what was done about it, including Max’s choice on T-149.',
  },
  {
    persona: 'CFO', targets: ['cfo-top', 'cfo-depts'], title: 'This quarter’s forecast, company-wide',
    body: 'The forecast for the quarter leads, across every department, with spend to date beside it. Each department’s dot shows its status against budget.',
    before: async (c) => { c.click('cfo-q4'); await c.sleep(100); c.click('cfo-dept-Engineering'); await c.waitFor('cfo-figures'); },
  },
  {
    persona: 'CFO', targets: ['cfo-figures'], title: 'Will Engineering land on budget?',
    body: 'The forecast against budget is the headline, because it is the number a CFO can still act on. Spend so far and how often past forecasts held back it up.',
  },
  {
    persona: 'CFO', targets: ['cfo-teams'], title: 'Why, in plain language',
    body: 'Each team gets a one-line explanation. Platform’s line already reflects Max’s decision a moment ago: all three views share one set of numbers.',
  },
  {
    persona: 'CFO', targets: ['cfo-foot'], title: 'Cost per outcome, not value',
    body: 'The table above shows what each capability cost against its budget. This is what work cost against what was approved, not what it was worth.',
  },
];
