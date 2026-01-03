// TeamSwitcher - Horizontal pill navigation for switching between corps
import React from 'react';
import { TeamAvatar } from '../ui/TeamAvatar';
import { compareCorpsClasses } from '../../utils/corps';

const TeamSwitcher = React.memo(({
  corps,
  activeCorpsClass,
  onSwitch,
  haptic
}) => {
  if (!corps || Object.keys(corps).length <= 1) {
    return null;
  }

  const sortedEntries = Object.entries(corps).sort(
    (a, b) => compareCorpsClasses(a[0], b[0])
  );

  return (
    <div className="bg-[#0a0a0a] border-b border-[#333] px-3 py-2 overflow-x-auto scrollbar-hide">
      <div className="flex items-center gap-2 min-w-max">
        {sortedEntries.map(([classId, corpsData]) => {
          const isActive = activeCorpsClass === classId;
          const fullName = corpsData.corpsName || corpsData.name || 'Team';
          const displayName = fullName.length > 20
            ? fullName.substring(0, 18) + '…'
            : fullName;

          return (
            <button
              key={classId}
              onClick={() => { haptic?.('light'); onSwitch(classId); }}
              className={`
                flex items-center gap-2 px-3 py-2 min-h-[40px] rounded-full
                text-sm font-bold whitespace-nowrap transition-all duration-200 press-feedback
                ${isActive
                  ? 'bg-gradient-to-r from-yellow-500 to-yellow-400 text-black'
                  : 'bg-[#2a2a2a] text-gray-400 hover:bg-[#333] hover:text-gray-200 active:bg-[#3a3a3a]'
                }
              `}
              title={fullName}
            >
              <TeamAvatar
                name={fullName}
                size="xs"
                className={isActive ? '!bg-black/20 !border-black/30 !text-black' : ''}
              />
              <span>{displayName}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
});

TeamSwitcher.displayName = 'TeamSwitcher';

export default TeamSwitcher;
