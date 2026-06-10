let professorAtual = null;

console.log("ALUNOS-TURMA CARREGADO");

async function carregarPagina() {

  console.log("ENTROU EM carregarPagina");

  let professorAtual = null;
  let turmaRepresentada = null;
  
  async function carregarPagina() {
  
    console.log("PASSO 1");
  
    const {
      data: { user }
    } = await supabaseClient.auth.getUser();
  
    console.log("PASSO 2", user);
  
    if (!user) {
      window.location.href = "index.html";
      return;
    }
  
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
  
    console.log("PASSO 3", profile);
  
    professorAtual = profile;
  
    console.log("PASSO 4");
  
    // Busca a turma representada pelo professor
    const { data: representacao, error } = await supabaseClient
      .from("professor_turma")
      .select("*")
      .eq("professor_id", professorAtual.id)
      .eq("representante", true);
    
    console.log("REPRESENTAÇÃO:", representacao);
    console.log("ERRO:", error);
    
    document.getElementById("tituloTurma").innerText =
    JSON.stringify(representacao);
  
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
