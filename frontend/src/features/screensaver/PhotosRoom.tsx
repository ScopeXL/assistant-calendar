import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, EyeOff, Eye, Play, Settings, X } from "lucide-react";
import { useState } from "react";

import { qk } from "../../api/keys";
import { askForPin } from "../../lib/parent";
import { fetchSession } from "../../lib/session";
import { Button } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { QrCode } from "../../ui/QrCode";
import { AddPhotosButton } from "./AddPhotosButton";
import { useLibrary, useManifest, usePhotoChanges, type LibraryPhoto } from "./data";
import { startSaver } from "./start";

/** "124 photos". */
export function photosCount(count: number): string {
  return count === 1 ? "1 photo" : `${String(count)} photos`;
}

/**
 * The Photos room in the wall's shell (UX §4): how many there are, Start screensaver, its
 * Settings (behind the PIN), and the photos newest first. The kitchen screen shows a code for
 * adding photos from a phone; a computer adds them itself with Add photos (ADR 0028). A photo
 * opens full screen with Previous, Next and Hide from screensaver: this room can hide photos
 * but never removes them (phones do, with Undo).
 */
export function PhotosRoom() {
  const navigate = useNavigate();
  const { data: session } = useQuery({ queryKey: qk.session(), queryFn: fetchSession });
  const kiosk = session?.device_kind === "kiosk";
  const { data: manifest } = useManifest();
  const library = useLibrary();
  const photos = library.data?.pages.flatMap((page) => page.photos) ?? [];
  const [open, setOpen] = useState<number | null>(null);
  const shown = manifest?.photos.length ?? 0;
  const address = `${window.location.origin}/photos`;
  return (
    <section aria-labelledby="photos-title" className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-6 py-4">
        <h1 id="photos-title" className="text-d-title font-bold">
          Photos
          {library.isSuccess ? (
            <span className="ml-4 text-d-body font-semibold text-ink-soft">
              {photosCount(shown)}
            </span>
          ) : null}
        </h1>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={() => {
              void (async () => {
                if (!session?.is_parent && !(await askForPin())) return;
                await navigate({ to: "/settings/$page", params: { page: "screensaver" } });
              })();
            }}
          >
            <Settings aria-hidden="true" className="size-7" />
            Settings
          </Button>
          <Button
            variant={kiosk ? "primary" : "secondary"}
            onClick={() => {
              startSaver();
            }}
          >
            <Play aria-hidden="true" className="size-7" />
            Start screensaver
          </Button>
          {kiosk ? null : <AddPhotosButton />}
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-6" tabIndex={0}>
        {kiosk ? (
          <div className="mb-6 flex items-center gap-6 rounded-panel border border-line bg-surface p-5">
            <QrCode
              value={address}
              label="A code that opens Photos on a phone"
              className="size-32"
            />
            <p className="text-d-body">
              Add photos from a phone: open Sunroom, then More, then Photos.
            </p>
          </div>
        ) : null}
        {library.isSuccess && photos.length === 0 ? (
          <EmptyState message="Photos added from a phone or a computer show here and on the screensaver." />
        ) : (
          <ul
            aria-label="Photos"
            className="grid grid-cols-[repeat(auto-fill,minmax(12.5rem,1fr))] gap-3"
          >
            {photos.map((photo, index) => (
              <li key={photo.id}>
                <button
                  type="button"
                  aria-label={photo.hidden ? "A photo, hidden from the screensaver" : "A photo"}
                  onClick={() => {
                    setOpen(index);
                  }}
                  className="press relative block aspect-square w-full overflow-hidden rounded-chip-d bg-line"
                >
                  <img
                    src={photo.thumb_url}
                    alt=""
                    loading="lazy"
                    className={`size-full object-cover ${photo.hidden ? "opacity-40" : ""}`}
                  />
                  {photo.hidden ? (
                    <EyeOff
                      aria-hidden="true"
                      className="absolute top-2 right-2 size-7 rounded-full bg-surface p-1"
                    />
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
        {library.hasNextPage ? (
          <div className="mt-6">
            <Button
              variant="secondary"
              pending={library.isFetchingNextPage}
              onClick={() => {
                void library.fetchNextPage();
              }}
            >
              Show more
            </Button>
          </div>
        ) : null}
      </div>
      {open !== null && photos[open] ? (
        <Viewer
          photos={photos}
          index={open}
          onIndex={setOpen}
          onClose={() => {
            setOpen(null);
          }}
        />
      ) : null}
    </section>
  );
}

/** One photo full screen, with Previous, Next, Hide from screensaver and Close. */
function Viewer({
  photos,
  index,
  onIndex,
  onClose,
}: {
  photos: LibraryPhoto[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const { hide } = usePhotoChanges();
  const photo = photos[index];
  if (!photo) return null;
  const step = (by: number) => {
    onIndex((index + by + photos.length) % photos.length);
  };
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo"
      className="fixed inset-0 z-[45] flex flex-col bg-wall"
    >
      <img src={photo.url} alt="" className="min-h-0 flex-1 object-contain" />
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface px-6 py-4">
        <div className="flex gap-3">
          <Button
            variant="secondary"
            disabled={photos.length < 2}
            onClick={() => {
              step(-1);
            }}
          >
            <ChevronLeft aria-hidden="true" className="size-7" />
            Previous
          </Button>
          <Button
            variant="secondary"
            disabled={photos.length < 2}
            onClick={() => {
              step(1);
            }}
          >
            Next
            <ChevronRight aria-hidden="true" className="size-7" />
          </Button>
        </div>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            pending={hide.isPending}
            onClick={() => {
              hide.mutate({ id: photo.id, hidden: !photo.hidden });
            }}
          >
            {photo.hidden ? (
              <Eye aria-hidden="true" className="size-7" />
            ) : (
              <EyeOff aria-hidden="true" className="size-7" />
            )}
            {photo.hidden ? "Show on the screensaver" : "Hide from screensaver"}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            <X aria-hidden="true" className="size-7" />
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
