'use client'
import { useState, useEffect } from 'react';
import { NextUIProvider } from '@nextui-org/react'
import { ThemeProvider } from 'next-themes'

export function Providers({ children }: { children: React.ReactNode }) {
    const [tarayicidaMiyiz, setTarayicidaMiyiz] = useState(false);
    useEffect(() => {
        // Bu kod sadece tarayıcıda çalışır
        setTarayicidaMiyiz(true);
      }, []);
      if (!tarayicidaMiyiz) {
        return <>{children}</>;
      }
  return (
    <NextUIProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        {children}
      </ThemeProvider>
    </NextUIProvider>
  )
}
