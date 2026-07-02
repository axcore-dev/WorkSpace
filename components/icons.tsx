import type { SVGProps } from "react";

/**
 * Lucide-style stroke icons (24x24, stroke=currentColor).
 * 이모지 대신 SVG 아이콘만 사용한다.
 */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base(
  { size = 20, ...props }: IconProps,
  children: React.ReactNode,
) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconDashboard = (p: IconProps) =>
  base(p, <>
    <rect width="7" height="9" x="3" y="3" rx="1" />
    <rect width="7" height="5" x="14" y="3" rx="1" />
    <rect width="7" height="9" x="14" y="12" rx="1" />
    <rect width="7" height="5" x="3" y="16" rx="1" />
  </>);

export const IconGrid = (p: IconProps) =>
  base(p, <>
    <rect width="7" height="7" x="3" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="14" rx="1" />
    <rect width="7" height="7" x="3" y="14" rx="1" />
  </>);

export const IconChat = (p: IconProps) =>
  base(p, <>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    <path d="M8 9h8" />
    <path d="M8 13h5" />
  </>);

export const IconActivity = (p: IconProps) =>
  base(p, <path d="M22 12h-4l-3 9L9 3l-3 9H2" />);

export const IconSettings = (p: IconProps) =>
  base(p, <>
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </>);

export const IconUser = (p: IconProps) =>
  base(p, <>
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </>);

export const IconUsers = (p: IconProps) =>
  base(p, <>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </>);

export const IconBell = (p: IconProps) =>
  base(p, <>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </>);

export const IconSearch = (p: IconProps) =>
  base(p, <>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </>);

export const IconPlus = (p: IconProps) =>
  base(p, <>
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </>);

export const IconUpload = (p: IconProps) =>
  base(p, <>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" x2="12" y1="3" y2="15" />
  </>);

export const IconDownload = (p: IconProps) =>
  base(p, <>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" x2="12" y1="15" y2="3" />
  </>);

export const IconFile = (p: IconProps) =>
  base(p, <>
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    <path d="M16 13H8" />
    <path d="M16 17H8" />
    <path d="M10 9H8" />
  </>);

export const IconFolder = (p: IconProps) =>
  base(p, <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />);

export const IconChevronDown = (p: IconProps) => base(p, <path d="m6 9 6 6 6-6" />);
export const IconChevronRight = (p: IconProps) => base(p, <path d="m9 18 6-6-6-6" />);
export const IconChevronLeft = (p: IconProps) => base(p, <path d="m15 18-6-6 6-6" />);
export const IconCheck = (p: IconProps) => base(p, <path d="M20 6 9 17l-5-5" />);

export const IconX = (p: IconProps) =>
  base(p, <>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </>);

export const IconAlertTriangle = (p: IconProps) =>
  base(p, <>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </>);

export const IconAlertCircle = (p: IconProps) =>
  base(p, <>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" x2="12" y1="8" y2="12" />
    <line x1="12" x2="12.01" y1="16" y2="16" />
  </>);

export const IconInfo = (p: IconProps) =>
  base(p, <>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </>);

export const IconClock = (p: IconProps) =>
  base(p, <>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </>);

export const IconCalendar = (p: IconProps) =>
  base(p, <>
    <path d="M8 2v4" />
    <path d="M16 2v4" />
    <rect width="18" height="18" x="3" y="4" rx="2" />
    <path d="M3 10h18" />
  </>);

export const IconLogOut = (p: IconProps) =>
  base(p, <>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" x2="9" y1="12" y2="12" />
  </>);

export const IconShield = (p: IconProps) =>
  base(p, <>
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    <path d="m9 12 2 2 4-4" />
  </>);

export const IconKey = (p: IconProps) =>
  base(p, <>
    <path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z" />
    <circle cx="16.5" cy="7.5" r=".5" fill="currentColor" />
  </>);

export const IconLock = (p: IconProps) =>
  base(p, <>
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </>);

export const IconLink = (p: IconProps) =>
  base(p, <>
    <path d="M9 17H7A5 5 0 0 1 7 7h2" />
    <path d="M15 7h2a5 5 0 1 1 0 10h-2" />
    <line x1="8" x2="16" y1="12" y2="12" />
  </>);

