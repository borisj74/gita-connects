import { createContext } from 'react';

/** The verse card under the pointer while a connection is being dragged. */
export type ConnectTarget = { id: string; valid: boolean } | null;

export const ConnectTargetContext = createContext<ConnectTarget>(null);
