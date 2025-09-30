// src/components/bottom-bar/BottomBar.tsx
import { useCallback, useEffect, useState, type MouseEvent } from 'react';
import { motion } from 'framer-motion';
import {
  Home,
  CalendarHeart,
  MapPin,
  Gift,
  MessageCircleHeart,
  type LucideIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';

type MenuItem = {
  icon: LucideIcon;
  label: string;
  href: string;
  id: string;
};

const menuItems: MenuItem[] = [
  { icon: Home, label: 'Beranda', href: '#home', id: 'home' },
  { icon: CalendarHeart, label: 'Event', href: '#event', id: 'event' },
  { icon: MapPin, label: 'Lokasi', href: '#location', id: 'location' },
  { icon: Gift, label: 'Hadiah', href: '#gifts', id: 'gifts' },
  { icon: MessageCircleHeart, label: 'Harapan', href: '#wishes', id: 'wishes' }
];

/**
 * BottomBar is a React functional component that renders a fixed bottom navigation bar
 * with automatic section detection based on scroll position.
 */
const BottomBar = () => {
  const [active, setActive] = useState<MenuItem['id']>('home');

  // Function to handle smooth scrolling when clicking menu items
  const handleMenuClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>, href: MenuItem['href'], id: MenuItem['id']) => {
      event.preventDefault();
      const element = document.querySelector(href);

      if (!element) {
        return;
      }

      setActive(id);

      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    },
    []
  );

  // Set up Intersection Observer for automatic section detection
  useEffect(() => {
    const observerOptions: IntersectionObserverInit = {
      root: null,
      rootMargin: '-20% 0px -80% 0px',
      threshold: 0
    };

    const observerCallback: IntersectionObserverCallback = (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        const sectionId = entry.target.id;
        const validSection = menuItems.find((item) => item.id === sectionId);

        if (validSection) {
          setActive(sectionId);
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    menuItems.forEach((item) => {
      const element = document.getElementById(item.id);

      if (element) {
        observer.observe(element);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div className="fixed bottom-4 left-0 right-0 z-50 flex justify-center px-4">
      <motion.div
        className="w-auto"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, type: 'spring', stiffness: 100 }}
      >
        <div className="backdrop-blur-md bg-white/90 border border-gray-200/80 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.07)] px-3 py-2">
          <nav className="flex items-center gap-1">
            {menuItems.map((item) => (
              <motion.a
                key={item.label}
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center py-2 px-2 rounded-xl transition-all duration-300 ease-in-out',
                  'hover:bg-gray-50/80 cursor-pointer min-w-[60px]',
                  active === item.id ? 'text-primary bg-primary/5' : 'text-gray-600'
                )}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={(event) => handleMenuClick(event, item.href, item.id)}
              >
                <motion.div
                  animate={{
                    scale: active === item.id ? 1.1 : 1
                  }}
                  transition={{ duration: 0.2 }}
                >
                  <item.icon
                    className={cn(
                      'h-[18px] w-[18px] sm:h-5 sm:w-5 mb-0.5 sm:mb-1 transition-all duration-300',
                      active === item.id
                        ? 'stroke-rose-500 stroke-[2.5px]'
                        : 'stroke-gray-600 stroke-2'
                    )}
                  />
                </motion.div>
                <motion.span
                  className={cn(
                    'text-[10px] sm:text-xs font-medium transition-all duration-300 line-clamp-1',
                    active === item.id
                      ? 'text-rose-500 font-semibold'
                      : 'text-gray-600'
                  )}
                  animate={{
                    scale: active === item.id ? 1.05 : 1
                  }}
                  transition={{ duration: 0.2 }}
                >
                  {item.label}
                </motion.span>
              </motion.a>
            ))}
          </nav>
        </div>
      </motion.div>
    </div>
  );
};

export default BottomBar;
