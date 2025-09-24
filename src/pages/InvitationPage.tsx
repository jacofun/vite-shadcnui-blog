import { Heart, Sparkles } from "lucide-react"

import { eventConfig } from "@/config/config"
import { FadeInSection } from "@/components/animations/FadeInSection"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type InvitationPageProps = {
  onAccept: () => void
}

const highlightIcons = {
  sparkles: Sparkles,
  heart: Heart,
} as const

export function InvitationPage({ onAccept }: InvitationPageProps) {
  const { coupleNames, eventSummary, invitation } = eventConfig

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute -left-24 top-10 h-56 w-56 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-10 h-64 w-64 rounded-full bg-accent/40 blur-3xl" />
      <main className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
        <FadeInSection>
          <Card className="border-none bg-white/80 p-8 text-center shadow-xl">
            <CardHeader className="items-center gap-3">
              <Badge variant="subtle">{invitation.badgeLabel}</Badge>
              <CardTitle className="text-4xl font-serif tracking-tight text-primary">
                {coupleNames}
              </CardTitle>
              <CardDescription className="text-base text-muted-foreground">
                {eventSummary}
              </CardDescription>
            </CardHeader>
            <CardContent className="gap-5">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {invitation.description}
              </p>
              <div className="flex justify-center">
                <Button className="w-full max-w-xs" onClick={onAccept}>
                  {invitation.acceptLabel}
                </Button>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-medium uppercase tracking-[0.3em] text-primary">
                {invitation.highlights.map((highlight) => {
                  const Icon = highlightIcons[highlight.icon]
                  return (
                    <span key={highlight.text} className="flex items-center gap-2">
                      <Icon className="h-4 w-4" /> {highlight.text}
                    </span>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </FadeInSection>
      </main>
    </div>
  )
}
