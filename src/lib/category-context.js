import { createContext, useContext } from "react";

export const CategoryContext = createContext(null);

export function useCategory() {
  return useContext(CategoryContext);
}
