export type ScheduleItem = {
  time: string
  title: string
  description: string
}

export type RegistryItem = {
  label: string
  description: string
}

export type HighlightItem = {
  icon: "sparkles" | "heart"
  text: string
}

export type EventConfig = {
  coupleNames: string
  eventSummary: string
  celebrationDateLabel: string
  arrivalWindow: string
  venue: string
  eventDateISO: string
  invitation: {
    badgeLabel: string
    description: string
    acceptLabel: string
    highlights: HighlightItem[]
  }
  countdown: {
    badgeLabel: string
  }
  eventDetails: {
    title: string
    description: string
    ctaLabel: string
  }
  timeline: {
    title: string
    description: string
    schedule: ScheduleItem[]
  }
  story: {
    title: string
    description: string
    paragraphs: string[]
  }
  registry: {
    title: string
    description: string
    buttonLabel: string
    items: RegistryItem[]
    contact: string
    rsvpReminder: string
  }
}

export const eventConfig: EventConfig = {
  coupleNames: "Emma & Liam",
  eventSummary: "Saturday - June 21, 2025 - Villa Rosa, Napa Valley",
  celebrationDateLabel: "Saturday, June 21, 2025",
  arrivalWindow: "Arrivals from 4:00 PM - Ceremony at 5:00 PM",
  venue: "Villa Rosa Gardens - 318 Lavender Lane - Napa Valley, CA",
  eventDateISO: "2025-10-19T12:00:00+08:00",
  invitation: {
    badgeLabel: "Wedding Invitation",
    description:
      "With hearts full of joy, we invite you to join our family and friends for an intimate celebration of love under pastel evening skies.",
    acceptLabel: "接受邀请",
    highlights: [
      { icon: "sparkles", text: "Dress: Garden Chic" },
      { icon: "heart", text: "Adults Only" },
    ],
  },
  countdown: {
    badgeLabel: "Countdown to Celebration",
  },
  eventDetails: {
    title: "Event Details",
    description: "We cannot wait to celebrate our forever with you.",
    ctaLabel: "View Directions",
  },
  timeline: {
    title: "Celebration Timeline",
    description: "A gentle flow from golden hour vows to moonlit dancing.",
    schedule: [
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
    ],
  },
  story: {
    title: "Our Story",
    description: "Twelve years, countless adventures, and a forever that begins here.",
    paragraphs: [
      "From a chance meeting in a cozy campus cafe to a sunset proposal on the cliffs of Big Sur, our love has been sealed with quiet moments and shared laughter.",
      "We are honored to gather those who have cheered us on, hugged us tight, and believed in our happily ever after.",
    ],
  },
  registry: {
    title: "Kindly Respond & Registry",
    description: "Let us know you will be with us and explore thoughtful gifts.",
    buttonLabel: "Send RSVP",
    items: [
      {
        label: "Honeymoon Wishes",
        description: "Help us create memories on the Amalfi Coast getaway.",
      },
      {
        label: "Home Keepsakes",
        description: "A curated list of heirloom pieces to start our next chapter.",
      },
    ],
    contact: "Questions? Call Emma at (707) 555-0123",
    rsvpReminder: "Please RSVP by May 15 so we can save your seat beneath the stars.",
  },
}
