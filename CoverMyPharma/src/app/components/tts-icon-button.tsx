import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Loader2, Pause, Volume2 } from "lucide-react";

import { generateSpeechAudio } from "./tts";

let activeAudio: HTMLAudioElement | null = null;
let clearActiveButton: (() => void) | null = null;

interface TtsIconButtonProps {
  text: string;
  label: string;
  voiceId?: string;
  className?: string;
}

export function TtsIconButton({
  text,
  label,
  voiceId,
  className = "",
}: TtsIconButtonProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const audio = new Audio();
    const handleEnded = () => {
      setIsPlaying(false);
      if (activeAudio === audio) {
        activeAudio = null;
        clearActiveButton = null;
      }
    };

    audio.addEventListener("ended", handleEnded);
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.removeEventListener("ended", handleEnded);

      if (activeAudio === audio) {
        activeAudio = null;
        clearActiveButton = null;
      }

      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!audioRef.current) return;

    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setIsPlaying(false);
    setIsLoading(false);
    setErrorMessage(null);

    if (activeAudio === audioRef.current) {
      activeAudio = null;
      clearActiveButton = null;
    }

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }, [text, voiceId]);

  const handleClick = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      if (activeAudio === audioRef.current) {
        activeAudio = null;
        clearActiveButton = null;
      }
      return;
    }

    if (activeAudio && activeAudio !== audioRef.current) {
      activeAudio.pause();
      activeAudio.currentTime = 0;
      clearActiveButton?.();
    }

    if (audioUrlRef.current) {
      audioRef.current.src = audioUrlRef.current;
      activeAudio = audioRef.current;
      clearActiveButton = () => setIsPlaying(false);
      await audioRef.current.play().catch(() => {
        setIsPlaying(false);
        if (activeAudio === audioRef.current) {
          activeAudio = null;
          clearActiveButton = null;
        }
      });
      setIsPlaying(true);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const audioUrl = await generateSpeechAudio(text, voiceId);
      audioUrlRef.current = audioUrl;
      audioRef.current.src = audioUrl;
      activeAudio = audioRef.current;
      clearActiveButton = () => setIsPlaying(false);
      await audioRef.current.play();
      setIsPlaying(true);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to generate speech.",
      );
      setIsPlaying(false);
      if (activeAudio === audioRef.current) {
        activeAudio = null;
        clearActiveButton = null;
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={(event) => void handleClick(event)}
      className={`min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-lg transition-colors hover:bg-muted ${className}`}
      aria-label={isPlaying ? `Stop audio for ${label}` : `Play audio for ${label}`}
      title={errorMessage ?? (isPlaying ? "Stop audio" : "Play audio")}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : isPlaying ? (
        <Pause className="w-4 h-4" />
      ) : (
        <Volume2 className="w-4 h-4" />
      )}
    </button>
  );
}
