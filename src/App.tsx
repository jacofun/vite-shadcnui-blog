import { Outlet } from "react-router-dom";

import Footer from "./components/common/Footer";

function App() {
  return (
    <div className="min-h-screen bg-[#070a12]">
      <Outlet />
      <Footer />
    </div>
  );
}

export default App;
