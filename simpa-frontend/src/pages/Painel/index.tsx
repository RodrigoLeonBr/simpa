function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <section className="placeholder-page card">
      <h1>{title}</h1>
      <p>{description}</p>
    </section>
  );
}

export default function PainelPage() {
  return (
    <PlaceholderPage
      title="Painel"
      description="Layouts A/B/C serão implementados nas próximas tasks."
    />
  );
}
