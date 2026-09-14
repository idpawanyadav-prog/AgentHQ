import AuthGate from "@/components/AuthGate";
import type { AppProps } from "next/app";
import "../styles/globals.css";

export default function MyApp({ Component, pageProps }: AppProps) {
 return <AuthGate><Component {...pageProps} /></AuthGate>;
}
