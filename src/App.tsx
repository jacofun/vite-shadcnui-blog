
import { AnimatePresence, motion } from "framer-motion";
import { Outlet, useLocation } from "react-router-dom";
import Footer from "./components/common/Footer";

function App() {
  const location = useLocation();
  return (
    <>
      <AnimatePresence mode='wait'>
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.4 }}
        >
          <Outlet /> {/* 子页面会在这里渲染 */}
        </motion.div>
      </AnimatePresence>
      <Footer />
    </>

  )
}

export default App
