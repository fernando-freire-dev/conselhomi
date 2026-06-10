let professorAtual = null;
let turmaRepresentada = null;

console.log("ALUNOS-TURMA CARREGADO");

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

  const { data: profile, error: erroProfile } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  console.log("PASSO 3", profile);
  console.log("ERRO PROFILE:", erroProfile);

  if (!profile) {
    document.getElementById("tituloTurma").innerText =
      "Perfil não encontrado.";
    return;
  }

  professorAtual = profile;

  console.log("PASSO 4");

  const { data: representacao, error } = await supabaseClient
    .from("professor_turma")
    .select("*")
    .eq("professor_id", professorAtual.id)
    .eq("representante", true);

  console.log("PASSO 5");
  console.log("REPRESENTAÇÃO:", representacao);
  const turmaId = representacao[0].turma_id;
  const { data: turma, error: erroTurma } = await supabaseClient
    .from("turmas")
    .select("id, nome, ano")
    .eq("id", turmaId)
    .single();
  
  console.log("TURMA:", turma);
  console.log("ERRO TURMA:", erroTurma);
  
  console.log("ERRO:", error);

  document.getElementById("tituloTurma").innerText =
    JSON.stringify(representacao);
}

document.addEventListener(
  "DOMContentLoaded",
  carregarPagina
);
