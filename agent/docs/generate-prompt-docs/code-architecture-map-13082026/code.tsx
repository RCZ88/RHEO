import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Filter, ChevronRight, ChevronDown, Layers, GitBranch, FileCode, Box, Cpu, Database } from 'lucide-react';
import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';

cytoscape.use(dagre);

// Type definitions
export interface ArchNode {
    id: string;
    label: string;
    type: 'app' | 'page' | 'feature' | 'component' | 'file';
    route?: string;
    description?: string;
    icon?: string;
    accent?: string;
    children: ArchNode[];
    fileCount?: number;
    crossRefs?: string[];
}

// Static architecture data based on actual codebase
const ARCHITECTURE_DATA: ArchNode = {
    id: 'app',
    label: 'DeskFlow App',
    type: 'app',
    description: 'Productivity and life management application',
    accent: '#06b6d4',
    children: [
        {
            id: 'dashboard',
            label: 'Dashboard',
            type: 'page',
            route: '/',
            description: 'Main dashboard with overview of all features',
            accent: '#06b6d4',
            fileCount: 17,
            children: [
                {
                    id: 'dashboard-status',
                    label: 'Status Band',
                    type: 'feature',
                    description: 'Shows current status and quick actions',
                    accent: '#06b6d4',
                    children: [
                        {
                            id: 'status-band',
                            label: 'StatusBand',
                            type: 'component',
                            description: 'Status band component with notifications',
                            accent: '#10b981',
                            children: [
                                { id: 'status-band-tsx', label: 'StatusBand.tsx', type: 'file', description: 'Main status band implementation', accent: '#6b7280', children: [] }
                            ]
                        }
                    ]
                },
                {
                    id: 'dashboard-momentum',
                    label: 'Momentum Hero',
                    type: 'feature',
                    description: 'Hero section showing momentum metrics',
                    accent: '#06b6d4',
                    children: [
                        {
                            id: 'momentum-hero',
                            label: 'MomentumHero',
                            type: 'component',
                            description: 'Momentum hero component with animations',
                            accent: '#10b981',
                            children: [
                                { id: 'momentum-hero-tsx', label: 'MomentumHero.tsx', type: 'file', description: 'Momentum hero implementation', accent: '#6b7280', children: [] }
                            ]
                        }
                    ]
                },
                {
                    id: 'dashboard-tier',
                    label: 'Tier Breakdown',
                    type: 'feature',
                    description: 'Shows tier breakdown and statistics',
                    accent: '#06b6d4',
                    children: [
                        {
                            id: 'tier-breakdown',
                            label: 'TierBreakdownStrip',
                            type: 'component',
                            description: 'Tier breakdown strip visualization',
                            accent: '#10b981',
                            children: [
                                { id: 'tier-breakdown-tsx', label: 'TierBreakdownStrip.tsx', type: 'file', description: 'Tier breakdown strip', accent: '#6b7280', children: [] }
                            ]
                        }
                    ]
                },
                {
                    id: 'dashboard-goals',
                    label: 'Goals',
                    type: 'feature',
                    description: 'Goals tracking and focus management',
                    accent: '#06b6d4',
                    children: [
                        {
                            id: 'goals-card',
                            label: 'GoalsCard',
                            type: 'component',
                            description: 'Goals card component with progress tracking',
                            accent: '#10b981',
                            children: [
                                { id: 'goals-card-tsx', label: 'GoalsCard.tsx', type: 'file', description: 'Goals card implementation', accent: '#6b7280', children: [] }
                            ]
                        },
                        {
                            id: 'use-focus-goals',
                            label: 'useFocusGoals',
                            type: 'component',
                            description: 'Custom hook for focus goals management',
                            accent: '#f59e0b',
                            children: [
                                { id: 'use-focus-goals-tsx', label: 'useFocusGoals.ts', type: 'file', description: 'Focus goals hook', accent: '#6b7280', children: [] }
                            ]
                        }
                    ]
                },
                {
                    id: 'dashboard-quick-focus',
                    label: 'Quick Focus',
                    type: 'feature',
                    description: 'Quick focus session launcher',
                    accent: '#06b6d4',
                    children: [
                        {
                            id: 'quick-focus-card',
                            label: 'QuickFocusCard',
                            type: 'component',
                            description: 'Quick focus card component',
                            accent: '#10b981',
                            children: [
                                { id: 'quick-focus-card-tsx', label: 'QuickFocusCard.tsx', type: 'file', description: 'Quick focus card', accent: '#6b7280', children: [] }
                            ]
                        }
                    ]
                },
                {
                    id: 'dashboard-deadlines',
                    label: 'Deadlines',
                    type: 'feature',
                    description: 'Deadline tracking and reminders',
                    accent: '#06b6d4',
                    children: [
                        {
                            id: 'deadlines-card',
                            label: 'DeadlinesCard',
                            type: 'component',
                            description: 'Deadlines card with upcoming deadlines',
                            accent: '#10b981',
                            children: [
                                { id: 'deadlines-card-tsx', label: 'DeadlinesCard.tsx', type: 'file', description: 'Deadlines card', accent: '#6b7280', children: [] }
                            ]
                        }
                    ]
                },
                {
                    id: 'dashboard-schedule',
                    label: 'Schedule',
                    type: 'feature',
                    description: 'Schedule and calendar view',
                    accent: '#06b6d4',
                    children: [
                        {
                            id: 'schedule-card',
                            label: 'ScheduleCard',
                            type: 'component',
                            description: 'Schedule card component',
                            accent: '#10b981',
                            children: [
                                { id: 'schedule-card-tsx', label: 'ScheduleCard.tsx', type: 'file', description: 'Schedule card', accent: '#6b7280', children: [] }
                            ]
                        }
                    ]
                },
                {
                    id: 'dashboard-heatmap',
                    label: 'Heatmap',
                    type: 'feature',
                    description: 'Activity heatmap visualization',
                    accent: '#06b6d4',
                    children: [
                        {
                            id: 'day-detail-popup',
                            label: 'DayDetailPopup',
                            type: 'component',
                            description: 'Day detail popup for heatmap',
                            accent: '#10b981',
                            children: [
                                { id: 'day-detail-popup-tsx', label: 'DayDetailPopup.tsx', type: 'file', description: 'Day detail popup', accent: '#6b7280', children: [] }
                            ]
                        }
                    ]
                },
                {
                    id: 'dashboard-solar',
                    label: 'Solar System',
                    type: 'feature',
                    description: 'Solar system visualization',
                    accent: '#06b6d4',
                    children: [
                        {
                            id: 'orbit-system',
                            label: 'OrbitSystem',
                            type: 'component',
                            description: 'Orbit system visualization',
                            accent: '#10b981',
                            children: [
                                { id: 'orbit-system-tsx', label: 'OrbitSystem.tsx', type: 'file', description: 'Orbit system', accent: '#6b7280', children: [] }
                            ]
                        }
                    ]
                },
                {
                    id: 'dashboard-recent',
                    label: 'Recent Sessions',
                    type: 'feature',
                    description: 'Recent sessions list',
                    accent: '#06b6d4',
                    children: [
                        {
                            id: 'recent-sessions',
                            label: 'RecentSessions',
                            type: 'component',
                            description: 'Recent sessions inline component',
                            accent: '#10b981',
                            children: [
                                { id: 'dashboard-page-tsx', label: 'DashboardPage.tsx (inline)', type: 'file', description: 'Inline in DashboardPage', accent: '#6b7280', children: [] }
                            ]
                        }
                    ]
                }
            ]
        },
        {
            id: 'terminal',
            label: 'Terminal Workspace',
            type: 'page',
            route: '/terminal',
            description: 'Terminal workspace with session management',
            accent: '#8b5cf6',
            fileCount: 30,
            children: [
                {
                    id: 'terminal-sessions',
                    label: 'Session Management',
                    type: 'feature',
                    description: 'Manage terminal sessions',
                    accent: '#8b5cf6',
                    children: [
                        {
                            id: 'new-session-dialog',
                            label: 'NewSessionDialog',
                            type: 'component',
                            description: 'Dialog for creating new sessions',
                            accent: '#10b981',
                            children: [
                                { id: 'new-session-dialog-tsx', label: 'NewSessionDialog.tsx', type: 'file', description: 'New session dialog', accent: '#6b7280', children: [] }
                            ]
                        },
                        {
                            id: 'session-edit-dialog',
                            label: 'SessionEditDialog',
                            type: 'component',
                            description: 'Dialog for editing sessions',
                            accent: '#10b981',
                            children: [
                                { id: 'session-edit-dialog-tsx', label: 'SessionEditDialog.tsx', type: 'file', description: 'Session edit dialog', accent: '#6b7280', children: [] }
                            ]
                        },
                        {
                            id: 'import-sessions-dialog',
                            label: 'ImportSessionsDialog',
                            type: 'component',
                            description: 'Dialog for importing sessions',
                            accent: '#10b981',
                            children: [
                                { id: 'import-sessions-dialog-tsx', label: 'ImportSessionsDialog.tsx', type: 'file', description: 'Import sessions dialog', accent: '#6b7280', children: [] }
                            ]
                        }
                    ]
                },
                {
                    id: 'terminal-panes',
                    label: 'Terminal Panes',
                    type: 'feature',
                    description: 'Terminal window and panes',
                    accent: '#8b5cf6',
                    children: [
                        {
                            id: 'terminal-window',
                            label: 'TerminalWindow',
                            type: 'component',
                            description: 'Terminal window component',
                            accent: '#10b981',
                            children: [
                                { id: 'terminal-window-tsx', label: 'TerminalWindow.tsx', type: 'file', description: 'Terminal window', accent: '#6b7280', children: [] }
                            ]
                        },
                        {
                            id: 'terminal-minimap',
                            label: 'TerminalMiniMap',
                            type: 'component',
                            description: 'Terminal minimap',
                            accent: '#10b981',
                            children: [
                                { id: 'terminal-minimap-tsx', label: 'TerminalMiniMap.tsx', type: 'file', description: 'Terminal minimap', accent: '#6b7280', children: [] }
                            ]
                        },
                        {
                            id: 'map-editor',
                            label: 'MapEditor',
                            type: 'component',
                            description: 'Map editor component',
                            accent: '#10b981',
                            children: [
                                { id: 'map-editor-tsx', label: 'MapEditor.tsx', type: 'file', description: 'Map editor', accent: '#6b7280', children: [] }
                            ]
                        }
                    ]
                },
                {
                    id: 'terminal-shell',
                    label: 'Workspace Shell',
                    type: 'feature',
                    description: 'Workspace shell and navigation',
                    accent: '#8b5cf6',
                    children: [
                        {
                            id: 'workspace-shell',
                            label: 'WorkspaceShell',
                            type: 'component',
                            description: 'Workspace shell component',
                            accent: '#10b981',
                            children: [
                                { id: 'workspace-shell-tsx', label: 'WorkspaceShell.tsx', type: 'file', description: 'Workspace shell', accent: '#6b7280', children: [] }
                            ]
                        },
                        {
                            id: 'workspace-group-rail',
                            label: 'WorkspaceGroupRail',
                            type: 'component',
                            description: 'Workspace group rail',
                            accent: '#10b981',
                            children: [
                                { id: 'workspace-group-rail-tsx', label: 'WorkspaceGroupRail.tsx', type: 'file', description: 'Workspace group rail', accent: '#6b7280', children: [] }
                            ]
                        },
                        {
                            id: 'sub-tab-bar',
                            label: 'SubTabBar',
                            type: 'component',
                            description: 'Sub tab bar',
                            accent: '#10b981',
                            children: [
                                { id: 'sub-tab-bar-tsx', label: 'SubTabBar.tsx', type: 'file', description: 'Sub tab bar', accent: '#6b7280', children: [] }
                            ]
                        }
                    ]
                },
                {
                    id: 'terminal-presets',
                    label: 'Presets',
                    type: 'feature',
                    description: 'Terminal presets management',
                    accent: '#8b5cf6',
                    children: [
                        {
                            id: 'presets-tab',
                            label: 'PresetsTab',
                            type: 'component',
                            description: 'Presets tab component',
                            accent: '#10b981',
                            children: [
                                { id: 'presets-tab-tsx', label: 'PresetsTab.tsx', type: 'file', description: 'Presets tab', accent: '#6b7280', children: [] }
                            ]
                        }
                    ]
                },
                {
                    id: 'terminal-configs',
                    label: 'Configs',
                    type: 'feature',
                    description: 'Terminal configurations',
                    accent: '#8b5cf6',
                    children: [
                        {
                            id: 'configs-tab',
                            label: 'ConfigsTab',
                            type: 'component',
                            description: 'Configs tab component',
                            accent: '#10b981',
                            children: [
                                { id: 'configs-tab-tsx', label: 'ConfigsTab.tsx', type: 'file', description: 'Configs tab', accent: '#6b7280', children: [] }
                            ]
                        }
                    ]
                },
                {
                    id: 'terminal-fortress',
                    label: 'Fortress',
                    type: 'feature',
                    description: 'Fortress protocol setup',
                    accent: '#8b5cf6',
                    children: [
                        {
                            id: 'fortress-setup',
                            label: 'FortressProtocolSetup',
                            type: 'component',
                            description: 'Fortress protocol setup',
                            accent: '#10b981',
                            children: [
                                { id: 'fortress-setup-tsx', label: 'FortressProtocolSetup.tsx', type: 'file', description: 'Fortress setup', accent: '#6b7280', children: [] }
                            ]
                        }
                    ]
                },
                {
                    id: 'terminal-analytics',
                    label: 'Analytics',
                    type: 'feature',
                    description: 'Terminal analytics dashboard',
                    accent: '#8b5cf6',
                    children: [
                        {
                            id: 'analytics-dashboard',
                            label: 'AnalyticsDashboard',
                            type: 'component',
                            description: 'Analytics dashboard',
                            accent: '#10b981',
                            children: [
                                { id: 'analytics-dashboard-tsx', label: 'AnalyticsDashboard.tsx', type: 'file', description: 'Analytics dashboard', accent: '#6b7280', children: [] }
                            ]
                        }
                    ]
                },
                {
                    id: 'terminal-code-stats',
                    label: 'Code Stats',
                    type: 'feature',
                    description: 'Code statistics and metrics',
                    accent: '#8b5cf6',
                    children: [
                        {
                            id: 'code-stats-tab',
                            label: 'CodeStatsTab',
                            type: 'component',
                            description: 'Code stats tab',
                            accent: '#10b981',
                            children: [
                                { id: 'code-stats-tab-tsx', label: 'CodeStatsTab.tsx', type: 'file', description: 'Code stats tab', accent: '#6b7280', children: [] }
                            ]
                        }
                    ]
                },
                {
                    id: 'terminal-issues',
                    label: 'Issues',
                    type: 'feature',
                    description: 'Issues and problems tracking',
                    accent: '#8b5cf6',
                    children: [
                        {
                            id: 'issues-workspace',
                            label: 'IssuesWorkspace',
                            type: 'component',
                            description: 'Issues workspace',
                            accent: '#10b981',
                            children: [
                                { id: 'issues-workspace-tsx', label: 'IssuesWorkspace.tsx', type: 'file', description: 'Issues workspace', accent: '#6b7280', children: [] }
                            ]
                        },
                        {
                            id: 'problems-tab',
                            label: 'ProblemsTab',
                            type: 'component',
                            description: 'Problems tab',
                            accent: '#10b981',
                            children: [
                                { id: 'problems-tab-tsx', label: 'ProblemsTab.tsx', type: 'file', description: 'Problems tab', accent: '#6b7280', children: [] }
                            ]
                        }
                    ]
                },
                {
                    id: 'terminal-skills',
                    label: 'Skills',
                    type: 'feature',
                    description: 'Skills management',
                    accent: '#8b5cf6',
                    children: [
                        {
                            id: 'skills-tab',
                            label: 'SkillsTab',
                            type: 'component',
                            description: 'Skills tab',
                            accent: '#10b981',
                            children: [
                                { id: 'skills-tab-tsx', label: 'SkillsTab.tsx', type: 'file', description: 'Skills tab', accent: '#6b7280', children: [] }
                            ]
                        }
                    ]
                },
                {
                    id: 'terminal-design',
                    label: 'Design',
                    type: 'feature',
                    description: 'Design workspace',
                    accent: '#8b5cf6',
                    children: [
                        {
                            id: 'design-workspace',
                            label: 'DesignWorkspacePage',
                            type: 'component',
                            description: 'Design workspace page',
                            accent: '#10b981',
                            children: [
                                { id: 'design-workspace-tsx', label: 'DesignWorkspacePage.tsx', type: 'file', description: 'Design workspace', accent: '#6b7280', children: [] }
                            ]
                        }
                    ]
                },
                {
                    id: 'terminal-architecture',
                    label: 'Architecture Map',
                    type: 'feature',
                    description: 'Code architecture visualization',
                    accent: '#8b5cf6',
                    children: [
                        {
                            id: 'code-architecture-map',
                            label: 'CodeArchitectureMap',
                            type: 'component',
                            description: 'Architecture map component',
                            accent: '#10b981',
                            children: [
                                { id: 'code-architecture-map-tsx', label: 'CodeArchitectureMap.tsx', type: 'file', description: 'Architecture map', accent: '#6b7280', children: [] }
                            ]
                        }
                    ]
                },
                {
                    id: 'terminal-context',
                    label: 'Context Sidebar',
                    type: 'feature',
                    description: 'Context sidebar with information',
                    accent: '#8b5cf6',
                    children: [
                        {
                            id: 'context-sidebar',
                            label: 'ContextSidebar',
                            type: 'component',
                            description: 'Context sidebar component',
                            accent: '#10b981',
                            children: [
                                { id: 'context-sidebar-tsx', label: 'ContextSidebar.tsx', type: 'file', description: 'Context sidebar', accent: '#6b7280', children: [] }
                            ]
                        }
                    ]
                }
            ]
        },
        {
            id: 'finance',
            label: 'Finance',
            type: 'page',
            route: '/finance',
            description: 'Financial management and tracking',
            accent: '#ec4899',
            fileCount: 55,
            children: [
                {
                    id: 'finance-lock',
                    label: 'Lock Screen',
                    type: 'feature',
                    description: 'Finance lock screen and authentication',
                    accent: '#ec4899',
                    children: [
                        {
                            id: 'finance-lock-screen',
                            label: 'FinanceLockScreen',
                            type: 'component',
                            description: 'Finance lock screen',
                            accent: '#10b981',
                            children: [
                                { id: 'finance-lock-screen-tsx', label: 'FinanceLockScreen.tsx', type: 'file', description: 'Lock screen', accent: '#6b7280', children: [] }
                            ]
                        },
                        {
                            id: 'password-confirm-dialog',
                            label: 'PasswordConfirmDialog',
                            type: 'component',
                            description: 'Password confirmation dialog',
                            accent: '#10b981',
                            children: [
                                { id: 'password-confirm-dialog-tsx', label: 'PasswordConfirmDialog.tsx', type: 'file', description: 'Password confirm', accent: '#6b7280', children: [] }
                            ]
                        }
                    ]
                },
                {
                    id: 'finance-overview',
                    label: 'Overview',
                    type: 'feature',
                    description: 'Financial overview and summary',
                    accent: '#ec4899',
                    children: [
                        {
                            id: 'overview-tab',
                            label: 'OverviewTab',
                            type: 'component',
                            description: 'Overview tab',
                            accent: '#10b981',
                            children: [
                                { id: 'overview-tab-tsx', label: 'OverviewTab.tsx', type: 'file', description: 'Overview tab', accent: '#6b7280', children: [] }
                            ]
                        },
                        {
                            id: 'net-worth-chart',
                            label: 'NetWorthLineChart',
                            type: 'component',
                            description: 'Net worth line chart',
                            accent: '#10b981',
                            children: [
                                { id: 'net-worth-chart-tsx', label: 'NetWorthLineChart.tsx', type: 'file', description: 'Net worth chart', accent: '#6b7280', children: [] }
                            ]
                        },
                        {
                            id: 'spending-chart',
                            label: 'SpendingCategoryChart',
                            type: 'component',
                            description: 'Spending category chart',
                            accent: '#10b981',
                            children: [
                                { id: 'spending-chart-tsx', label: 'SpendingCategoryChart.tsx', type: 'file', description: 'Spending chart', accent: '#6b7280', children: [] }
                            ]
                        },
                        {
                            id: 'recent-txns-card',
                            label: 'RecentTxnsCard',
                            type: 'component',
                            description: 'Recent transactions card',
                            accent: '#10b981',
                            children: [
                                { id: 'recent-txns-card-tsx', label: 'RecentTxnsCard.tsx', type: 'file', description: 'Recent transactions', accent: '#6b7280', children: [] }
                            ]
                        }
                    ]
                },
                {
                    id: 'finance-wallets',
                    label: 'Wallets',
                    type: 'feature',
                    description: 'Wallet management',
                    accent: '#ec4899',
                    children: [
                        {
                            id: 'wallets-tab',
                            label: 'WalletsTab',
                            type: 'component',
                            description: 'Wallets tab',
                            accent: '#10b981',
                            children: [
                                { id: 'wallets-tab-tsx', label: 'WalletsTab.tsx', type: 'file', description: 'Wallets tab', accent: '#6b7280', children: [] }
                            ]
                        },
                        {
                            id: 'wallet-detail-view',
                            label: 'WalletDetailView',
                            type: 'component',
                            description: 'Wallet detail view',
                            accent: '#10b981',
                            children: [
                                { id: 'wallet-detail-view-tsx', label: 'WalletDetailView.tsx', type: 'file', description: 'Wallet detail', accent: '#6b7280', children: [] }
                            ]
                        }
                    ]
                },
                {
                    id: 'finance-transactions',
                    label: 'Transactions',
                    type: 'feature',
                    description: 'Transaction management with 8 modals',
                    accent: '#ec4899',
                    children: [
                        {
                            id: 'transactions-tab',
                            label: 'TransactionsTab',
                            type: 'component',
                            description: 'Transactions tab',
                            accent: '#10b981',
                            children: [
                                { id: 'transactions-tab-tsx', label: 'TransactionsTab.tsx', type: 'file', description: 'Transactions tab', accent: '#6b7280', children: [] }
                            ]
                        },
                        {
                            id: 'bank-modal',
                            label: 'BankModal',
                            type: 'component',
                            description: 'Bank transaction modal',
                            accent: '#10b981',
                            children: [
                                { id: 'bank-modal-tsx', label: 'BankModal.tsx', type: 'file', description: 'Bank modal', accent: '#6b7280', children: [] }
                            ]
                        },
                        {
                            id: 'debit-modal',
                            label: 'DebitModal',
                            type: 'component',
                            description: 'Debit transaction modal',
                            accent: '#10b981',
                            children: [
                                { id: 'debit-modal-tsx', label: 'DebitModal.tsx', type: 'file', description: 'Debit modal', accent: '#6b7280', children: [] }
                            ]
                        },
                        {
                            id: 'credit-modal',
                            label: 'CreditModal',
                            type: 'component',
                            description: 'Credit transaction modal',
                            accent: '#10b981',
                            children: [
                                { id: 'credit-modal-tsx', label: 'CreditModal.tsx', type: 'file', description: 'Credit modal', accent: '#6b7280', children: [] }
                            ]
                        },
                        {
                            id: 'crypto-modal',
                            label: 'CryptoModal',
                            type: 'component',
                            description: 'Crypto transaction modal',
                            accent: '#10b981',
                            children: [
                                { id: 'crypto-modal-tsx', label: 'CryptoModal.tsx', type: 'file', description: 'Crypto modal', accent: '#6b7280', children: [] }
                            ]
                        },
                        {
                            id: 'physical-modal',
                            label: 'PhysicalModal',
                            type: 'component',
                            description: 'Physical cash modal',
                            accent: '#10b981',
                            children: [
                                { id: 'physical-modal-tsx', label: 'PhysicalModal.tsx', type: 'file', description: 'Physical modal', accent: '#6b7280', children: [] }
                            ]
                        },
                        {
                            id: 'cash-modal',
                            label: 'CashModal',
                            type: 'component',
                            description: 'Cash transaction modal',
                            accent: '#10b981',
                            children: [
                                { id: 'cash-modal-tsx', label: 'CashModal.tsx', type: 'file', description: 'Cash modal', accent: '#6b7280', children: [] }
                            ]
                        },
                        {
                            id: 'ewallet-modal',
                            label: 'EwalletModal',
                            type: 'component',
                            description: 'E-wallet modal',
                            accent: '#10b981',
                            children: [
                                { id: 'ewallet-modal-tsx', label: 'EwalletModal.tsx', type: 'file', description: 'E-wallet modal', accent: '#6b7280', children: [] }
                            ]
                        },
                        {
                            id: 'prepaid-modal',
                            label: 'PrepaidModal',
                            type: 'component',
                            description: 'Prepaid card modal',
                            accent: '#10b981',
                            children: [
                                { id: 'prepaid-modal-tsx', label: 'PrepaidModal.tsx', type: 'file', description: 'Prepaid modal', accent: '#6b7280', children: [] }
                            ]
                        }
                    ]
                },
                {
                    id: 'finance-people',
                    label: 'People',
                    type: 'feature',
                    description: 'People and contacts management',
                    accent: '#ec4899',
                    children: [
                        {
                            id: 'people-tab',
                            label: 'PeopleTab',
                            type: 'component',
                            description: 'People tab',
                            accent: '#10b981',
                            children: [
                                { id: 'people-tab-tsx', label: 'PeopleTab.tsx', type: 'file', description: 'People tab', accent: '#6b7280', children: [] }
                            ]
                        },
                        {
                            id: 'person-card',
                            label: 'PersonCard',
                            type: 'component',
                            description: 'Person card component',
                            accent: '#10b981',
                            children: [
                                { id: 'person-card-tsx', label: 'PersonCard.tsx', type: 'file', description: 'Person card', accent: '#6b7280', children: [] }
                            ]
                        },
                        {
                            id: 'person-detail-modal',
                            label: 'PersonDetailModal',
                            type: 'component',
                            description: 'Person detail modal',
                            accent: '#10b981',
                            children: [
                                { id: 'person-detail-modal-tsx', label: 'PersonDetailModal.tsx', type: 'file', description: 'Person detail', accent: '#6b7280', children: [] }
                            ]
                        }
                    ]
                },
                {
                    id: 'finance-categories',
                    label: 'Categories',
                    type: 'feature',
                    description: 'Transaction categories',
                    accent: '#ec4899',
                    children: [
                        {
                            id: 'categories-tab',
                            label: 'CategoriesTab',
                            type: 'component',
                            description: 'Categories tab',
                            accent: '#10b981',
                            children: [
                                { id: 'categories-tab-tsx', label: 'CategoriesTab.tsx', type: 'file', description: 'Categories tab', accent: '#6b7280', children: [] }
                            ]
                        }
                    ]
                },
                {
                    id: 'finance-budget',
                    label: 'Budget',
                    type: 'feature',
                    description: 'Budget management and tracking',
                    accent: '#ec4899',
                    children: [
                        {
                            id: 'budget-expenses-dashboard',
                            label: 'BudgetExpensesDashboard',
                            type: 'component',
                            description: 'Budget expenses dashboard',
                            accent: '#10b981',
                            children: [
                                { id: 'budget-expenses-dashboard-tsx', label: 'BudgetExpensesDashboard.tsx', type: 'file', description: 'Budget dashboard', accent: '#6b7280', children: [] }
                            ]
                        },
                        {
                            id: 'budget-tab',
                            label: 'BudgetTab',
                            type: 'component',
                            description: 'Budget tab',
                            accent: '#10b981',
                            children: [
                                { id: 'budget-tab-tsx', label: 'BudgetTab.tsx', type: 'file', description: 'Budget tab', accent: '#6b7280', children: [] }
                            ]
                        }
                    ]
                },
                {
                    id: 'finance-subscriptions',
                    label: 'Subscriptions',
                    type: 'feature',
                    description: 'Subscription tracking',
                    accent: '#ec4899',
                    children: [
                        {
                            id: 'subscriptions-tab',
                            label: 'SubscriptionsTab',
                            type: 'component',
                            description: 'Subscriptions tab',
                            accent: '#10b981',
                            children: [
                                { id: 'subscriptions-tab-tsx', label: 'SubscriptionsTab.tsx', type: 'file', description: 'Subscriptions tab', accent: '#6b7280', children: [] }
                            ]
                        },
                        {
                            id: 'subscription-modal',
                            label: 'SubscriptionModal',
                            type: 'component',
                            description: 'Subscription modal',
                            accent: '#10b981',
                            children: [
                                { id: 'subscription-modal-tsx', label: 'SubscriptionModal.tsx', type: 'file', description: 'Subscription modal', accent: '#6b7280', children: [] }
                            ]
                        }
                    ]
                },
                {
                    id: 'finance-charts',
                    label: 'Charts',
                    type: 'feature',
                    description: 'Financial charts and visualizations',
                    accent: '#ec4899',
                    children: [
                        {
                            id: 'finance-charts-tab',
                            label: 'FinanceChartsTab',
                            type: 'component',
                            description: 'Finance charts tab',
                            accent: '#10b981',
                            children: [
                                { id: 'finance-charts-tab-tsx', label: 'FinanceChartsTab.tsx', type: 'file', description: 'Charts tab', accent: '#6b7280', children: [] }
                            ]
                        }
                    ]
                },
                {
                    id: 'finance-recap',
                    label: 'Recap',
                    type: 'feature',
                    description: 'Financial recap and summary',
                    accent: '#ec4899',
                    children: [
                        {
                            id: 'recap-panel',
                            label: 'RecapPanel',
                            type: 'component',
                            description: 'Recap panel',
                            accent: '#10b981',
                            children: [
                                { id: 'recap-panel-tsx', label: 'RecapPanel.tsx', type: 'file', description: 'Recap panel', accent: '#6b7280', children: [] }
                            ]
                        }
                    ]
                }
            ]
        },
        {
            id: 'ai',
            label: 'AI Page',
            type: 'page',
            route: '/ai',
            description: 'AI-powered features and canvas',
            accent: '#3b82f6',
            fileCount: 85,
            children: [
                {
                    id: 'ai-chat',
                    label: 'Chat System',
                    type: 'feature',
                    description: 'AI chat interface',
                    accent: '#3b82f6',
                    children: [
                        {
                            id: 'chat-panel',
                            label: 'ChatPanel',
                            type: 'component',
                            description: 'Chat panel component',
                            accent: '#10b981',
                            children: [
                                { id: 'chat-panel-tsx', label: 'ChatPanel.tsx', type: 'file', description: 'Chat panel', accent: '#6b7280', children: [] }
                            ]
                        },
                        {
                            id: 'chat-input',
                            label: 'ChatInput',
                            type: 'component',
                            description: 'Chat input component',
                            accent: '#10b981',
                            children: [
                                { id: 'chat-input-tsx', label: 'ChatInput.tsx', type: 'file', description: 'Chat input', accent: '#6b7280', children: [] }
                            ]
                        },
                        {
                            id: 'chat-history',
                            label: 'ChatHistory',
                            type: 'component',
                            description: 'Chat history component',
                            accent: '#10b981',
                            children: [
                                { id: 'chat-history-tsx', label: 'ChatHistory.tsx', type: 'file', description: 'Chat history', accent: '#6b7280', children: [] }
                            ]
                        },
                        {
                            id: 'message-bubble',
                            label: 'MessageBubble',
                            type: 'component',
                            description: 'Message bubble component',
                            accent: '#10b981',
                            children: [
                                { id: 'message-bubble-tsx', label: 'MessageBubble.tsx', type: 'file', description: 'Message bubble', accent: '#6b7280', children: [] }
                            ]
                        },
                        {
                            id: 'use-ai-chat',
                            label: 'useAiChat',
                            type: 'component',
                            description: 'AI chat hook',
                            accent: '#f59e0b',
                            children: [
                                { id: 'use-ai-chat-tsx', label: 'useAiChat.ts', type: 'file', description: 'AI chat hook', accent: '#6b7280', children: [] }
                            ]
                        }
                    ]
                },
                {
                    id: 'ai-canvas',
                    label: 'Canvas Mode',
                    type: 'feature',
                    description: 'AI canvas with cards and grid',
                    accent: '#3b82f6',
                    children: [
                        {
                            id: 'canvas-container',
                            label: 'CanvasContainer',
                            type: 'component',
                            description: 'Canvas container component',
                            accent: '#10b981',
                            children: [
                                { id: 'canvas-container-tsx', label: 'CanvasContainer.tsx', type: 'file', description: 'Canvas container', accent: '#6b7280', children: [] }
                            ]
                        },
                        {
                            id: 'canvas-grid',
                            label: 'CanvasGrid',
                            type: 'component',
                            description: 'Canvas grid layout',
                            accent: '#10b981',
                            children: [
                                { id: 'canvas-grid-tsx', label: 'CanvasGrid.tsx', type: 'file', description: 'Canvas grid', accent: '#6b7280', children: [] }
                            ]
                        },
                        {
                            id: 'canvas-card',
                            label: 'CanvasCard',
                            type: 'component',
                            description: 'Canvas card component',
                            accent: '#10b981',
                            children: [
                                { id: 'canvas-card-tsx', label: 'CanvasCard.tsx', type: 'file', description: 'Canvas card', accent: '#6b7280', children: [] }
                            ]
                        }
                    ]
                },
                {
                    id: 'ai-deck',
                    label: 'Deck Mode',
                    type: 'feature',
                    description: 'AI deck mode with boards',
                    accent: '#3b82f6',
                    children: [
                        {
                            id: 'ai-page-deck',
                            label: 'AiPageDeck',
                            type: 'component',
                            description: 'AI page deck',
                            accent: '#10b981',
                            children: [
                                { id: 'ai-page-deck-tsx', label: 'AiPageDeck.tsx', type: 'file', description: 'AI deck', accent: '#6b7280', children: [] }
                            ]
                        },
                        {
                            id: 'focus-board',
                            label: 'FocusBoard',
                            type: 'component',
                            description: 'Focus board component',
                            accent: '#10b981',
                            children: [
                                { id: 'focus-board-tsx', label: 'FocusBoard.tsx', type: 'file', description: 'Focus board', accent: '#6b7280', children: [] }
                            ]
                        },
                        {
                            id: 'plan-board',
                            label: 'PlanBoard',
                            type: 'component',
                            description: 'Plan board component',
                            accent: '#10b981',
                            children: [
                                { id: 'plan-board-tsx', label: 'PlanBoard.tsx', type: 'file', description: 'Plan board', accent: '#6b7280', children: [] }
                            ]
                        },
                        {
                            id: 'reflect-feed',
                            label: 'ReflectFeed',
                            type: 'component',
                            description: 'Reflection feed',
                            accent: '#10b981',
                            children: [
                                { id: 'reflect-feed-tsx', label: 'ReflectFeed.tsx', type: 'file', description: 'Reflect feed', accent: '#6b7280', children: [] }
                            ]
                        }
                    ]
                },
                {
                    id: 'ai-compositions',
                    label: 'Compositions',
                    type: 'feature',
                    description: 'AI compositions and workflows',
                    accent: '#3b82f6',
                    children: [
                        {
                            id: 'composition-panel',
                            label: 'CompositionPanel',
                            type: 'component',
                            description: 'Composition panel',
                            accent: '#10b981',
                            children: [
                                { id: 'composition-panel-tsx', label: 'CompositionPanel.tsx', type: 'file', description: 'Composition panel', accent: '#6b7280', children: [] }
                            ]
                        },
                        {
                            id: 'composition-editor-modal',
                            label: 'CompositionEditorModal',
                            type: 'component',
                            description: 'Composition editor modal',
                            accent: '#10b981',
                            children: [
                                { id: 'composition-editor-modal-tsx', label: 'CompositionEditorModal.tsx', type: 'file', description: 'Composition editor', accent: '#6b7280', children: [] }
                            ]
                        }
                    ]
                },
                {
                    id: 'ai-connectors',
                    label: 'Connectors',
                    type: 'feature',
                    description: 'AI connectors and integrations',
                    accent: '#3b82f6',
                    children: [
                        {
                            id: 'connectors-panel',
                            label: 'ConnectorsPanel',
                            type: 'component',
                            description: 'Connectors panel',
                            accent: '#10b981',
                            children: [
                                { id: 'connectors-panel-tsx', label: 'ConnectorsPanel.tsx', type: 'file', description: 'Connectors panel', accent: '#6b7280', children: [] }
                            ]
                        },
                        {
                            id: 'connector-setup-modal',
                            label: 'ConnectorSetupModal',
                            type: 'component',
                            description: 'Connector setup modal',
                            accent: '#10b981',
                            children: [
                                { id: 'connector-setup-modal-tsx', label: 'ConnectorSetupModal.tsx', type: 'file', description: 'Connector setup', accent: '#6b7280', children: [] }
                            ]
                        }
                    ]
                },
                {
                    id: 'ai-automations',
                    label: 'Automations',
                    type: 'feature',
                    description: 'AI automations and workflows',
                    accent: '#3b82f6',
                    children: [
                        {
                            id: 'automation-list',
                            label: 'AutomationList',
                            type: 'component',
                            description: 'Automation list',
                            accent: '#10b981',
                            children: [
                                { id: 'automation-list-tsx', label: 'AutomationList.tsx', type: 'file', description: 'Automation list', accent: '#6b7280', children: [] }
                            ]
                        },
                        {
                            id: 'automation-card',
                            label: 'AutomationCard',
                            type: 'component',
                            description: 'Automation card',
                            accent: '#10b981',
                            children: [
                                { id: 'automation-card-tsx', label: 'AutomationCard.tsx', type: 'file', description: 'Automation card', accent: '#6b7280', children: [] }
                            ]
                        },
                        {
                            id: 'visual-builder-modal',
                            label: 'VisualBuilderModal',
                            type: 'component',
                            description: 'Visual builder modal',
                            accent: '#10b981',
                            children: [
                                { id: 'visual-builder-modal-tsx', label: 'VisualBuilderModal.tsx', type: 'file', description: 'Visual builder', accent: '#6b7280', children: [] }
                            ]
                        }
                    ]
                },
                {
                    id: 'ai-goals',
                    label: 'Goals',
                    type: 'feature',
                    description: 'AI-powered goals and reminders',
                    accent: '#3b82f6',
                    children: [
                        {
                            id: 'goals-reminders-drawer',
                            label: 'GoalsRemindersDrawer',
                            type: 'component',
                            description: 'Goals reminders drawer',
                            accent: '#10b981',
                            children: [
                                { id: 'goals-reminders-drawer-tsx', label: 'GoalsRemindersDrawer.tsx', type: 'file', description: 'Goals reminders', accent: '#6b7280', children: [] }
                            ]
                        }
                    ]
                }
            ]
        },
        {
            id: 'ide',
            label: 'IDE Projects',
            type: 'page',
            route: '/ide',
            description: 'IDE project management',
            accent: '#14b8a6',
            fileCount: 10,
            children: [
                {
                    id: 'ide-projects',
                    label: 'Project List',
                    type: 'feature',
                    description: 'List of IDE projects',
                    accent: '#14b8a6',
                    children: [
                        {
                            id: 'ide-projects-page',
                            label: 'IDEProjectsPage',
                            type: 'component',
                            description: 'IDE projects page',
                            accent: '#10b981',
                            children: [
                                { id: 'ide-projects-page-tsx', label: 'IDEProjectsPage.tsx', type: 'file', description: 'IDE projects page', accent: '#6b7280', children: [] }
                            ]
                        }
                    ]
                }
            ]
        },
        {
            id: 'settings',
            label: 'Settings',
            type: 'page',
            route: '/settings',
            description: 'Application settings',
            accent: '#f97316',
            fileCount: 8,
            children: [
                {
                    id: 'settings-page',
                    label: 'Settings Page',
                    type: 'feature',
                    description: 'Settings configuration',
                    accent: '#f97316',
                    children: [
                        {
                            id: 'settings-page-component',
                            label: 'SettingsPage',
                            type: 'component',
                            description: 'Settings page component',
                            accent: '#10b981',
                            children: [
                                { id: 'settings-page-tsx', label: 'SettingsPage.tsx', type: 'file', description: 'Settings page', accent: '#6b7280', children: [] }
                            ]
                        }
                    ]
                }
            ]
        },
        {
            id: 'external',
            label: 'External',
            type: 'page',
            route: '/external',
            description: 'External integrations',
            accent: '#84cc16',
            fileCount: 12,
            children: [
                {
                    id: 'external-page',
                    label: 'External Page',
                    type: 'feature',
                    description: 'External integrations page',
                    accent: '#84cc16',
                    children: [
                        {
                            id: 'external-page-component',
                            label: 'ExternalPage',
                            type: 'component',
                            description: 'External page component',
                            accent: '#10b981',
                            children: [
                                { id: 'external-page-tsx', label: 'ExternalPage.tsx', type: 'file', description: 'External page', accent: '#6b7280', children: [] }
                            ]
                        }
                    ]
                }
            ]
        },
        {
            id: 'life',
            label: 'Life',
            type: 'page',
            route: '/life',
            description: 'Life management features',
            accent: '#a855f7',
            fileCount: 15,
            children: [
                {
                    id: 'life-page',
                    label: 'Life Page',
                    type: 'feature',
                    description: 'Life management page',
                    accent: '#a855f7',
                    children: [
                        {
                            id: 'life-page-component',
                            label: 'LifePage',
                            type: 'component',
                            description: 'Life page component',
                            accent: '#10b981',
                            children: [
                                { id: 'life-page-tsx', label: 'LifePage.tsx', type: 'file', description: 'Life page', accent: '#6b7280', children: [] }
                            ]
                        }
                    ]
                }
            ]
        },
        {
            id: 'activity',
            label: 'Activity',
            type: 'page',
            route: '/activity',
            description: 'Activity tracking and history',
            accent: '#eab308',
            fileCount: 8,
            children: [
                {
                    id: 'activity-page',
                    label: 'Activity Page',
                    type: 'feature',
                    description: 'Activity tracking page',
                    accent: '#eab308',
                    children: [
                        {
                            id: 'activity-page-component',
                            label: 'ActivityPage',
                            type: 'component',
                            description: 'Activity page component',
                            accent: '#10b981',
                            children: [
                                { id: 'activity-page-tsx', label: 'ActivityPage.tsx', type: 'file', description: 'Activity page', accent: '#6b7280', children: [] }
                            ]
                        }
                    ]
                }
            ]
        },
        {
            id: 'learn',
            label: 'Learn',
            type: 'page',
            route: '/learn',
            description: 'Learning and education',
            accent: '#0ea5e9',
            fileCount: 20,
            children: [
                {
                    id: 'learn-page',
                    label: 'Learn Page',
                    type: 'feature',
                    description: 'Learning page',
                    accent: '#0ea5e9',
                    children: [
                        {
                            id: 'learn-page-component',
                            label: 'LearnPage',
                            type: 'component',
                            description: 'Learn page component',
                            accent: '#10b981',
                            children: [
                                { id: 'learn-page-tsx', label: 'LearnPage.tsx', type: 'file', description: 'Learn page', accent: '#6b7280', children: [] }
                            ]
                        }
                    ]
                }
            ]
        }
    ]
};

