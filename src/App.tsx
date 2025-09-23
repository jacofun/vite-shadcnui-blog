import { useEffect, useState } from "react"

import {
  CalendarHeart,
  Clock,
  Heart,
  MapPin,
  Music4,
  Phone,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"

const schedule = [
  {
    time: "16:00",
    title: "Guest Arrival & Welcome Drinks",
    description: "Sip rose spritzers while soft jazz greets your evening.",
  },
  {
    time: "17:00",
    title: "Garden Ceremony",
    description: "Exchange of vows beneath blush florals and golden dusk light.",
  },
  {
    time: "18:30",
    title: "Dinner & Toasts",
    description: "Seasonal tastes paired with heartfelt stories from loved ones.",
  },
  {
    time: "20:00",
    title: "First Dance & Celebration",
    description: "Live band, sparkling lights, and a night of joyful dancing.",
  },
]

const registry = [
  {
    label: "Honeymoon Wishes",
    description: "Help us create memories on the Amalfi Coast getaway.",
  },
  {
    label: "Home Keepsakes",
    description: "A curated list of heirloom pieces to start our next chapter.",
  },
]

const EVENT_DATE = new Date("2025-10-19T12:00:00+08:00")

type TimeLeft = {
  days: string
  hours: string
  minutes: string
  seconds: string
}

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
    return (
      <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
        <div className="pointer-events-none absolute -left-24 top-10 h-56 w-56 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 bottom-10 h-64 w-64 rounded-full bg-accent/40 blur-3xl" />
        <main className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
          <Card className="border-none bg-white/80 p-8 text-center shadow-xl">
            <CardHeader className="items-center gap-3">
              <Badge variant="subtle">Wedding Invitation</Badge>
              <CardTitle className="text-4xl font-serif tracking-tight text-primary">
                Emma & Liam
              </CardTitle>
              <CardDescription className="text-base text-muted-foreground">
                Saturday - June 21, 2025 - Villa Rosa, Napa Valley
              </CardDescription>
            </CardHeader>
            <CardContent className="gap-5">
              <p className="text-sm leading-relaxed text-muted-foreground">
                With hearts full of joy, we invite you to join our family and
                friends for an intimate celebration of love under pastel evening
                skies.
              </p>
              <div className="flex justify-center">
                <Button className="w-full max-w-xs" onClick={() => setHasAccepted(true)}>
                  接受邀请
                </Button>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-medium uppercase tracking-[0.3em] text-primary">
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" /> Dress: Garden Chic
                </span>
                <span className="flex items-center gap-2">
                  <Heart className="h-4 w-4" /> Adults Only
                </span>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute -left-24 top-10 h-56 w-56 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-10 h-64 w-64 rounded-full bg-accent/40 blur-3xl" />
      <main className="relative mx-auto flex min-h-screen max-w-md flex-col gap-8 px-6 pb-16 pt-12">
        <Card className="border-none bg-white/80 p-8 text-center shadow-xl">
          <CardHeader className="items-center gap-3">
            <Badge variant="subtle">Countdown to Celebration</Badge>
            <CardTitle className="text-4xl font-serif tracking-tight text-primary">
              Emma & Liam
            </CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              Saturday - June 21, 2025 - Villa Rosa, Napa Valley
            </CardDescription>
          </CardHeader>
          <CardContent className="gap-6">
            <div className="grid grid-cols-2 gap-4 text-center">
              {[
                { label: "Days", value: timeLeft.days },
                { label: "Hours", value: timeLeft.hours },
                { label: "Minutes", value: timeLeft.minutes },
                { label: "Seconds", value: timeLeft.seconds },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl bg-primary/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
                    {item.label}
                  </p>
                  <p className="mt-2 text-3xl font-serif">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="space-y-4 text-sm text-muted-foreground">
              <div className="flex justify-center">
                <div className="grid grid-cols-[auto_1fr] items-start gap-3 text-left">
                  <CalendarHeart className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-semibold text-primary">Date</p>
                    <p>Saturday, June 21, 2025</p>
                  </div>
                </div>
              </div>
              <div className="flex justify-center">
                <div className="grid grid-cols-[auto_1fr] items-start gap-3 text-left">
                  <Clock className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-semibold text-primary">Time</p>
                    <p>Arrivals from 4:00 PM - Ceremony at 5:00 PM</p>
                  </div>
                </div>
              </div>
              <div className="flex justify-center">
                <div className="grid grid-cols-[auto_1fr] items-start gap-3 text-left">
                  <MapPin className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-semibold text-primary">Venue</p>
                    <p>Villa Rosa Gardens - 318 Lavender Lane - Napa Valley, CA</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <CalendarHeart className="h-5 w-5" /> Event Details
            </CardTitle>
            <CardDescription>
              We cannot wait to celebrate our forever with you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary">
                  <CalendarHeart className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-semibold">Date</p>
                  <p className="text-muted-foreground">Saturday - June 21, 2025</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-semibold">Time</p>
                  <p className="text-muted-foreground">Arrivals from 4:00 PM - Ceremony at 5:00 PM</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary">
                  <MapPin className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-semibold">Venue</p>
                  <p className="text-muted-foreground">
                    Villa Rosa Gardens - 318 Lavender Lane - Napa Valley, CA
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full">
              View Directions
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Music4 className="h-5 w-5" /> Celebration Timeline
            </CardTitle>
            <CardDescription>
              A gentle flow from golden hour vows to moonlit dancing.
            </CardDescription>
          </CardHeader>
          <CardContent className="gap-6">
            {schedule.map((item) => (
              <div key={item.title} className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.25em] text-primary">
                  <span>{item.title}</span>
                  <span>{item.time}</span>
                </div>
                <p className="text-sm text-muted-foreground">{item.description}</p>
                <Separator className="mt-4" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Heart className="h-5 w-5" /> Our Story
            </CardTitle>
            <CardDescription>
              Twelve years, countless adventures, and a forever that begins here.
            </CardDescription>
          </CardHeader>
          <CardContent className="gap-4 text-sm text-muted-foreground">
            <p>
              From a chance meeting in a cozy campus cafe to a sunset proposal on
              the cliffs of Big Sur, our love has been sealed with quiet moments
              and shared laughter.
            </p>
            <p>
              We are honored to gather those who have cheered us on, hugged us
              tight, and believed in our happily ever after.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <UtensilsCrossed className="h-5 w-5" /> Kindly Respond & Registry
            </CardTitle>
            <CardDescription>
              Let us know you will be with us and explore thoughtful gifts.
            </CardDescription>
          </CardHeader>
          <CardContent className="gap-5 text-sm text-muted-foreground">
            <Button className="w-full">Send RSVP</Button>
            <div className="space-y-3">
              {registry.map((item) => (
                <div key={item.label} className="rounded-2xl bg-primary/5 p-4">
                  <p className="font-semibold text-primary">{item.label}</p>
                  <p>{item.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" />
              <span>Questions? Call Emma at (707) 555-0123</span>
            </div>
            <p className="text-center text-xs">
              Please RSVP by May 15 so we can save your seat beneath the stars.
            </p>
          </CardFooter>
        </Card>
      </main>
    </div>
  )
}

export default App

