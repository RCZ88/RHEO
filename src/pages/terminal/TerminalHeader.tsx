import { React } from 'react';
import { WS_ICON_BTN, ACCENT_STRIP, accentStyle } from './TerminalGrid';

// TerminalHeader re-exports sub-components for use in TerminalPage
// The header and tab bar are composed from ToolbarButton, StatusDot, CategoryBadge, etc.
export { StatusDot, Toggle, Pill, Badge, ToolbarButton } from './TerminalToolbar';
export { CategoryBadge } from './TerminalGrid';
export { ModelSwitcher, ConfigGenerator } from './TerminalConfig';
export { SessionResourceStats } from './TerminalSession';
export { Modal, SectionCard, TabPanel } from './TerminalModal';
