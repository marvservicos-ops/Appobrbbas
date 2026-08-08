'use client';

import { useState } from 'react';

export function usePhotoLightbox() {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  return { lightboxUrl, openLightbox: setLightboxUrl, closeLightbox: () => setLightboxUrl(null) };
}

export function PhotoLightbox({ url, onClose }: { url: string | null; onClose: () => void }) {
  if (!url) return null;
  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 text-white text-3xl leading-none w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10"
        aria-label="Fechar"
      >
        &times;
      </button>
      <img
        src={url}
        alt=""
        className="max-w-full max-h-full object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
