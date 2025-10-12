import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Toaster } from 'sonner'
import { HelmetProvider } from 'react-helmet-async'
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import MainContent from './pages/MainContent.tsx'


//路由
const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,   // 顶层框架
    children: [
      { index: true, element: <MainContent /> },

    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <RouterProvider router={router}/>
      <Toaster richColors position="top-center" />
    </HelmetProvider>
  </StrictMode>
)
