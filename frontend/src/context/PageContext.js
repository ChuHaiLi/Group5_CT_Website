import { createContext, useContext } from "react";

export const PageContext = createContext({
  pageContext: "",
  setPageContext: () => {},
});

export function usePageContext() {
  return useContext(PageContext);
}
