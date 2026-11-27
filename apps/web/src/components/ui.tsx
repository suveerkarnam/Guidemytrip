import { type ImgHTMLAttributes, type ReactNode, useState } from "react";

export function Icon({ name, size = 20 }: { name: "arrow" | "chevron" | "menu" | "close" | "search" | "heart" | "star" | "play" | "check" | "quote" | "mail" | "user"; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  const paths = {
    arrow: <><path d="M5 12h13" /><path d="m13 6 6 6-6 6" /></>, chevron: <path d="m6 9 6 6 6-6" />, menu: <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>, close: <><path d="m6 6 12 12" /><path d="m18 6-12 12" /></>, search: <><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></>, heart: <path d="M20.8 8.7c0 5.3-8.8 10-8.8 10s-8.8-4.7-8.8-10A4.7 4.7 0 0 1 12 6a4.7 4.7 0 0 1 8.8 2.7Z" />, star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" />, play: <path d="m9 6 9 6-9 6V6Z" />, check: <path d="m5 12 4 4L19 6" />, quote: <path d="M10 11H6a4 4 0 0 0 4 4v2a6 6 0 0 1-6-6V7h6v4Zm10 0h-4a4 4 0 0 0 4 4v2a6 6 0 0 1-6-6V7h6v4Z" />, mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>, user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>
  };
  return <svg {...common}>{paths[name]}</svg>;
}

export function Button({ children, variant = "primary", href, onClick, type = "button", className = "", icon, disabled = false }: { children: ReactNode; variant?: "primary" | "secondary" | "ghost" | "light"; href?: string; onClick?: () => void; type?: "button" | "submit"; className?: string; icon?: "arrow" | "chevron"; disabled?: boolean }) {
  const classes = `inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${variant === "primary" ? "bg-teal-800 text-white shadow-lg shadow-teal-900/15 hover:-translate-y-0.5 hover:bg-teal-700" : variant === "secondary" ? "border border-teal-800/20 bg-white/70 text-teal-900 hover:border-teal-800 hover:bg-white" : variant === "light" ? "bg-ivory text-teal-900 hover:bg-white" : "text-teal-900 hover:bg-teal-900/5"} ${className}`;
  const content = <>{children}{icon && <Icon name={icon} size={17} />}</>;
  return href ? <a className={classes} href={href} onClick={onClick}>{content}</a> : <button className={classes} disabled={disabled} onClick={onClick} type={type}>{content}</button>;
}

export function Badge({ children, tone = "green" }: { children: ReactNode; tone?: "green" | "gold" | "light" }) { return <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${tone === "green" ? "bg-emerald-100 text-emerald-800" : tone === "gold" ? "bg-gold/20 text-gold-dark" : "bg-white/15 text-white"}`}>{tone === "green" && <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />}{children}</span>; }

export function ImageWithFallback({ alt, className = "", ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const [failed, setFailed] = useState(false);
  return failed ? <div role="img" aria-label={alt} className={`image-fallback ${className}`}><span>GuideMyTrip</span></div> : <img {...props} alt={alt} className={className} onError={() => setFailed(true)} loading="lazy" />;
}

export function SectionHeading({ eyebrow, title, description, align = "left" }: { eyebrow: string; title: string; description?: string; align?: "left" | "center" }) { return <div className={`max-w-2xl ${align === "center" ? "mx-auto text-center" : ""}`}><p className="eyebrow">{eyebrow}</p><h2 className="section-title">{title}</h2>{description && <p className="mt-4 text-base leading-7 text-ink-muted">{description}</p>}</div>; }

export function LoadingSkeleton({ className = "" }: { className?: string }) { return <div aria-label="Loading" className={`animate-pulse rounded-2xl bg-sand/70 ${className}`} />; }
