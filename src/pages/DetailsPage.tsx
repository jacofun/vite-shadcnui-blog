import {
  CalendarHeart,
  Clock,
  Heart,
  MapPin,
  Music4,
  Phone,
  UtensilsCrossed,
} from "lucide-react"

import { eventConfig } from "@/config/config"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export type TimeLeft = {
  days: string
  hours: string
  minutes: string
  seconds: string
}

type DetailsPageProps = {
  timeLeft: TimeLeft
}

export function DetailsPage({ timeLeft }: DetailsPageProps) {
  const { coupleNames, eventSummary, celebrationDateLabel, arrivalWindow, venue, countdown, eventDetails, timeline, story, registry } =
    eventConfig

  const timelineStats = [
    { label: "Days", value: timeLeft.days },
    { label: "Hours", value: timeLeft.hours },
    { label: "Minutes", value: timeLeft.minutes },
    { label: "Seconds", value: timeLeft.seconds },
  ]

  const logistics = [
    { icon: CalendarHeart, label: "Date", value: celebrationDateLabel },
    { icon: Clock, label: "Time", value: arrivalWindow },
    { icon: MapPin, label: "Venue", value: venue },
  ]

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute -left-24 top-10 h-56 w-56 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-10 h-64 w-64 rounded-full bg-accent/40 blur-3xl" />
      <main className="relative mx-auto flex min-h-screen max-w-md flex-col gap-8 px-6 pb-16 pt-12">
        <Card className="border-none bg-white/80 p-8 text-center shadow-xl">
          <CardHeader className="items-center gap-3">
            <Badge variant="subtle">{countdown.badgeLabel}</Badge>
            <CardTitle className="text-4xl font-serif tracking-tight text-primary">
              {coupleNames}
            </CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              {eventSummary}
            </CardDescription>
          </CardHeader>
          <CardContent className="gap-6">
            <div className="grid grid-cols-2 gap-4 text-center">
              {timelineStats.map((item) => (
                <div key={item.label} className="rounded-2xl bg-primary/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
                    {item.label}
                  </p>
                  <p className="mt-2 text-3xl font-serif">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="space-y-4 text-sm text-muted-foreground">
              {logistics.map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex justify-center">
                  <div className="grid grid-cols-[auto_1fr] items-start gap-3 text-left">
                    <Icon className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-semibold text-primary">{label}</p>
                      <p>{value}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <CalendarHeart className="h-5 w-5" /> {eventDetails.title}
            </CardTitle>
            <CardDescription>{eventDetails.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm">
              {logistics.map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-semibold">{label}</p>
                    <p className="text-muted-foreground">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full">
              {eventDetails.ctaLabel}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Music4 className="h-5 w-5" /> {timeline.title}
            </CardTitle>
            <CardDescription>{timeline.description}</CardDescription>
          </CardHeader>
          <CardContent className="gap-6">
            {timeline.schedule.map((item) => (
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
              <Heart className="h-5 w-5" /> {story.title}
            </CardTitle>
            <CardDescription>{story.description}</CardDescription>
          </CardHeader>
          <CardContent className="gap-4 text-sm text-muted-foreground">
            {story.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <UtensilsCrossed className="h-5 w-5" /> {registry.title}
            </CardTitle>
            <CardDescription>{registry.description}</CardDescription>
          </CardHeader>
          <CardContent className="gap-5 text-sm text-muted-foreground">
            <Button className="w-full">{registry.buttonLabel}</Button>
            <div className="space-y-3">
              {registry.items.map((item) => (
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
              <span>{registry.contact}</span>
            </div>
            <p className="text-center text-xs">{registry.rsvpReminder}</p>
          </CardFooter>
        </Card>
      </main>
    </div>
  )
}
