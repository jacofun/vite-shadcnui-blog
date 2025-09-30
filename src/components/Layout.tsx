import { useState, useEffect, useRef, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, PauseCircle, PlayCircle } from 'lucide-react';
import config from '@/config/config';
import BottomBar from '@/components/BottomBar';

type LayoutProps = {
  children: ReactNode;
};

const Layout = ({ children }: LayoutProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wasPlayingRef = useRef<boolean>(false);

  // First useEffect to handle initial setup and auto-play attempt
  useEffect(() => {
    audioRef.current = new Audio(config.data.audio.src);

    if (audioRef.current) {
      audioRef.current.loop = config.data.audio.loop;
    }

    const attemptAutoplay = async () => {
      const audioElement = audioRef.current;

      if (!audioElement) {
        return;
      }

      try {
        await audioElement.play();
        setIsPlaying(true);
        wasPlayingRef.current = true;
        setShowToast(true);
        window.setTimeout(() => setShowToast(false), 3000);
      } catch (error) {
        console.log('Autoplay failed, waiting for user interaction');
        // Add click event listener for first interaction
        const handleFirstInteraction = async () => {
          const interactiveAudio = audioRef.current;

          if (!interactiveAudio) {
            return;
          }

          try {
            await interactiveAudio.play();
            setIsPlaying(true);
            wasPlayingRef.current = true;
            setShowToast(true);
            window.setTimeout(() => setShowToast(false), 3000);
            document.removeEventListener('click', handleFirstInteraction);
          } catch (err) {
            console.error('Playback failed after interaction:', err);
          }
        };

        document.addEventListener('click', handleFirstInteraction, { once: true });
      }
    };

    attemptAutoplay();

    return () => {
      const audioElement = audioRef.current;

      if (audioElement) {
        audioElement.pause();
      }

      audioRef.current = null;
    };
  }, []);

  // Second useEffect to handle visibility and focus changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        wasPlayingRef.current = isPlaying;

        if (audioRef.current && isPlaying) {
          audioRef.current.pause();
          setIsPlaying(false);
        }
      } else if (audioRef.current && wasPlayingRef.current) {
        audioRef.current
          .play()
          .then(() => setIsPlaying(true))
          .catch(console.error);
      }
    };

    const handleWindowBlur = () => {
      wasPlayingRef.current = isPlaying;

      if (audioRef.current && isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    };

    const handleWindowFocus = () => {
      if (audioRef.current && wasPlayingRef.current) {
        audioRef.current
          .play()
          .then(() => setIsPlaying(true))
          .catch(console.error);
      }
    };

    const handlePlay: EventListener = () => {
      setIsPlaying(true);
      setShowToast(true);
      const toastDuration = config.audio?.toastDuration ?? 3000;
      window.setTimeout(() => setShowToast(false), toastDuration);
    };

    const handlePause: EventListener = () => {
      setIsPlaying(false);
      setShowToast(false);
    };

    if (audioRef.current) {
      audioRef.current.addEventListener('play', handlePlay);
      audioRef.current.addEventListener('pause', handlePause);
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);

      if (audioRef.current) {
        audioRef.current.removeEventListener('play', handlePlay);
        audioRef.current.removeEventListener('pause', handlePause);
      }
    };
  }, [isPlaying]);

  // Toggle music function
  const toggleMusic = async (): Promise<void> => {
    const audioElement = audioRef.current;

    if (!audioElement) {
      return;
    }

    try {
      if (isPlaying) {
        audioElement.pause();
        wasPlayingRef.current = false;
      } else {
        await audioElement.play();
        wasPlayingRef.current = true;
      }
    } catch (error) {
      console.error('Playback error:', error);
    }
  };

  // Handle page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      const audioElement = audioRef.current;

      if (audioElement) {
        audioElement.pause();
        setIsPlaying(false);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  return (
    <div className="relative min-h-screen w-full bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
      <motion.div
        className="mx-auto w-full max-w-[430px] min-h-screen bg-white relative overflow-hidden border border-gray-200 shadow-lg"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* Music Control Button with Status Indicator */}
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={toggleMusic}
          className="fixed top-4 right-4 z-50 bg-white/80 backdrop-blur-sm p-3 rounded-full shadow-lg border border-rose-100/50"
        >
          {isPlaying ? (
            <div className="relative">
              <PauseCircle className="w-6 h-6 text-rose-500" />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            </div>
          ) : (
            <PlayCircle className="w-6 h-6 text-rose-500" />
          )}
        </motion.button>

        <main className="relative h-full w-full pb-[100px]">
          {children}
        </main>
        <BottomBar />
        {/* Music Info Toast */}
        <AnimatePresence>
          {showToast && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3 }}
              className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-50"
            >
              <div className="bg-black/80 text-white transform -translate-x-1/2 px-4 py-2 rounded-full backdrop-blur-sm flex items-center space-x-2">
                <Music className="w-4 h-4 animate-pulse" />
                <span className="text-sm whitespace-nowrap">
                  {config.data.audio.title}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default Layout;
