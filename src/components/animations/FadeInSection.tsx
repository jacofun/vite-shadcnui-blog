import { type HTMLMotionProps, motion } from "framer-motion"

import { cn } from "@/lib/utils"

const fadeInVariants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
} as const

const defaultTransition = { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const }

type FadeInSectionProps = HTMLMotionProps<"section"> & {
  delay?: number
}

export function FadeInSection({ className, delay = 0, children, ...rest }: FadeInSectionProps) {
  return (
    <motion.section
      className={cn(className)}
      variants={fadeInVariants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.3 }}
      transition={{ ...defaultTransition, delay }}
      {...rest}
    >
      {children}
    </motion.section>
  )
}
