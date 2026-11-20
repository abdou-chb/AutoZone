import { useCallback, useEffect, useReducer } from "react";
import { factoryFor, sanitiseSetup } from "./options";
import { VEHICLES } from "./vehicles";

// The Golf keeps the key it always had, so setups saved before the showroom are still there.
const storageKey = (id) => (id === "golf" ? "autozone:tuning-setup" : `autozone:tuning-setup:${id}`);
const HISTORY_LIMIT = 60;

// Each car has its own setup and its own undo history; switching cars never touches another car's.
function initial() {
  return Object.fromEntries(
    VEHICLES.map((vehicle) => {
      let present = { ...factoryFor(vehicle) };

      try {
        present = sanitiseSetup(JSON.parse(localStorage.getItem(storageKey(vehicle.id))), vehicle);
      } catch {
        // Private mode or blocked storage: start from the factory car.
      }

      return [vehicle.id, { past: [], present, future: [] }];
    }),
  );
}

function same(a, b) {
  return Object.keys(a).every((key) => a[key] === b[key]);
}

function step(state, action) {
  switch (action.type) {
    case "set": {
      const next = { ...state.present, ...action.changes };

      if (same(next, state.present)) {
        return state;
      }

      return { past: [...state.past, state.present].slice(-HISTORY_LIMIT), present: next, future: [] };
    }

    case "undo":
      return state.past.length
        ? { past: state.past.slice(0, -1), present: state.past[state.past.length - 1], future: [state.present, ...state.future] }
        : state;

    case "redo":
      return state.future.length ? { past: [...state.past, state.present], present: state.future[0], future: state.future.slice(1) } : state;

    default:
      return state;
  }
}

function reducer(cars, action) {
  const current = cars[action.vehicle];
  const next = step(current, action);

  return next === current ? cars : { ...cars, [action.vehicle]: next };
}

// The presented car's configuration with undo and redo (reset is one more step, so it can be undone too), and every
// car's setup for the scene, which shows two cars while they swap places.
export default function useConfiguration(vehicle) {
  const [cars, dispatch] = useReducer(reducer, undefined, initial);
  const id = vehicle.id;

  useEffect(() => {
    try {
      Object.entries(cars).forEach(([car, state]) => localStorage.setItem(storageKey(car), JSON.stringify(state.present)));
    } catch {
      // Not remembered when storage is unavailable.
    }
  }, [cars]);

  return {
    setup: cars[id].present,
    setups: cars,
    canUndo: cars[id].past.length > 0,
    canRedo: cars[id].future.length > 0,
    change: useCallback((changes) => dispatch({ type: "set", vehicle: id, changes }), [id]),
    reset: useCallback(() => dispatch({ type: "set", vehicle: id, changes: factoryFor(vehicle) }), [id, vehicle]),
    undo: useCallback(() => dispatch({ type: "undo", vehicle: id }), [id]),
    redo: useCallback(() => dispatch({ type: "redo", vehicle: id }), [id]),
  };
}
