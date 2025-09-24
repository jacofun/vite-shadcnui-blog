import { useEffect, useState } from "react"
import { AnimatePresence, motion, type Transition } from "framer-motion"

import { eventConfig } from "@/config/config"
import { DetailsPage, type TimeLeft } from "@/pages/DetailsPage"
import { InvitationPage } from "@/pages/InvitationPage"

const EVENT_DATE = new Date(eventConfig.eventDateISO)

const formatUnit = (value: number) => value.toString().padStart(2, "0")

const calculateTimeLeft = (): TimeLeft => {
  const diff = EVENT_DATE.getTime() - Date.now()

  if (diff <= 0) {
    return { days: "00", hours: "00", minutes: "00", seconds: "00" }
  }

  const totalSeconds = Math.floor(diff / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return {
    days: formatUnit(days),
    hours: formatUnit(hours),
    minutes: formatUnit(minutes),
    seconds: formatUnit(seconds),
  }
}

const pageEase = [0.16, 1, 0.3, 1] as const
const pageTransition: Transition = { duration: 0.45, ease: pageEase }

function App() {
  const [hasAccepted, setHasAccepted] = useState(false)
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => calculateTimeLeft())

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  return (
    <AnimatePresence mode="wait" initial={false}>
      {!hasAccepted ? (
        <motion.div
          key="invitation"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={pageTransition}
        >
          <InvitationPage onAccept={() => setHasAccepted(true)} />
        </motion.div>
      ) : (
        <motion.div
          key="details"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={pageTransition}
        >
          <DetailsPage timeLeft={timeLeft} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default App
