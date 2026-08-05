// Season reward ladder tier table — re-exported from utils/seasonLadder so the
// panels here and the Next Action resolver read one table. The data and the
// claim-eligibility rules live in src/utils/seasonLadder.ts; this file stays
// only so SeasonLadderPanel exports components alone
// (react-refresh/only-export-components).

export { TIERS, getSeasonXP, getClaimableLadderTiers } from '../../../utils/seasonLadder';
