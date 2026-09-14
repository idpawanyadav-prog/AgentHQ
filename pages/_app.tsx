import AuthGate from "@/components/AuthGate";
import { ThemeProvider } from "@/components/ThemeProvider";
import type { AppProps } from "next/app";
import "../styles/globals.css";

export default function MyApp({ Component, pageProps }: AppProps) {
 return (
 <ThemeProvider>
 <AuthGate>
 <Component {...pageProps} />
 </AuthGate>
 </ThemeProvider>
 );
}
