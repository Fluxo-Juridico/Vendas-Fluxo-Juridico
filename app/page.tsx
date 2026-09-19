export default function Home() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 32 }}>
      <section style={{ maxWidth: 820, width: "100%", padding: 40, border: "1px solid #243247", borderRadius: 24, background: "#111827" }}>
        <p style={{ margin: 0, opacity: .7, fontSize: 14, letterSpacing: 1.2, textTransform: "uppercase" }}>Projeto em implantação</p>
        <h1 style={{ fontSize: 48, margin: "16px 0 12px" }}>Fluxo Jurídico</h1>
        <p style={{ fontSize: 20, lineHeight: 1.6, opacity: .88 }}>Gestão jurídica pensada para escritórios previdenciários.</p>
        <div style={{ marginTop: 28, padding: 16, borderRadius: 14, background: "#182235" }}>
          Estrutura inicial publicada. Próximos módulos serão adicionados por etapas.
        </div>
      </section>
    </main>
  );
}
