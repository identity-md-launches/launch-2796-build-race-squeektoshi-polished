export function Icon({ name, size = 20, className = '' }: { name: string; size?: number; className?: string }) {
  const paths: Record<string, string> = {
    arrow: 'M4 12h15m-6-6 6 6-6 6', chevron: 'm8 4 8 8-8 8', moon: 'M19 15a8 8 0 0 1-10-10A8 8 0 1 0 19 15Z',
    ghost: 'M5 20V9a7 7 0 0 1 14 0v11l-4-3-3 3-3-3-4 3Zm4-11v3m6-3v3',
    bolt: 'm14 2-9 12h7l-2 8 9-12h-7l2-8Z', target: 'M20 12a8 8 0 1 1-8-8m0 8 9-9m-1 5 1-5-5 1M8 12a4 4 0 1 0 4-4',
    trophy: 'M7 3h10v7a5 5 0 0 1-10 0V3Zm10 2h4v3a4 4 0 0 1-4 4M7 5H3v3a4 4 0 0 0 4 4m5 3v6m-4 0h8',
    flag: 'M5 22V3h14l-3 5 3 5H5', clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    user: 'M5 21v-3a7 7 0 0 1 14 0v3M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
    help: 'M9 9a3 3 0 1 1 4 3v3m0 2v1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    muted: 'M10 5 5 9H2v6h3l5 4V5Zm5 4 6 6m0-6-6 6', speaker: 'M10 5 5 9H2v6h3l5 4V5Zm5 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',
    music: 'M9 17V5l11-2v12M9 17a3 3 0 1 1-3-3h3m11 1a3 3 0 1 1-3-3h3M9 8l11-2',
    star: 'm12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z', spark: 'm12 2 2 7 7 3-7 2-2 8-3-8-7-2 7-3 3-7Z',
    wheel: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-9v18M3 12h18M6 6l12 12M6 18 18 6',
    route: 'M5 3v3m0 4v4m0 4v3m7-18v18m7-18v3m0 4v4m0 4v3',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
    check: 'm4 12 5 5L20 6', close: 'm6 6 12 12M18 6 6 18', pause: 'M8 5v14M16 5v14', play: 'm7 4 14 8-14 8V4Z', retry: 'M3 9a9 9 0 1 1 0 6m0-12v6h6', lock: 'M6 10h12v11H6V10Zm3 0V6a3 3 0 0 1 6 0v4m-3 4v3', copy: 'M8 8h13v13H8V8ZM4 16H2V2h14v2', heart: 'm12 21-9-9a6 6 0 0 1 9-8 6 6 0 0 1 9 8l-9 9Z',
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true" className={className}><path d={paths[name] ?? paths.star} /></svg>;
}
export function HamsterMark() { return <svg viewBox="0 0 32 32" width="32" height="32" fill="none" aria-hidden="true" shapeRendering="crispEdges"><path fill="#d48a36" d="M6 6h7v3h6V6h7v10h3v10h-4v3H7v-3H3V16h3z"/><path fill="#ffd16b" d="M8 8h3v7h10V8h3v9h3v7h-4v3H9v-3H5v-7h3z"/><path fill="#f7e5bc" d="M11 19h10v7H11z"/><path fill="#171a16" d="M10 16h3v3h-3zm9 0h3v3h-3zm-4 5h3v3h-3z"/><path fill="#e68d71" d="M7 20h3v3H7zm15 0h3v3h-3z"/></svg>; }
