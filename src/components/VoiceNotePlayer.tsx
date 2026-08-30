import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2, Cloud } from 'lucide-react';

interface VoiceNotePlayerProps {
  audioBlob?: Blob;
  audioUrl?: string;
  duration?: number;
  compact?: boolean;
}

export const VoiceNotePlayer: React.FC<VoiceNotePlayerProps> = ({ 
  audioBlob, 
  audioUrl: remoteAudioUrl, 
  duration = 0, 
  compact = false 
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (remoteAudioUrl) {
      setActiveUrl(remoteAudioUrl);
    } else if (audioBlob) {
      const url = URL.createObjectURL(audioBlob);
      setActiveUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setActiveUrl(null);
    }
  }, [audioBlob, remoteAudioUrl]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current || !activeUrl) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => console.error('Audio playback error:', err));
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const targetTime = percentage * (audioRef.current.duration || duration);
    audioRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!activeUrl) return null;

  const totalDuration = audioRef.current?.duration || duration || 1;
  const progressPercent = Math.min(100, (currentTime / totalDuration) * 100);

  return (
    <div 
      className={`flex items-center gap-2.5 rounded-full border border-purple-500/20 bg-purple-50/70 dark:bg-purple-950/30 text-purple-900 dark:text-purple-300 ${
        compact ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-2 text-sm'
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      <audio
        ref={audioRef}
        src={activeUrl || ''}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        preload="metadata"
      />

      <button
        type="button"
        onClick={togglePlay}
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-purple-600 text-white shadow-sm hover:bg-purple-700 active:scale-95 transition-transform"
        aria-label={isPlaying ? 'Pause voice note' : 'Play voice note'}
      >
        {isPlaying ? <Pause className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current ml-0.5" />}
      </button>

      {/* Waveform / Progress bar */}
      <div 
        className="relative flex-1 h-2 bg-purple-200/80 dark:bg-purple-900/50 rounded-full overflow-hidden cursor-pointer min-w-[70px]"
        onClick={handleSeek}
      >
        <div 
          className="absolute left-0 top-0 bottom-0 bg-purple-600 dark:bg-purple-400 rounded-full transition-all duration-75"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <span className="font-mono text-xs text-purple-700 dark:text-purple-300 select-none">
        {isPlaying ? formatTime(currentTime) : formatTime(duration)}
      </span>

      {remoteAudioUrl ? (
        <span title="Streamed from Supabase Cloud" className="flex items-center">
          <Cloud className="h-3.5 w-3.5 text-purple-500/70 opacity-60 flex-shrink-0" />
        </span>
      ) : (
        <Volume2 className="h-3.5 w-3.5 text-purple-500/70 opacity-60 flex-shrink-0" />
      )}
    </div>
  );
};
