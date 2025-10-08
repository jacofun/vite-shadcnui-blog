
import config from "@/config/config"
import { AnimatePresence} from "framer-motion"
import { Helmet, HelmetProvider } from "react-helmet-async";
import MainContent from "@/pages/MainContent";

function App() {
  return(
    <HelmetProvider>
      <Helmet>
        <title>{config.data.title}</title>
        <meta name="title" content={config.data.title}/>
        <meta property="og:title" content={config.data.title}/>
        <meta name="description" content={config.data.description} />
        <meta property="og:description" content={config.data.description} />
      </Helmet>
      <AnimatePresence mode='wait'>
            <MainContent />
      </AnimatePresence>
    </HelmetProvider>
  )


}

export default App
