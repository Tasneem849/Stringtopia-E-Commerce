'use client';
import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/components/Providers';

export default function BackgroundAudioPlayer() {
  const { config } = useStore();
  const audioRef = useRef(null);
  const userMutedRef = useRef(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioUrl = config.backgroundAudioUrl;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audioUrl || !audio) {
      setIsPlaying(false);
      return undefined;
    }

    let active = true;
    audio.volume = 0.35;
    audio.muted = userMutedRef.current;
    setIsMuted(userMutedRef.current);
    setIsPlaying(false);
    audio.play()
      .then(() => { if (active) setIsPlaying(true); })
      .catch(async () => {
        if (!active) return;
        audio.muted = true;
        setIsMuted(true);
        try {
          await audio.play();
          if (active) setIsPlaying(true);
        } catch {
          if (active) setIsPlaying(false);
        }
      });

    return () => {
      active = false;
      audio.pause();
    };
  }, [audioUrl]);

  async function toggleSound() {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      userMutedRef.current = false;
      audio.muted = false;
      setIsMuted(false);
      try {
        await audio.play();
        setIsPlaying(true);
      } catch {
        audio.muted = true;
        setIsMuted(true);
        setIsPlaying(false);
      }
      return;
    }

    const nextMuted = !audio.muted;
    userMutedRef.current = nextMuted;
    audio.muted = nextMuted;
    setIsMuted(nextMuted);
  }

  if (!audioUrl) return null;

  const label = isPlaying ? (isMuted ? 'Unmute background audio' : 'Mute background audio') : 'Play background audio';
  const buttonText = isPlaying ? (isMuted ? 'Sound off' : 'Sound on') : 'Play music';

  return (
    <>
      <audio
        ref={audioRef}
        src={audioUrl}
        loop
        muted={isMuted}
        aria-hidden="true"
        preload="auto"
        onPlay={() => setIsPlaying(true)}
      />
      <button
        type="button"
        onClick={toggleSound}
        aria-label={label}
        aria-pressed={isMuted}
        title={label}
        className="cursor-pointer fixed bottom-4 left-4 z-50 inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-ink bg-sun px-4 py-2 text-sm font-bold text-ink shadow-lg transition hover:-translate-y-0.5 hover:bg-rose focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5 6 9H3v6h3l5 4V5Z" />
          {isMuted || !isPlaying ? <path d="m17 9 5 6m0-6-5 6" /> : <><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18 6a8.5 8.5 0 0 1 0 12" /></>}
        </svg>
        {buttonText}
      </button>
    </>
  );
}
