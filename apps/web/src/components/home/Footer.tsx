export type FooterProps = {
  disclaimer: string;
  privacyLabel: string;
  privacyHref: string;
  termsLabel: string;
  termsHref: string;
};

export function Footer({ disclaimer, privacyLabel, privacyHref, termsLabel, termsHref }: FooterProps) {
  return (
    <footer className="grid gap-3 border-t border-pf-border-subtle pt-4 text-xs leading-5 text-pf-text-muted md:grid-cols-[minmax(0,1fr)_auto] md:items-start md:gap-6">
      <p className="max-w-[42rem]">{disclaimer}</p>
      <nav aria-label="Legal" className="flex flex-wrap items-center gap-x-4 gap-y-2 md:justify-end">
        <a
          className="text-pf-text-secondary underline-offset-4 transition-colors hover:text-pf-text-primary hover:underline focus-visible:text-pf-text-primary focus-visible:underline"
          href={privacyHref}
        >
          {privacyLabel}
        </a>
        <a
          className="text-pf-text-secondary underline-offset-4 transition-colors hover:text-pf-text-primary hover:underline focus-visible:text-pf-text-primary focus-visible:underline"
          href={termsHref}
        >
          {termsLabel}
        </a>
      </nav>
    </footer>
  );
}
