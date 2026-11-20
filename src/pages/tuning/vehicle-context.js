import { createContext, useContext } from "react";
import { DEFAULT_VEHICLE } from "./vehicles";

// The car on the showroom floor, for the panels: its factory setup, options and sections.
export const VehicleContext = createContext(DEFAULT_VEHICLE);

export function useVehicle() {
  return useContext(VehicleContext);
}
