import { useState } from "react"
import config from "@/config/config"
import { AnimatePresence} from "framer-motion"
import { Helmet, HelmetProvider } from "react-helmet-async";
import LandingPage from "@/pages/LandingPage";
import Layout from "@/components/Layout";
import MainContent from "@/pages/MainContent";

function App() {
  const [isInvitationOpen, setIsInvitationOpen] = useState(false);
  return(
    <HelmetProvider>
      <Helmet>
        <title>{config.data.title}</title>
        <meta name="title" content={config.data.title}/>
        <meta name="description" content={config.data.description} />
      </Helmet>
      <AnimatePresence mode='wait'>
        {!isInvitationOpen ? (
          <LandingPage onOpenInvitation={() => setIsInvitationOpen(true)} />
        ) : (
          <Layout>
            <MainContent />
          </Layout>
        )}
      </AnimatePresence>
    </HelmetProvider>
  )


}

export default App
