export function Icon({
  name = 'mountain',
  size = 20,
}: {
  name?: string;
  size?: number;
}) {
  const paths: Record<string, string> = {
    sortAsc: 'M8 20V4M4 8l4-4 4 4M14 5h3M14 10h5M14 15h7',
    sort: 'M8 4v16M4 16l4 4 4-4M14 5h7M14 10h5M14 15h3',
    edit: 'm15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14z',
    fork: 'M5 3v9a7 7 0 0 0 7 7h5M5 5h12M20 5a2 2 0 1 1-4 0 2 2 0 0 1 4 0M21 19a2 2 0 1 1-4 0 2 2 0 0 1 4 0',
    archive: 'M4 4h16v5H4zM5 9v11h14V9M9 13h6',
    mountain: 'M2 19 9 5l4 8 3-5 6 11H2M6 11l3 2 3-2',
    search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
    compare: 'M8 3v18M16 3v18M3 7h5M16 17h5M5 5l-2 2 2 2M19 15l2 2-2 2',
    book: 'M4 3h13a3 3 0 0 1 3 3v15H6a2 2 0 0 1-2-2V3M4 17h16M8 7h8M8 11h6',
    upload: 'M12 16V3M7 8l5-5 5 5M4 15v6h16v-6',
    pin: 'M12 22s8-8 8-14a8 8 0 0 0-16 0c0 6 8 14 8 14M15 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
    arrow: 'M4 12h16M14 6l6 6-6 6',
    check: 'M4 12l5 5L20 6',
    close: 'M5 5l14 14M19 5 5 19',
    calendar: 'M4 5h16v16H4zM4 10h16M8 2v6M16 2v6',
    save: 'M5 3h14v19l-7-5-7 5V3',
    info: 'M12 10v7M12 6v1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.mountain} />
    </svg>
  );
}

export function Mountain() {
  return (
    <svg
      className="mountain-art"
      viewBox="0 0 660 260"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M0 242 106 115 151 172 269 22 332 110 390 69 548 245"
        fill="#dfe9e8"
      />
      <path d="m84 260 185-238 41 104 47 27 76 107" fill="#91a9a5" />
      <path
        d="m171 146 98-124 41 104-32-17-26 28-18-14-31 37z"
        fill="#f8fbf9"
      />
      <path d="M267 260 390 69l126 153 53-90 91 128" fill="#becdc8" />
      <path d="m352 128 38-59 49 59-28-8-18 19-16-25z" fill="#f8fbf9" />
      <path
        d="M0 260 84 223l75 26 129-33 101 22 120-23 151 27v18"
        fill="#718e86"
      />
      <path
        d="m57 260 138-51 62 10 90-27 83 15 62-30"
        stroke="#e7f0e8"
        strokeWidth="2"
        strokeDasharray="5 6"
      />
      <circle
        cx="347"
        cy="192"
        r="6"
        fill="#e8a156"
        stroke="#fff"
        strokeWidth="3"
      />
      <circle
        cx="492"
        cy="177"
        r="5"
        fill="#e8a156"
        stroke="#fff"
        strokeWidth="3"
      />
    </svg>
  );
}
