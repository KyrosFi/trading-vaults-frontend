const LEGAL_LINKS = [
  { label: "Terms & Conditions", href: "/legal/terms-and-conditions.pdf" },
  { label: "Website Terms of Use", href: "/legal/website-terms-of-use.pdf" },
];

export function AppFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-6 py-6 sm:flex-row">
        <span className="text-sm text-muted-foreground">© 2026 Kyros</span>
        <nav className="flex items-center gap-6">
          {LEGAL_LINKS.map(({ label, href }) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="whitespace-nowrap text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
