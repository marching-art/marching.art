// Presentation constants for the Hall of Champions, outside the component
// files so those only export components (react-refresh/only-export-components).

/** Rank framing for the finalists table (1st/2nd/3rd). */
export const RANK_META = {
  1: {
    label: 'CHAMPION',
    badge: 'bg-yellow-500 text-black',
    accent: 'text-yellow-500',
    border: 'border-yellow-500/60',
    medalColor: 'text-yellow-500',
  },
  2: {
    label: 'RUNNER-UP',
    badge: 'bg-gray-300 text-black',
    accent: 'text-gray-300',
    border: 'border-gray-400/40',
    medalColor: 'text-gray-300',
  },
  3: {
    label: 'THIRD',
    badge: 'bg-orange-400 text-black',
    accent: 'text-orange-400',
    border: 'border-orange-500/40',
    medalColor: 'text-orange-400',
  },
};
