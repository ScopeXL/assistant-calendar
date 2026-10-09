import { ArrowBigUp, CornerDownLeft, Delete } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

import {
  backspace,
  enter,
  keyboard,
  lowerKeyboard,
  typeInto,
  wantsCapital,
  type KeyboardLayout,
} from "../lib/keyboard";
import { useStore } from "../lib/store";

/**
 * The wall display's own keyboard (UX §1): the Pi's touchscreen has no physical one, and the
 * system's keyboard covers half the screen. Letters, numbers and symbols, and a number pad;
 * shift is automatic for a first letter; holding a vowel offers its accents. Keys are 80 × 64 in
 * landscape and 88 × 72 in portrait. It docks under the side panel in landscape (960 px) and
 * spans the screen in portrait, and it never takes focus from the field.
 */
const LETTERS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const SYMBOLS = ["1234567890", '-/:;()$&@"', ".,?!'#%*+="];
const NUMBERS = ["123", "456", "789"];
const ACCENTS: Record<string, string> = {
  a: "àáâäãå",
  e: "èéêë",
  i: "ìíîï",
  o: "òóôöõø",
  u: "ùúûü",
  n: "ñ",
  c: "ç",
  s: "ß",
  y: "ÿ",
};
const HOLD_MS = 450;
const CLOSE_MS = 180;
const HOLD_PADDING_MS = 400;

/** Keys press without taking focus: the field keeps its caret. */
function keep(event: PointerEvent): void {
  event.preventDefault();
}

