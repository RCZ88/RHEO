// R-10 · Logo slot — wordmark-only per R-11.
// <Logo/> is a drop-in slot; a mark can be swapped in later without refactor.
import React from 'react';

export const Logo: React.FC = () => (
  <div className="splash-logo" aria-hidden="true">
    <span className="splash-wordmark">RHEO</span>
    <span className="splash-caption">Productivity Tracker</span>
  </div>
);
