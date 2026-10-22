import Image from "next/image";

// Het logo van House of Digital, wit op de donkere ondergrond.
export default function HodLogo({ className = "h-6" }) {
  return <Image src="/hod-logo-white.png" alt="House of Digital" width={800} height={400} className={`${className} w-auto`} />;
}
