// =============================================================================
// UNIFORM DESIGN MODAL PARTS - Extracted sub-components for UniformDesignModal
// =============================================================================

import React from 'react';
import { User } from 'lucide-react';
import type { CorpsUniformDesign } from '../../types';
import { AVATAR_STYLES, AVATAR_SECTIONS } from './uniformDesignOptions';

interface AvatarStyleSectionProps {
  formData: CorpsUniformDesign;
  setFormData: React.Dispatch<React.SetStateAction<CorpsUniformDesign>>;
}

export const AvatarStyleSection: React.FC<AvatarStyleSectionProps> = ({
  formData,
  setFormData,
}) => (
  <div className="space-y-4">
    <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-[#333] pb-1 flex items-center gap-2">
      <User className="w-3 h-3" />
      Profile Avatar Style
    </h3>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Avatar Style */}
      <div>
        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
          Avatar Type
        </label>
        <div className="space-y-2">
          {AVATAR_STYLES.map((style) => (
            <label
              key={style.value}
              className={`flex items-center gap-3 p-2 border cursor-pointer transition-all ${
                formData.avatarStyle === style.value
                  ? 'bg-[#0057B8]/10 border-[#0057B8]/50'
                  : 'bg-[#0a0a0a] border-[#333] hover:border-[#444]'
              }`}
            >
              <input
                type="radio"
                name="avatarStyle"
                value={style.value}
                checked={formData.avatarStyle === style.value}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    avatarStyle: e.target.value as 'logo' | 'performer',
                  })
                }
                className="w-4 h-4 accent-[#0057B8]"
              />
              <div>
                <div className="text-sm text-white font-bold">{style.label}</div>
                <div className="text-[10px] text-gray-500">{style.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Section Selection - Only show for performer style */}
      {formData.avatarStyle === 'performer' && (
        <div>
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
            Featured Section
          </label>
          <div className="space-y-2">
            {AVATAR_SECTIONS.map((section) => (
              <label
                key={section.value}
                className={`flex items-center gap-3 p-2 border cursor-pointer transition-all ${
                  formData.avatarSection === section.value
                    ? 'bg-[#0057B8]/10 border-[#0057B8]/50'
                    : 'bg-[#0a0a0a] border-[#333] hover:border-[#444]'
                }`}
              >
                <input
                  type="radio"
                  name="avatarSection"
                  value={section.value}
                  checked={formData.avatarSection === section.value}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      avatarSection: e.target.value as
                        'drumMajor' | 'hornline' | 'drumline' | 'colorGuard',
                    })
                  }
                  className="w-4 h-4 accent-[#0057B8]"
                />
                <div>
                  <div className="text-sm text-white font-bold">{section.label}</div>
                  <div className="text-[10px] text-gray-500">{section.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>

    <p className="text-[10px] text-gray-500">
      Your avatar will be automatically generated when you save. Change the style or section to
      generate a new avatar.
    </p>
  </div>
);
