import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, Clock } from 'lucide-react';

import formatEventDate from '@/lib/formatEventDate';
import { Progress } from '@/components/ui/progress';

const EVENT_DATE = new Date('2025-10-19T12:30:00+08:00');
const backgroundImages = [
  '/images/2Y6A6844.jpg',
  '/images/2Y6A6872.jpg',
  '/images/2Y6A7048.jpg',
  '/images/2Y6A7070.jpg',
  '/images/8.2212101.jpg',
];

type LandingPageProps = {
  onOpenInvitation: () => void;
};

type TimeLeft = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

const getTimeLeft = (): TimeLeft => {
  const now = Date.now();
  const diff = Math.max(EVENT_DATE.getTime() - now, 0);
  const day = 1000 * 60 * 60 * 24;
  const hour = 1000 * 60 * 60;
  const minute = 1000 * 60;
  const days = Math.floor(diff / day);
  const hours = Math.floor((diff % day) / hour);
  const minutes = Math.floor((diff % hour) / minute);
  const seconds = Math.floor((diff % minute) / 1000);

  return { days, hours, minutes, seconds };
};

const LandingPage = ({ onOpenInvitation }: LandingPageProps) => {
  const totalImages = backgroundImages.length;
  const [activeImage, setActiveImage] = useState(0);
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => getTimeLeft());
  const [loadedCount, setLoadedCount] = useState(0);
  const [isReady, setIsReady] = useState(totalImages === 0);
  const [overlayVisible, setOverlayVisible] = useState(totalImages !== 0);
  const loadedIndicesRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTimeLeft(getTimeLeft());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isReady || totalImages <= 1) {
      return;
    }

    const slideshow = window.setInterval(() => {
      setActiveImage((prev) => (prev + 1) % totalImages);
    }, 5000);

    return () => window.clearInterval(slideshow);
  }, [isReady, totalImages]);

  useEffect(() => {
    if (totalImages && loadedCount >= totalImages) {
      setIsReady(true);
    }
  }, [loadedCount, totalImages]);

  useEffect(() => {
    if (!totalImages) {
      setOverlayVisible(false);
      return;
    }

    if (!isReady) {
      setOverlayVisible(true);
      return;
    }

    const timeout = window.setTimeout(() => {
      setOverlayVisible(false);
    }, 1500);

    return () => window.clearTimeout(timeout);
  }, [isReady, totalImages]);


  const handleImageLoad = useCallback((index: number) => {
    if (loadedIndicesRef.current.has(index)) {
      return;
    }

    loadedIndicesRef.current.add(index);
    setLoadedCount((count) => count + 1);
  }, []);

  const countdownSegments = useMemo(
    () => [
      { label: '天', value: timeLeft.days },
      { label: '时', value: timeLeft.hours },
      { label: '分', value: timeLeft.minutes },
      { label: '秒', value: timeLeft.seconds },
    ],
    [timeLeft],
  );

  const progressValue = totalImages
    ? Math.min(100, Math.round((loadedCount / totalImages) * 100))
    : 100;

  return (
    <div className='relative min-h-screen overflow-hidden'>
      <div className='absolute inset-0'>
        {backgroundImages.map((src, index) => (
          <motion.img
            key={src}
            src={src}
            alt='婚纱照背景'
            loading='eager'
            onLoad={() => handleImageLoad(index)}
            onError={() => handleImageLoad(index)}
            initial={{opacity: 1}}
            animate={{ opacity: isReady ? (activeImage === index ? 1 : 0) : 0 }}
            transition={{ duration: 2, ease: 'easeInOut' }}
            className='absolute inset-0 h-full w-full object-cover'
            style={{ pointerEvents: 'none' }}
          />
        ))}
        <div className='absolute inset-0 bg-white/0' />
        <div className='absolute inset-0 bg-gradient-to-b from-white/10 via-white/20 to-white/30' />
      </div>

      <div className='relative z-10 flex min-h-screen flex-col items-center justify-center px-4'>
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: isReady ? 1 : 0 }}
          transition={{ duration: 0.8 }}
          className='w-full max-w-2xl'
        >
          <div className='backdrop-blur-sm bg-white/65 p-8 sm:p-10 rounded-3xl border border-white/60 shadow-2xl'>
            <div className='mb-8 flex items-center justify-center gap-3'>
              <div className='h-px w-10 bg-rose-200/70' />
              <span className='text-sm uppercase tracking-[0.4em] text-rose-300'>Wedding Day</span>
              <div className='h-px w-10 bg-rose-200/70' />
            </div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className='text-center space-y-4'
            >
              <p className='text-base sm:text-lg leading-relaxed text-gray-600'>
                我们将在这一天说出“我愿意”，期待与你共同见证。
              </p>

              <div className='text-sm uppercase tracking-[0.2em] text-rose-400'>
                距离仪式开始还有
              </div>

              <div className='flex justify-center gap-3 sm:gap-4'>
                {countdownSegments.map(({ label, value }) => (
                  <div
                    key={label}
                    className='flex flex-col items-center rounded-2xl border border-rose-100/60 bg-white/65 px-4 py-3 shadow-sm'
                  >
                    <span className=' font-mono text-gray-800 tabular-nums'>
                      {value.toString().padStart(2, '0')}
                    </span>
                    <span className='mt-1 text-xs text-gray-500'>{label}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className='mt-8 flex flex-col items-center gap-4'
            >
              <div className='flex flex-wrap items-center justify-center gap-6 text-sm text-gray-600'>
                <span className='inline-flex items-center gap-2'>
                  <Calendar className='h-4 w-4 text-rose-300' />
                  {formatEventDate('2025-10-19')}
                </span>
                <span className='inline-flex items-center gap-2'>
                  <Clock className='h-4 w-4 text-rose-300' />
                  中午 12:30
                </span>
              </div>

              <div className='text-center'>
                <h1 className='font-sans tracking-wide text-4xl sm:text-5xl text-gray-800'>
                  吴彦骁
                  <span className='mx-4 text-rose-400'>&</span>
                  焦芮
                </h1>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className='mt-10'
            >
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onOpenInvitation}
                className='group relative w-full rounded-2xl bg-rose-500 px-8 py-4 text-white shadow-xl transition-all duration-200 hover:bg-rose-600'
              >
                <span className='relative z-10 flex items-center justify-center gap-2 text-base font-medium'>
                  <span>接受邀请</span>
                  <motion.span
                    animate={{ x: [0, 4, 0] }}
                    transition={{ repeat: Infinity, duration: 1.8 }}
                  >
                    →
                  </motion.span>
                </span>
                <div className='absolute inset-0 rounded-2xl bg-gradient-to-r from-rose-600 to-rose-500 opacity-0 transition-opacity duration-200 group-hover:opacity-100' />
              </motion.button>
              <p className='mt-3 text-center text-xs text-gray-500'>
                点击后进入我们的专属页面，查看更完整的婚礼细节。
              </p>
            </motion.div>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {overlayVisible && (
          <motion.div
            key='preloader'
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            className='absolute inset-0 z-20 flex items-center justify-center bg-white/85 backdrop-blur'
          >
            <div className='w-full max-w-sm space-y-6 rounded-3xl border border-white/70 bg-white/90 p-8 text-center shadow-2xl backdrop-blur'>
              <div className='space-y-1'>
                <p className='text-sm font-medium text-gray-600'>加载中</p>
                <p className='text-xs text-gray-400'>稍等片刻，我们正在准备最美的瞬间...</p>
              </div>
              <Progress value={progressValue} />
              <div className='text-xs font-semibold text-rose-400'>{progressValue}%</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LandingPage;