export const IconRefresh = (p: IconProps) =>
  base(p, <>
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M8 16H3v5" />
  </>);

export const IconSparkles = (p: IconProps) =>
  base(p, <>
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    <path d="M5 3v4" />
    <path d="M19 17v4" />
    <path d="M3 5h4" />
    <path d="M17 19h4" />
  </>);

export const IconSend = (p: IconProps) =>
  base(p, <>
    <path d="m22 2-7 20-4-9-9-4Z" />
    <path d="M22 2 11 13" />
  </>);

export const IconPaperclip = (p: IconProps) =>
  base(p, <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />);

export const IconEye = (p: IconProps) =>
  base(p, <>
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </>);

export const IconPencil = (p: IconProps) =>
  base(p, <>
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    <path d="m15 5 4 4" />
  </>);

export const IconFilter = (p: IconProps) =>
  base(p, <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />);

export const IconBuilding = (p: IconProps) =>
  base(p, <>
    <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
    <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
    <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
    <path d="M10 6h4" />
    <path d="M10 10h4" />
    <path d="M10 14h4" />
    <path d="M10 18h4" />
  </>);

export const IconFactory = (p: IconProps) =>
  base(p, <>
    <path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
    <path d="M17 18h1" />
    <path d="M12 18h1" />
    <path d="M7 18h1" />
  </>);

export const IconWrench = (p: IconProps) =>
  base(p, <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />);

export const IconCpu = (p: IconProps) =>
  base(p, <>
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <rect x="9" y="9" width="6" height="6" />
    <path d="M15 2v2" />
    <path d="M15 20v2" />
    <path d="M2 15h2" />
    <path d="M2 9h2" />
    <path d="M20 15h2" />
    <path d="M20 9h2" />
    <path d="M9 2v2" />
    <path d="M9 20v2" />
  </>);

export const IconZap = (p: IconProps) =>
  base(p, <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />);

export const IconDatabase = (p: IconProps) =>
  base(p, <>
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5v14a9 3 0 0 0 18 0V5" />
    <path d="M3 12a9 3 0 0 0 18 0" />
  </>);

export const IconArrowRight = (p: IconProps) =>
  base(p, <>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </>);

export const IconArrowUpRight = (p: IconProps) =>
  base(p, <>
    <path d="M7 7h10v10" />
    <path d="M7 17 17 7" />
  </>);

export const IconArrowDownRight = (p: IconProps) =>
  base(p, <>
    <path d="m7 7 10 10" />
    <path d="M17 7v10H7" />
  </>);

export const IconExternalLink = (p: IconProps) =>
  base(p, <>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" x2="21" y1="14" y2="3" />
  </>);

export const IconTrendingUp = (p: IconProps) =>
  base(p, <>
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <polyline points="16 7 22 7 22 13" />
  </>);

export const IconHeadset = (p: IconProps) =>
  base(p, <>
    <path d="M3 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    <path d="M21 11h-3a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2Z" />
    <path d="M21 13v-2a9 9 0 0 0-18 0v2" />
    <path d="M21 16v2a3 3 0 0 1-3 3h-4" />
  </>);

export const IconClipboardCheck = (p: IconProps) =>
  base(p, <>
    <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <path d="m9 14 2 2 4-4" />
  </>);

export const IconCompass = (p: IconProps) =>
  base(p, <>
    <path d="m12.99 6.74 1.93 3.44" />
    <path d="M19.136 12a10 10 0 0 1-14.271 0" />
    <path d="m21 21-2.16-3.84" />
    <path d="m3 21 8.02-14.26" />
    <circle cx="12" cy="5" r="2" />
  </>);

export const IconTruck = (p: IconProps) =>
  base(p, <>
    <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
    <path d="M15 18H9" />
    <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
    <circle cx="17" cy="18" r="2" />
    <circle cx="7" cy="18" r="2" />
  </>);

export const IconBriefcase = (p: IconProps) =>
  base(p, <>
    <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    <rect width="20" height="14" x="2" y="6" rx="2" />
  </>);

