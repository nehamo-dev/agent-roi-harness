// Seeded owner's notes (synthetic) for over-budget capabilities. Business language: cause, decision, whether it recurs.
// A capability absent here has no explanation from engineering yet. The paused capability's note comes from
// the leader's decision (see pausedScenario.ts).
import type { OwnerNote } from '../core/types';

export const OWNER_NOTES: Record<string, OwnerNote> = {
  'Refund status API': {
    text: 'A broken payment-provider test environment made the coding agents repeat the same failing checks for several days. We fixed the environment and added a hard stop on repeated failures, so we do not expect this again.',
    recurs: 'no',
  },
  'SCIM user provisioning': {
    text: 'Three enterprise prospects needed directory integrations we had not planned for, adding about a third more work. We approved the extra scope because it unblocks those deals, and the same demand will continue next quarter.',
    recurs: 'yes',
  },
};
