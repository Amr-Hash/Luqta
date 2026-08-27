import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { ComparePage } from '@/pages/ComparePage'
import { HomePage } from '@/pages/HomePage'
import { ProductPage } from '@/pages/ProductPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { SharePage } from '@/pages/SharePage'

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

export default function App() {
  return (
    <BrowserRouter basename={basename === '/' ? undefined : basename}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="share" element={<SharePage />} />
          <Route path="compare" element={<ComparePage />} />
          <Route path="product/:id" element={<ProductPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