export const IconGauge = (p: IconProps) =>
  base(p, <>
    <path d="m12 14 4-4" />
    <path d="M3.34 19a10 10 0 1 1 17.32 0" />
  </>);

export const IconMail = (p: IconProps) =>
  base(p, <>
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </>);

export const IconHash = (p: IconProps) =>
  base(p, <>
    <line x1="4" x2="20" y1="9" y2="9" />
    <line x1="4" x2="20" y1="15" y2="15" />
    <line x1="10" x2="8" y1="3" y2="21" />
    <line x1="16" x2="14" y1="3" y2="21" />
  </>);

export const IconHistory = (p: IconProps) =>
  base(p, <>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M12 7v5l4 2" />
  </>);

export const IconCheckCircle = (p: IconProps) =>
  base(p, <>
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  </>);

export const IconXCircle = (p: IconProps) =>
  base(p, <>
    <circle cx="12" cy="12" r="10" />
    <path d="m15 9-6 6" />
    <path d="m9 9 6 6" />
  </>);

export const IconThermometer = (p: IconProps) =>
  base(p, <path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z" />);

export const IconLayers = (p: IconProps) =>
  base(p, <>
    <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
    <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
    <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
  </>);

export const IconWorkflow = (p: IconProps) =>
  base(p, <>
    <rect width="8" height="8" x="3" y="3" rx="2" />
    <path d="M7 11v4a2 2 0 0 0 2 2h4" />
    <rect width="8" height="8" x="13" y="13" rx="2" />
  </>);

export const IconBot = (p: IconProps) =>
  base(p, <>
    <path d="M12 8V4H8" />
    <rect width="16" height="12" x="4" y="8" rx="2" />
    <path d="M2 14h2" />
    <path d="M20 14h2" />
    <path d="M15 13v2" />
    <path d="M9 13v2" />
  </>);

export const IconScanText = (p: IconProps) =>
  base(p, <>
    <path d="M3 7V5a2 2 0 0 1 2-2h2" />
    <path d="M17 3h2a2 2 0 0 1 2 2v2" />
    <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
    <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
    <path d="M7 8h8" />
    <path d="M7 12h10" />
    <path d="M7 16h6" />
  </>);

export const IconHardDrive = (p: IconProps) =>
  base(p, <>
    <line x1="22" x2="2" y1="12" y2="12" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    <line x1="6" x2="6.01" y1="16" y2="16" />
    <line x1="10" x2="10.01" y1="16" y2="16" />
  </>);

export const IconMoreHorizontal = (p: IconProps) =>
  base(p, <>
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
    <circle cx="5" cy="12" r="1" />
  </>);

export const IconLogo = ({ size = 24, ...props }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    {...props}
  >
    <rect width="24" height="24" rx="6" fill="currentColor" />
    <path
      d="M6.5 17.5 12 6l5.5 11.5"
      stroke="#fff"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <circle cx="12" cy="14.2" r="1.6" fill="#fff" />
  </svg>
);

/** 문자열 키 → 아이콘 컴포넌트 (data 레이어에서 아이콘을 문자열로 참조하기 위함) */
export const ICON_MAP = {
  dashboard: IconDashboard,
  grid: IconGrid,
  chat: IconChat,
  activity: IconActivity,
  settings: IconSettings,
  briefcase: IconBriefcase,
  compass: IconCompass,
  factory: IconFactory,
  wrench: IconWrench,
  clipboardCheck: IconClipboardCheck,
  truck: IconTruck,
  trendingUp: IconTrendingUp,
  headset: IconHeadset,
  users: IconUsers,
  layers: IconLayers,
  cpu: IconCpu,
  database: IconDatabase,
  mail: IconMail,
  hash: IconHash,
  file: IconFile,
  folder: IconFolder,
  calendar: IconCalendar,
  hardDrive: IconHardDrive,
  zap: IconZap,
  gauge: IconGauge,
  shield: IconShield,
  bot: IconBot,
} as const;

export type IconKey = keyof typeof ICON_MAP;
