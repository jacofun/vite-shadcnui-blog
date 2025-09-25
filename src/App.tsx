import { useState } from "react"
import { globalConfig } from "@/config/config"
import { AnimatePresence} from "framer-motion"

import { DetailsPage, type TimeLeft} from "@/pages/DetailsPage"
import { InvitationPage } from "@/pages/InvitationPage"
import { Helmet, HelmetProvider } from "react-helmet-async";

const timeLeft:TimeLeft={
  days: "20",
  hours: "24",
  minutes: "59",
  seconds: "59"
}

function App() {
  const [hasAccepted, setHasAccepted] = useState(false);
  return(
    <HelmetProvider>
      <Helmet>
        <title>{globalConfig.data.title}</title>
        <meta name="title" content={globalConfig.data.title}/>
        <meta name="description" content={globalConfig.data.description} />
      </Helmet>
      <AnimatePresence mode='wait'>
        {!hasAccepted?(
          <InvitationPage onAccept={()=>setHasAccepted(true)}/>
        ):(
          <DetailsPage timeLeft={timeLeft}/>
        )}
      </AnimatePresence>
    </HelmetProvider>
  )


}

export default App