function Key({
  label,
  onPress,
  onHold,
  wide = 1,
  tone = "letter",
  children,
}: {
  label: string;
  onPress: () => void;
  onHold?: () => void;
  wide?: number;
  tone?: "letter" | "action" | "primary";
  children?: ReactNode;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const held = useRef(false);
  const tones = {
    letter: "bg-surface text-ink",
    action: "bg-line text-ink",
    primary: "bg-ink text-on-ink",
  };
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      data-wide={wide}
      onPointerDown={(event) => {
        keep(event);
        held.current = false;
        if (onHold) {
          timer.current = setTimeout(() => {
            held.current = true;
            onHold();
          }, HOLD_MS);
        }
      }}
      onPointerUp={() => {
        clearTimeout(timer.current);
      }}
      onPointerLeave={() => {
        clearTimeout(timer.current);
      }}
      onClick={() => {
        if (!held.current) onPress();
        held.current = false;
      }}
      className={`press osk-key flex items-center justify-center rounded-chip-d font-semibold text-d-key shadow-[0_1px_0_var(--line)] ${tones[tone]}`}
    >
      {children ?? label}
    </button>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex justify-center gap-2">{children}</div>;
}

export function KeyboardHost({ railSide }: { railSide: "left" | "right" }) {
  const { target, layout, open } = useStore(keyboard);
  // Still sliding away: shown, marked closing, until the exit animation ends.
  const [closing, setClosing] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    setClosing(!open);
  }
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(() => {
      setClosing(false);
    }, CLOSE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [closing]);

  // Keep the field in view: the board and panels pad their bottoms by the keyboard's height.
  // The padding outlasts the keyboard a little: a tap on a button lowers the keyboard as focus
  // leaves the field, and the page must not move under that finger before its click lands.
  useEffect(() => {
    const root = document.documentElement;
    const node = host.current;
    if (open && node) {
      root.style.setProperty("--osk-h", `${String(node.offsetHeight)}px`);
      target?.scrollIntoView({ block: "nearest" });
      return;
    }
    const timer = setTimeout(() => {
      root.style.setProperty("--osk-h", "0px");
    }, HOLD_PADDING_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [open, target, layout]);

  // A field in an open sheet (a modal <dialog>): the keyboard goes inside it, because the page
  // behind a modal dialog can't be tapped and the dialog covers it. Kept while the keys slide
  // away; a sheet that closes takes them with it (styles/motion.css).
  const inside = target?.closest("dialog") ?? null;
  const [lastDialog, setLastDialog] = useState<HTMLDialogElement | null>(inside);
  if (target && inside !== lastDialog) setLastDialog(inside);
  const dialog = target ? inside : lastDialog;

  if (!open && !closing) return null;
  const keys = (
    <div
      ref={host}
      data-keyboard=""
      data-state={open ? "open" : "closing"}
      role="group"
      aria-label="On-screen keyboard"
      className={`fixed bottom-0 z-50 rounded-t-panel border border-b-0 border-line bg-wall p-3 pb-4 shadow-[0_-8px_24px_rgb(0_0_0/0.12)] portrait:inset-x-0 portrait:w-auto landscape:w-[var(--keyboard-w)] ${
        railSide === "left" ? "landscape:right-0" : "landscape:left-0"
      }`}
      onPointerDown={keep}
    >
      {target ? <Keys key={layout} target={target} layout={layout} /> : null}
    </div>
  );
  return dialog?.open && dialog.isConnected ? createPortal(keys, dialog) : keys;
}

function Keys({ target, layout }: { target: HTMLInputElement; layout: KeyboardLayout }) {
  const [page, setPage] = useState<"letters" | "symbols">("letters");
  const [shift, setShift] = useState<"auto" | "on" | "off">("auto");
  const [accents, setAccents] = useState<string | null>(null);
  const [, redraw] = useState(0);

  const capital = shift === "on" || (shift === "auto" && wantsCapital(target));
  const type = (text: string) => {
    typeInto(target, text);
    setAccents(null);
    if (shift === "on") setShift("off");
    if (shift === "off" && /\s/.test(text)) setShift("auto");
    redraw((n) => n + 1);
  };

  const bottom = (
    <Row>
      <Key
        label={page === "letters" ? "Numbers and symbols" : "Letters"}
        tone="action"
        wide={1.5}
        onPress={() => {
          setPage(page === "letters" ? "symbols" : "letters");
        }}
      >
        {page === "letters" ? "123" : "ABC"}
      </Key>
      <Key
        label="Space"
        wide={5}
        onPress={() => {
          type(" ");
        }}
      >
        <span className="sr-only">Space</span>
      </Key>
      <Key
        label="Enter"
        tone="action"
        wide={1.5}
        onPress={() => {
          enter(target);
        }}
      >
        <CornerDownLeft aria-hidden="true" className="size-8" />
      </Key>
      <Key label="Done" tone="primary" wide={2} onPress={lowerKeyboard}>
        Done
      </Key>
    </Row>
  );

  if (layout === "numeric") {
    return (
      <div className="flex flex-col gap-2">
        {NUMBERS.map((row) => (
          <Row key={row}>
            {Array.from(row).map((digit) => (
              <Key
                key={digit}
                label={digit}
                wide={1.5}
                onPress={() => {
                  type(digit);
                }}
              />
            ))}
          </Row>
        ))}
        <Row>
          <Key
            label=":"
            tone="action"
            wide={1.5}
            onPress={() => {
              type(":");
            }}
          />
          <Key
            label="0"
            wide={1.5}
            onPress={() => {
              type("0");
            }}
          />
          <Key
            label="Delete"
            tone="action"
            wide={1.5}
            onPress={() => {
              backspace(target);
              redraw((n) => n + 1);
            }}
          >
            <Delete aria-hidden="true" className="size-8" />
          </Key>
        </Row>
        <Row>
          <Key label="Done" tone="primary" wide={4.5} onPress={lowerKeyboard}>
            Done
          </Key>
        </Row>
      </div>
    );
  }

  const rows = page === "letters" ? LETTERS : SYMBOLS;
  return (
    <div className="flex flex-col gap-2">
      <div aria-live="polite" className="flex min-h-14 items-center justify-center gap-2">
        {accents
          ? Array.from(accents).map((accent) => (
              <Key
                key={accent}
                label={capital ? accent.toUpperCase() : accent}
                onPress={() => {
                  type(capital ? accent.toUpperCase() : accent);
                }}
              />
            ))
          : null}
      </div>
      {rows.map((row, index) => (
        <Row key={row}>
          {index === 2 && page === "letters" ? (
            <Key
              label="Shift"
              tone={capital ? "primary" : "action"}
              wide={1.5}
              onPress={() => {
                setShift(capital ? "off" : "on");
              }}
            >
              <ArrowBigUp aria-hidden="true" className="size-8" />
            </Key>
          ) : null}
          {Array.from(row).map((char) => {
            const shown = capital && page === "letters" ? char.toUpperCase() : char;
            const variants = page === "letters" ? ACCENTS[char] : undefined;
            return (
              <Key
                key={char}
                label={shown}
                onPress={() => {
                  type(shown);
                }}
                {...(variants
                  ? {
                      onHold: () => {
                        setAccents(variants);
                      },
                    }
                  : {})}
              />
            );
          })}
          {index === 2 ? (
            <Key
              label="Delete"
              tone="action"
              wide={1.5}
              onPress={() => {
                backspace(target);
                redraw((n) => n + 1);
              }}
            >
              <Delete aria-hidden="true" className="size-8" />
            </Key>
          ) : null}
        </Row>
      ))}
      {bottom}
    </div>
  );
}
