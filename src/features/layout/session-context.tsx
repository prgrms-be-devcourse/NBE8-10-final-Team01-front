"use client";

import { createContext, useContext } from "react";

import type { SessionResponse } from "@/shared/api/contracts";

interface SessionContextValue {
  session: SessionResponse;
  sessionLoaded: boolean;
  refreshSession: () => Promise<SessionResponse>;
  applySession: (nextSession: SessionResponse) => void;
}

const defaultSession: SessionResponse = {
  authenticated: false,
  member: null,
};

const SessionContext = createContext<SessionContextValue>({
  session: defaultSession,
  sessionLoaded: false,
  refreshSession: async () => defaultSession,
  applySession: () => undefined,
});

export function useAppSession() {
  return useContext(SessionContext);
}

export default SessionContext;
