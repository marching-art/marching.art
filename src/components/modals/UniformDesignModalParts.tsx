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
    <h3 className="text-[10px] font-bold text-muted uppercase tracking-wider border-b border-line pb-1 flex items-center gap-2">
      <User className="w-3 h-3" />
      Profile Avatar Style
    </h3>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Avatar Style */}
      <div>
        <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-2">
          Avatar Type
        </label>
        <div className="space-y-2">
          {AVATAR_STYLES.map((style) => (
            <label
              key={style.value}
              className={`flex items-center gap-3 p-2 border cursor-pointer transition-all ${
                formData.avatarStyle === style.value
                  ? 'bg-interactive/10 border-interactive/50'
                  : 'bg-background border-line hover:border-line-strong'
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
                className="w-4 h-4 accent-interactive"
              />
              <div>
                <div className="text-sm text-white font-bold">{style.label}</div>
                <div className="text-[10px] text-muted">{style.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Section Selection - Only show for performer style */}
      {formData.avatarStyle === 'performer' && (
        <div>
          <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-2">
            Featured Section
          </label>
          <div className="space-y-2">
            {AVATAR_SECTIONS.map((section) => (
              <label
                key={section.value}
                className={`flex items-center gap-3 p-2 border cursor-pointer transition-all ${
                  formData.avatarSection === section.value
                    ? 'bg-interactive/10 border-interactive/50'
                    : 'bg-background border-line hover:border-line-strong'
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
                  className="w-4 h-4 accent-interactive"
                />
                <div>
                  <div className="text-sm text-white font-bold">{section.label}</div>
                  <div className="text-[10px] text-muted">{section.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>

    <p className="text-[10px] text-muted">
      Your avatar will be automatically generated when you save. Change the style or section to
      generate a new avatar.
    </p>
  </div>
);
