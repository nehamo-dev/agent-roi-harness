export const TABS = ['Engineer', 'VP Engineering', 'CFO'] as const;
export type Tab = (typeof TABS)[number];
