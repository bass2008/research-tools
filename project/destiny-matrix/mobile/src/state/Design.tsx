import { createContext, useContext, type ReactNode } from 'react';

export type DesignScene = 'home' | 'date' | 'chart' | 'reading' | 'subscription' | 'library';
export const theme = {
  background: '#eee6d6', ink: '#252c35', muted: '#686359',
  accent: '#087b75', gold: '#ac8129', paper: '#fffaf0', border: '#d9c9ac',
  chrome: '#fffaf0', chromeInk: '#252c35', radius: 5, spacing: 22,
};
export const useDesign = () => ({ design: theme });
const SurfaceContext = createContext<'canvas' | 'paper'>('paper');
export function DesignSurface({ kind, children }: { kind: 'canvas' | 'paper'; children: ReactNode }) {
  return <SurfaceContext.Provider value={kind}>{children}</SurfaceContext.Provider>;
}
export function usePalette() {
  const surface = useContext(SurfaceContext);
  return {
    ink: surface === 'canvas' ? theme.ink : '#243632',
    muted: surface === 'canvas' ? theme.muted : '#6b726b',
    accent: theme.accent, error: '#9e3434',
  };
}
