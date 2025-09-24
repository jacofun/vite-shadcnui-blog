import { useEffect, useState } from "react"

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

function App() {
  const [hasAccepted, setHasAccepted] = useState(false)
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => calculateTimeLeft())

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  if (!hasAccepted) {
    return <InvitationPage onAccept={() => setHasAccepted(true)} />
  }

  return <DetailsPage timeLeft={timeLeft} />
}

export default App
