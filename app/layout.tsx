import type { Metadata } from "next";
import { headers } from "next/headers";
import { Pixelify_Sans } from "next/font/google";
import "./game.css";

const pixel = Pixelify_Sans({ variable: "--font-pixel", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:7897";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "production" ? "https" : "http");
  const previewImage = `${protocol}://${host}/og-minecraft-style.png`;
  const title = "方块星球 — 体素生存世界";
  const description = "原版式生存界面、探索、建造、动物生态与昼夜循环。";

  return {
    title,
    description,
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      title,
      description,
      images: [
        {
          url: previewImage,
          width: 1731,
          height: 909,
          alt: "方块星球第一人称生存成长世界",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [previewImage],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className={pixel.variable}>{children}</body>
    </html>
  );
}
