import "../styles/tokens.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { noteOwnScreenAgent } from "../lib/screenAgent";
import { startClock } from "../lib/time";
import { ScreenApp } from "./ScreenApp";

// The pages' own agent serves them: every call goes to their own origin.
noteOwnScreenAgent();
document.addEventListener("touchstart", () => undefined, { passive: true });
startClock();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

const container = document.getElementById("root");
if (!container) throw new Error("The #root element is missing from screen.html");

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ScreenApp />
    </QueryClientProvider>
  </StrictMode>,
);
