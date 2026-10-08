import { Button } from "../../ui/Button";
import { Sheet } from "../../ui/Sheet";
import { useShell } from "../../ui/shell";
import type { Scope } from "./types";

/**
 * "Change which?" for a repeating event (UX §6): just this one, this and the ones after, or all
 * of them. Remove and Move (and a drop) ask the same three; Undo reverses the whole choice.
 */
export function ScopeChooser({
  open,
  verb,
  title,
  repeatText,
  onChoose,
  onCancel,
}: {
  open: boolean;
  verb: "Change" | "Move" | "Remove";
  title: string;
  repeatText?: string | null | undefined;
  onChoose: (scope: Scope) => void;
  onCancel: () => void;
}) {
  const display = useShell() === "display";
  const choice = (scope: Scope, label: string) => (
    <Button
      block
      variant="secondary"
      onClick={() => {
        onChoose(scope);
      }}
    >
      {label}
    </Button>
  );
  return (
    <Sheet open={open} title={`${verb} which?`} onClose={onCancel}>
      <div className="flex flex-col gap-4 pb-2">
        <p className={display ? "text-d-body" : "text-body"}>
          {repeatText ? `${title} repeats: ${repeatText.toLowerCase()}.` : `${title} repeats.`}
        </p>
        {choice("this", "Just this one")}
        {choice("following", "This and the ones after")}
        {choice("all", "All of them")}
      </div>
    </Sheet>
  );
}
