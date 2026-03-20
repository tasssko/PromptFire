export function TrustRow({ content }: { content: typeof import('./content').trustRowContent }) {
  return (
    <section className="grid gap-3 border-t border-pf-border-subtle pt-4 md:grid-cols-3 md:gap-4">
      {content.items.map((item) => (
        <article key={item.title} className="grid gap-1 rounded-lg px-1 py-1">
          <h2 className="text-sm font-semibold text-pf-text-primary">{item.title}</h2>
          <p className="text-sm leading-5 text-pf-text-secondary">{item.body}</p>
        </article>
      ))}
    </section>
  );
}
