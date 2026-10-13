"use client";

import { useRef, useState, useTransition } from "react";
import { clearRoomImage, setRoomEmoji, setRoomImage } from "@/app/actions";
import { useI18n } from "@/components/I18nProvider";
import { RoomAvatar } from "@/components/RoomAvatar";
import { ROOM_IMAGES_BUCKET } from "@/lib/room-image";
import { createClient } from "@/lib/supabase/client";

// Emojis elegidos a mano por categoría: se escogen con un toque, sin teclado ni códigos
const EMOJI_GROUPS = {
  featured: ["🎉", "🍻", "🍕", "☕", "🏖️", "⛰️", "🎬", "🎤", "💃", "🎲", "🌮", "🍷", "⚽", "🎂", "✈️", "🫶"],
  party: ["🎉", "🎊", "🥳", "🎂", "🎁", "🎈", "🎤", "💃", "🕺", "🪩", "🎶", "🎸", "🎲", "🃏", "🎮", "🎳"],
  food: ["🍕", "🍔", "🌮", "🍣", "🍝", "🥘", "🍤", "🥗", "🍰", "🍦", "☕", "🍻", "🍷", "🍹", "🥂", "🧉"],
  sport: ["⚽", "🏀", "🎾", "🏐", "🚴", "🏃", "🏊", "🧗", "🥾", "⛷️", "🏄", "🧘", "🏓", "🛹", "🏋️", "🎯"],
  travel: ["✈️", "🚗", "🚆", "🚢", "🏖️", "⛰️", "🏕️", "🗺️", "🏰", "🎡", "🏝️", "🚐", "🧳", "🌍", "🗼", "🌋"],
  nature: ["🌸", "🌻", "🌲", "🌊", "☀️", "🌙", "⭐", "🌈", "🔥", "❄️", "🍂", "🐶", "🐱", "🦊", "🐢", "🦋"],
  things: ["🎬", "📚", "🎨", "📸", "🎧", "💜", "🫶", "❤️", "✨", "💬", "🏠", "🎓", "💼", "🛍️", "🧶", "🍀"],
} as const;
type EmojiGroup = keyof typeof EMOJI_GROUPS;
const SIZE = 256;

/** Recorta al centro en cuadrado y reduce a 256 px (WebP si el navegador lo admite) */
async function toSquareImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  canvas
    .getContext("2d")!
    .drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/webp", 0.85),
  );
}

// crypto.randomUUID solo existe en HTTPS o localhost; por la IP de la red local no
const randomId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

export function RoomImageEditor({
  roomId,
  name,
  emoji,
  imageUrl,
}: {
  roomId: string;
  name: string;
  emoji: string | null;
  imageUrl: string | null;
}) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [group, setGroup] = useState<EmojiGroup>("featured");
  const fileRef = useRef<HTMLInputElement>(null);

  const run = (task: () => Promise<{ error?: string } | undefined>) =>
    startTransition(async () => {
      setError("");
      const res = await task();
      if (res?.error) setError(res.error);
    });

  const chooseEmoji = (value: string) => run(() => setRoomEmoji(roomId, value));

  const upload = (file: File) =>
    run(async () => {
      try {
        const blob = await toSquareImage(file);
        const ext = blob.type === "image/webp" ? "webp" : "png";
        const path = `${roomId}/${randomId()}.${ext}`;
        const { error } = await createClient()
          .storage.from(ROOM_IMAGES_BUCKET)
          .upload(path, blob, { contentType: blob.type, upsert: false });
        if (error) return { error: t.people.imageError };
        return await setRoomImage(roomId, path);
      } catch {
        return { error: t.people.imageError };
      }
    });

  return (
    <div className={`space-y-3 ${pending ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-3">
        <RoomAvatar name={name} emoji={emoji} imageUrl={imageUrl} size="lg" />
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" disabled={pending} onClick={() => fileRef.current?.click()}>
            {pending ? t.people.uploading : t.people.uploadPhoto}
          </button>
          {imageUrl && (
            <button
              type="button"
              className="btn-ghost text-rose-600 dark:text-rose-400"
              disabled={pending}
              onClick={() => run(() => clearRoomImage(roomId))}
            >
              {t.people.removePhoto}
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) upload(file);
            }}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="label mb-0">{t.people.chooseEmoji}</p>
          {emoji && (
            <button type="button" className="btn-ghost text-xs" disabled={pending} onClick={() => chooseEmoji("")}>
              {t.people.noEmoji}
            </button>
          )}
        </div>
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" role="tablist">
          {(Object.keys(EMOJI_GROUPS) as EmojiGroup[]).map((g) => (
            <button
              key={g}
              type="button"
              role="tab"
              aria-selected={group === g}
              onClick={() => setGroup(g)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition ${
                group === g
                  ? "bg-violet-600 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              {t.people.emojiGroups[g]}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-8 gap-1" role="tabpanel">
          {EMOJI_GROUPS[group].map((e) => (
            <button
              key={e}
              type="button"
              disabled={pending}
              onClick={() => chooseEmoji(e)}
              aria-pressed={emoji === e}
              aria-label={e}
              className={`flex aspect-square items-center justify-center rounded-xl text-xl transition hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                emoji === e ? "bg-violet-100 ring-2 ring-violet-500 dark:bg-violet-900/40" : ""
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      {imageUrl && <p className="muted text-xs">{t.people.photoWins}</p>}
      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
}
