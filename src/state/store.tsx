import { createContext, useContext, useMemo, useReducer, type Dispatch, type ReactNode } from 'react';
import { reducer, type Action, type DemoState } from '../core/reducer';
import { buildDataset } from '../data/dataset';

export const initial: DemoState = { ...buildDataset(), heroReceipt: null, pausedDecision: null };

const Ctx = createContext<{ state: DemoState; dispatch: Dispatch<Action>; reset: () => void } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const value = useMemo(() => ({ state, dispatch, reset: () => dispatch({ kind: 'reset', initial }) }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore outside StoreProvider');
  return v;
}
