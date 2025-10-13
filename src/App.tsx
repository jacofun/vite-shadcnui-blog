
import { AnimatePresence, motion } from "framer-motion";
import { Outlet, useLocation } from "react-router-dom";
import Footer from "./components/wedding/Footer";
import { Waline } from "./components/common/Waline";

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
      <Waline serverURL="https://waline.yanxiao.me" path={location.pathname}/>
      <Footer />
    </>

  )
}

export default App