// Utility functions
const flattenNodes = (node: ArchNode): ArchNode[] => {
    const result = [node];
    if (node.children) {
        node.children.forEach(child => {
            result.push(...flattenNodes(child));
        });
    }
    return result;
};

const getTypeColor = (type: ArchNode['type']) => {
    const colors = {
        app: '#06b6d4',
        page: '#8b5cf6',
        feature: '#3b82f6',
        component: '#10b981',
        file: '#6b7280'
    };
    return colors[type] || '#6b7280';
};

const getTypeIcon = (type: ArchNode['type']) => {
    const icons = {
        app: Layers,
        page: GitBranch,
        feature: Box,
        component: Cpu,
        file: FileCode
    };
    return icons[type] || FileCode;
};

// Tree Node Component
interface TreeNodeProps {
    node: ArchNode;
    level: number;
    expanded: Set<string>;
    onToggle: (id: string) => void;
    onSelect: (node: ArchNode) => void;
    selected: string | null;
    searchTerm: string;
}

const TreeNode: React.FC<TreeNodeProps> = ({
    node,
    level,
    expanded,
    onToggle,
    onSelect,
    selected,
    searchTerm
}) => {
    const isExpanded = expanded.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = selected === node.id;
    const Icon = getTypeIcon(node.type);

    const matchesSearch = !searchTerm ||
        node.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        node.description?.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch && !isExpanded) return null;

    return (
        <div>
            <div
                className={`
          flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer
          transition-all duration-200
          ${isSelected ? 'bg-zinc-800 ring-1 ring-cyan-400/50' : 'hover:bg-zinc-800/50'}
        `}
                style={{ paddingLeft: `${level * 16 + 12}px` }}
                onClick={() => {
                    if (hasChildren) onToggle(node.id);
                    onSelect(node);
                }}
            >
                {hasChildren && (
                    <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
                        {isExpanded ? (
                            <ChevronDown className="w-3 h-3 text-zinc-400" />
                        ) : (
                            <ChevronRight className="w-3 h-3 text-zinc-400" />
                        )}
                    </div>
                )}
                {!hasChildren && <div className="w-4" />}

                <Icon
                    className="w-4 h-4 flex-shrink-0"
                    style={{ color: node.accent || getTypeColor(node.type) }}
                />

                <span className="text-sm text-zinc-200 truncate flex-1">
                    {node.label}
                </span>

                {node.fileCount && (
                    <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">
                        {node.fileCount}
                    </span>
                )}
            </div>

            {hasChildren && isExpanded && (
                <div className="mt-1">
                    {node.children.map(child => (
                        <TreeNode
                            key={child.id}
                            node={child}
                            level={level + 1}
                            expanded={expanded}
                            onToggle={onToggle}
                            onSelect={onSelect}
                            selected={selected}
                            searchTerm={searchTerm}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

// Detail Panel Component
interface DetailPanelProps {
    node: ArchNode | null;
    onClose: () => void;
}

const DetailPanel: React.FC<DetailPanelProps> = ({ node, onClose }) => {
    if (!node) return null;

    const Icon = getTypeIcon(node.type);
    const allNodes = flattenNodes(node);
    const fileCount = allNodes.filter(n => n.type === 'file').length;
    const componentCount = allNodes.filter(n => n.type === 'component').length;
    const featureCount = allNodes.filter(n => n.type === 'feature').length;

    return (
        <div className="absolute top-4 right-4 w-80 bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl z-50">
            <div className="p-4 border-b border-zinc-800">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Icon className="w-5 h-5" style={{ color: node.accent || getTypeColor(node.type) }} />
                        <h3 className="text-lg font-semibold text-zinc-100">{node.label}</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-zinc-400 hover:text-zinc-200 transition-colors"
                    >
                        ×
                    </button>
                </div>
                {node.description && (
                    <p className="text-sm text-zinc-400 mt-2">{node.description}</p>
                )}
            </div>

            <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                    <div className="bg-zinc-800/50 rounded px-3 py-2">
                        <div className="text-xs text-zinc-500">Type</div>
                        <div className="text-sm font-medium text-zinc-200 capitalize">{node.type}</div>
                    </div>
                    {node.route && (
                        <div className="bg-zinc-800/50 rounded px-3 py-2">
                            <div className="text-xs text-zinc-500">Route</div>
                            <div className="text-sm font-medium text-zinc-200">{node.route}</div>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                    <div className="bg-zinc-800/50 rounded px-3 py-2">
                        <div className="text-xs text-zinc-500">Features</div>
                        <div className="text-lg font-bold text-blue-400">{featureCount}</div>
                    </div>
                    <div className="bg-zinc-800/50 rounded px-3 py-2">
                        <div className="text-xs text-zinc-500">Components</div>
                        <div className="text-lg font-bold text-emerald-400">{componentCount}</div>
                    </div>
                    <div className="bg-zinc-800/50 rounded px-3 py-2">
                        <div className="text-xs text-zinc-500">Files</div>
                        <div className="text-lg font-bold text-zinc-400">{fileCount}</div>
                    </div>
                </div>

                {node.children && node.children.length > 0 && (
                    <div>
                        <div className="text-xs text-zinc-500 mb-2">Children</div>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                            {node.children.map(child => (
                                <div
                                    key={child.id}
                                    className="text-sm text-zinc-300 bg-zinc-800/50 rounded px-2 py-1"
                                >
                                    {child.label}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// Main Component
const CodeArchitectureMap: React.FC = () => {
    const [expanded, setExpanded] = useState<Set<string>>(new Set(['app']));
    const [selected, setSelected] = useState<string | null>(null);
    const [selectedNode, setSelectedNode] = useState<ArchNode | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<ArchNode['type'] | 'all'>('all');
    const cyRef = useRef<HTMLDivElement>(null);
    const cyInstance = useRef<cytoscape.Core | null>(null);

    const handleToggle = (id: string) => {
        setExpanded(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleSelect = (node: ArchNode) => {
        setSelected(node.id);
        setSelectedNode(node);

        // Center on node in graph
        if (cyInstance.current) {
            const element = cyInstance.current.getElementById(node.id);
            if (element.length > 0) {
                cyInstance.current.animate({
                    center: { eles: element },
                    zoom: 1.5
                }, {
                    duration: 300
                });
                element.select();
            }
        }
    };

    const handleCloseDetail = () => {
        setSelectedNode(null);
        setSelected(null);
        if (cyInstance.current) {
            cyInstance.current.elements().unselect();
        }
    };

    // Initialize cytoscape
    useEffect(() => {
        if (!cyRef.current) return;

        const allNodes = flattenNodes(ARCHITECTURE_DATA);
        const filteredNodes = filterType === 'all'
            ? allNodes
            : allNodes.filter(n => n.type === filterType || n.type === 'page');

        const elements: cytoscape.ElementDefinition[] = [];

        // Add nodes
        filteredNodes.forEach(node => {
            elements.push({
                data: {
                    id: node.id,
                    label: node.label,
                    type: node.type,
                    description: node.description,
                    accent: node.accent
                }
            });
        });

        // Add edges
        const addEdges = (node: ArchNode) => {
            if (node.children) {
                node.children.forEach(child => {
                    if (filteredNodes.find(n => n.id === child.id)) {
                        elements.push({
                            data: {
                                source: node.id,
                                target: child.id,
                                type: 'parent-child'
                            }
                        });
                    }
                    addEdges(child);
                });
            }
        };
        addEdges(ARCHITECTURE_DATA);

        // Initialize cytoscape
        const cy = cytoscape({
            container: cyRef.current,
            elements: elements,
            style: [
                {
                    selector: 'node',
                    style: {
                        'label': 'data(label)',
                        'text-valign': 'center',
                        'text-halign': 'center',
                        'background-color': (ele: any) => ele.data('accent') || getTypeColor(ele.data('type')),
                        'color': '#fff',
                        'font-size': '10px',
                        'text-wrap': 'wrap',
                        'text-max-width': '80px',
                        'width': (ele: any) => {
                            const type = ele.data('type');
                            if (type === 'app') return 60;
                            if (type === 'page') return 50;
                            if (type === 'feature') return 40;
                            if (type === 'component') return 30;
                            return 20;
                        },
                        'height': (ele: any) => {
                            const type = ele.data('type');
                            if (type === 'app') return 60;
                            if (type === 'page') return 50;
                            if (type === 'feature') return 40;
                            if (type === 'component') return 30;
                            return 20;
                        }
                    }
                },
                {
                    selector: 'edge',
                    style: {
                        'width': 1,
                        'line-color': '#4b5563',
                        'target-arrow-color': '#4b5563',
                        'target-arrow-shape': 'triangle',
                        'curve-style': 'bezier'
                    }
                },
                {
                    selector: 'node:selected',
                    style: {
                        'border-width': 3,
                        'border-color': '#06b6d4'
                    }
                }
            ],
            layout: {
                name: 'dagre',
                rankDir: 'TB',
                nodeSep: 50,
                rankSep: 80,
                padding: 30
            }
        });

        cy.on('tap', 'node', (evt: any) => {
            const nodeData = evt.target.data();
            const archNode = allNodes.find(n => n.id === nodeData.id);
            if (archNode) {
                handleSelect(archNode);
            }
        });

        cyInstance.current = cy;

        return () => {
            cy.destroy();
        };
    }, [filterType]);

    const filteredTreeData = useMemo(() => {
        if (filterType === 'all') return ARCHITECTURE_DATA;

        const filterNode = (node: ArchNode): ArchNode | null => {
            if (node.type === filterType || node.type === 'page') {
                return {
                    ...node,
                    children: node.children
                        .map(filterNode)
                        .filter((n): n is ArchNode => n !== null)
                };
            }
            return null;
        };

        return filterNode(ARCHITECTURE_DATA) || ARCHITECTURE_DATA;
    }, [filterType]);

    const totalStats = useMemo(() => {
        const allNodes = flattenNodes(ARCHITECTURE_DATA);
        return {
            pages: allNodes.filter(n => n.type === 'page').length,
            features: allNodes.filter(n => n.type === 'feature').length,
            components: allNodes.filter(n => n.type === 'component').length,
            files: allNodes.filter(n => n.type === 'file').length
        };
    }, []);

    return (
        <div className="flex h-full bg-zinc-950">
            {/* Left Panel: Tree View */}
            <div className="w-80 border-r border-zinc-800 flex flex-col bg-zinc-900">
                {/* Header */}
                <div className="p-4 border-b border-zinc-800">
                    <h2 className="text-lg font-semibold text-zinc-100 mb-3">Architecture Map</h2>

                    {/* Search */}
                    <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <input
                            type="text"
                            placeholder="Search features, components..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
                        />
                    </div>

                    {/* Filter */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setFilterType('all')}
                            className={`px-3 py-1 rounded text-xs transition-colors ${filterType === 'all'
                                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                                    : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700'
                                }`}
                        >
                            All
                        </button>
                        <button
                            onClick={() => setFilterType('page')}
                            className={`px-3 py-1 rounded text-xs transition-colors ${filterType === 'page'
                                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50'
                                    : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700'
                                }`}
                        >
                            Pages
                        </button>
                        <button
                            onClick={() => setFilterType('feature')}
                            className={`px-3 py-1 rounded text-xs transition-colors ${filterType === 'feature'
                                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                                    : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700'
                                }`}
                        >
                            Features
                        </button>
                        <button
                            onClick={() => setFilterType('component')}
                            className={`px-3 py-1 rounded text-xs transition-colors ${filterType === 'component'
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                                    : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700'
                                }`}
                        >
                            Components
                        </button>
                    </div>
                </div>

                {/* Stats */}
                <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
                    <div className="grid grid-cols-4 gap-2">
                        <div className="text-center">
                            <div className="text-lg font-bold text-purple-400">{totalStats.pages}</div>
                            <div className="text-xs text-zinc-500">Pages</div>
                        </div>
                        <div className="text-center">
                            <div className="text-lg font-bold text-blue-400">{totalStats.features}</div>
                            <div className="text-xs text-zinc-500">Features</div>
                        </div>
                        <div className="text-center">
                            <div className="text-lg font-bold text-emerald-400">{totalStats.components}</div>
                            <div className="text-xs text-zinc-500">Components</div>
                        </div>
                        <div className="text-center">
                            <div className="text-lg font-bold text-zinc-400">{totalStats.files}</div>
                            <div className="text-xs text-zinc-500">Files</div>
                        </div>
                    </div>
                </div>

                {/* Tree */}
                <div className="flex-1 overflow-y-auto p-2">
                    <TreeNode
                        node={filteredTreeData}
                        level={0}
                        expanded={expanded}
                        onToggle={handleToggle}
                        onSelect={handleSelect}
                        selected={selected}
                        searchTerm={searchTerm}
                    />
                </div>
            </div>

            {/* Right Panel: Graph View */}
            <div className="flex-1 relative">
                <div ref={cyRef} className="w-full h-full bg-zinc-950" />

                {/* Detail Panel */}
                <DetailPanel node={selectedNode} onClose={handleCloseDetail} />

                {/* Legend */}
                <div className="absolute bottom-4 left-4 bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                    <div className="text-xs text-zinc-500 mb-2">Legend</div>
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#06b6d4' }} />
                            <span className="text-xs text-zinc-400">App</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#8b5cf6' }} />
                            <span className="text-xs text-zinc-400">Page</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#3b82f6' }} />
                            <span className="text-xs text-zinc-400">Feature</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#10b981' }} />
                            <span className="text-xs text-zinc-400">Component</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#6b7280' }} />
                            <span className="text-xs text-zinc-400">File</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CodeArchitectureMap;