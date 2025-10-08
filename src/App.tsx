
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
        <meta name="description" content={config.data.description}/>
        <link rel="image_src" href={config.data.og_image}/>
        <meta property="og:image" content={config.data.og_image}/>

      </Helmet>
      <AnimatePresence mode='wait'>
            <MainContent />
      </AnimatePresence>
    </HelmetProvider>
  )


}

export default App
