// The overlays only a signed-in director can ever see — the username prompt,
// the achievement / XP / level-up celebrations. Grouped here so App.jsx can
// lazy-load them behind `user &&` and a signed-out visitor on `/`, an article
// or the guide never downloads them (site review F-M2).

import React from 'react';
import UsernamePromptModal from '../modals/UsernamePromptModal';
import { CelebrationContainer } from '../Celebration';
import { XPFeedbackContainer } from '../XPFeedback';
import { LevelUpCelebrationContainer } from '../LevelUpCelebration';

const AuthedOverlays = () => (
  <>
    {/* Username Prompt Modal - shows for existing users without username */}
    <UsernamePromptModal />

    {/* Celebration System - for achievements and level ups */}
    <CelebrationContainer />

    {/* XP/CC Floating Feedback - for gains throughout the app */}
    <XPFeedbackContainer />

    {/* Level Up Celebration - full-screen animation on level up */}
    <LevelUpCelebrationContainer />
  </>
);

export default AuthedOverlays;
