import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Toaster } from 'sonner'
import { HelmetProvider } from 'react-helmet-async'
import { createBrowserRouter, redirect, RouterProvider } from "react-router-dom";
import WeddingInvitation from './pages/WeddingInvitation.tsx'


//路由
const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,   // 顶层框架
    children: [
      { index: true, element: <WeddingInvitation /> },

    ],
  },
  {
    path: "/index.html",
    loader: () => redirect("/"), // v6.4+ 的数据路由写法
  }
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <RouterProvider router={router} />
      <Toaster richColors position="top-center" />
    </HelmetProvider>
  </StrictMode>
)
