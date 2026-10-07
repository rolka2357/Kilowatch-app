/**
 * PURPOSE: Share Tips cache/generate state across TipsNews stack screens.
 * TipsTab and RoomTipsDetail must see the same payload; otherwise room detail
 * opens empty while the list still shows in-memory generate results.
 */
import { createContext, useContext } from "react";

import useTips from "../hooks/useTips";

const TipsContext = createContext(null);

export function TipsProvider({ children }) {
  const value = useTips();
  return <TipsContext.Provider value={value}>{children}</TipsContext.Provider>;
}

export function useTipsContext() {
  const value = useContext(TipsContext);
  if (!value) {
    throw new Error("useTipsContext must be used within TipsProvider");
  }
  return value;
}
