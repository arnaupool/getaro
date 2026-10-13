"use client";

import { useRef, useState, useTransition } from "react";
import { clearRoomImage, setRoomEmoji, setRoomImage } from "@/app/actions";
import { useI18n } from "@/components/I18nProvider";
import { RoomAvatar } from "@/components/RoomAvatar";
import { ROOM_IMAGES_BUCKET } from "@/lib/room-image";
import { createClient } from "@/lib/supabase/client";

const PRESETS = ["🎉", "🍻", "🍕", "☕", "🏖️", "⛰️", "🎬", "🎤", "💃", "🎲", "🌮", "🍷", "⚽", "🎂", "✈️", "🫶"];
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
  const [custom, setCustom] = useState("");
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

      <div>
        <p className="label">{t.people.chooseEmoji}</p>
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((e) => (
            <button
              key={e}
              type="button"
              disabled={pending}
              onClick={() => chooseEmoji(e)}
              aria-pressed={emoji === e}
              className={`h-10 w-10 rounded-xl text-xl transition hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                emoji === e ? "bg-violet-100 ring-2 ring-violet-500 dark:bg-violet-900/40" : ""
              }`}
            >
              {e}
            </button>
          ))}
        </div>
        <form
          className="mt-2 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (custom.trim()) chooseEmoji(custom.trim());
          }}
        >
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            maxLength={16}
            placeholder={t.people.customEmoji}
            className="input w-40"
            aria-label={t.people.customEmoji}
          />
          <button type="submit" className="btn-secondary" disabled={pending || !custom.trim()}>
            {t.common.save}
          </button>
          {emoji && (
            <button type="button" className="btn-ghost" disabled={pending} onClick={() => chooseEmoji("")}>
              {t.people.noEmoji}
            </button>
          )}
        </form>
      </div>

      {imageUrl && <p className="muted text-xs">{t.people.photoWins}</p>}
      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
}
