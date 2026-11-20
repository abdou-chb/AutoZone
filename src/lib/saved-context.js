import { createContext, useContext } from "react";

export const SavedCarsContext = createContext(null);

export function useSavedCars() {
  return useContext(SavedCarsContext);
}
