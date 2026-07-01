import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI密逃 · 无限轮回',
  description: '神秘古堡密室逃脱 - 集齐三件圣物，逃出生天',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
