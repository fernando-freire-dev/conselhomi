let professorAtual = null;

async function carregarPagina() {

  let professorAtual = null;
  let turmaRepresentada = null;
  
  async function carregarPagina() {
  
    const {
      data: { user }
    } = await supabaseClient.auth.getUser();
  
    if (!user) {
      window.location.href = "index.html";
      return;
    }
  
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
  
    professorAtual = profile;
  
    // Busca a turma representada pelo professor
    const { data: representacao, error } = await supabaseClient
      .from("professor_turma")
      .select(`
        turma_id,
        turmas (
          id,
          nome,
          ano
        )
      `)
      .eq("professor_id", professorAtual.id)
      .eq("representante", true)
      .single();
  
    if (error || !representacao) {
  
      document.getElementById("tituloTurma").innerText =
        "Você não é representante de nenhuma turma.";
  
      return;
    }
  
    turmaRepresentada = representacao;
  
    document.getElementById("tituloTurma").innerText =
      `Turma: ${representacao.turmas.nome} - ${representacao.turmas.ano}`;
}

document.addEventListener(
  "DOMContentLoaded",
  carregarPagina
);
}

document.addEventListener(
  "DOMContentLoaded",
  carregarPagina
);
