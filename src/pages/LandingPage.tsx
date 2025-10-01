import { useEffect, useMemo, useState } from "react";
import formatEventDate from "@/lib/formatEventDate";
import { AnimatePresence, motion } from "framer-motion";
import { Calendar, Clock, MapPin} from "lucide-react";

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
  const [activeImage, setActiveImage] = useState(0);
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => getTimeLeft());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTimeLeft(getTimeLeft());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (backgroundImages.length <= 1) return;

    const slideshow = window.setInterval(() => {
      setActiveImage((prev) => (prev + 1) % backgroundImages.length);
    }, 6000);

    return () => window.clearInterval(slideshow);
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative min-h-screen overflow-hidden"
    >
      <div className="absolute inset-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={backgroundImages[activeImage] ?? 'fallback-background'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.6, ease: 'easeInOut' }}
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: backgroundImages[activeImage]
                ? `url(${backgroundImages[activeImage]})`
                : 'linear-gradient(135deg, #fce7f3, #f3f4f6)',
            }}
          />
        </AnimatePresence>
        <div className="absolute inset-0 bg-white/10" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/70 via-white/30 to-white/70" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="w-full max-w-2xl"
        >
          <div className="backdrop-blur-md bg-white/65 p-8 sm:p-10 rounded-3xl border border-white/60 shadow-2xl">
            <div className="flex items-center justify-center gap-3 mb-8">
              <div className="h-px w-10 bg-rose-200/70" />
              <span className="text-xs tracking-[0.4em] text-rose-300 uppercase">Wedding Day</span>
              <div className="h-px w-10 bg-rose-200/70" />
            </div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-center space-y-4"
            >
              <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
                我们将在这一天说出“我愿意”，期待与你共同见证。
              </p>

              <div className="text-sm text-rose-400 tracking-[0.2em] uppercase">
                距离婚礼开始还有
              </div>

              <div className="flex justify-center gap-3 sm:gap-4">
                {countdownSegments.map(({ label, value }) => (
                  <div
                    key={label}
                    className="flex flex-col items-center rounded-2xl bg-white/65 px-4 py-3 shadow-sm border border-rose-100/60"
                  >
                    <span className=" font-mono text-gray-800 tabular-nums">
                      {value.toString().padStart(2, '0')}
                    </span>
                    <span className="mt-1 text-xs text-gray-500">{label}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="mt-8 flex flex-col items-center gap-4"
            >
              <div className="flex flex-wrap items-center justify-center gap-6  text-gray-600">
                <span className="inline-flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-rose-300" />
                  {formatEventDate('2025-10-19')}
                </span>
                <span className="inline-flex items-center gap-2">
                  <MapPin className=" h-4 w-4 text-rose-300" />
                  青铜峡宾馆（青铜峡市古峡东街48号）
                </span>
                <span className="inline-flex items-center gap-2">
                  <Clock className="h-4 w-4 text-rose-300" />
                  中午 11:28
                </span>
              </div>

              <div className="text-center">
                <h1 className="text-2xl font-serif text-gray-800 tracking-wide">
                  吴彦骁
                  <span className="mx-4 text-rose-400">&</span>
                  焦芮
                </h1>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-10"
            >
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onOpenInvitation}
                className="group relative w-full rounded-2xl bg-rose-500 px-8 py-4 text-white shadow-xl transition-all duration-200 hover:bg-rose-600"
              >
                <span className="relative z-10 flex items-center justify-center gap-2 text-base font-medium">
                  <span>接受邀请</span>
                  <motion.span
                    animate={{ x: [0, 4, 0] }}
                    transition={{ repeat: Infinity, duration: 1.8 }}
                  >
                    →
                  </motion.span>
                </span>
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-rose-600 to-rose-500 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
              </motion.button>
              <p className="mt-3 text-center text-xs text-gray-500">
                点击后进入我们的专属页面，查看更多婚礼细节。
              </p>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default LandingPage;
