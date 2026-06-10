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
  turmaRepresentada = turmaId;
  const { data: turma, error: erroTurma } = await supabaseClient
    .from("turmas")
    .select("id, nome, ano")
    .eq("id", turmaId)
    .single();
  
  console.log("TURMA:", turma);
  console.log("ERRO TURMA:", erroTurma);
  
  console.log("ERRO:", error);

  if (turma) {
    document.getElementById("tituloTurma").innerText =
      `Turma: ${turma.nome} - ${turma.ano}`;
    
  await loadAlunos();
  }
}

let alunosTurma = [];

async function loadAlunos() {

  const { data, error } = await supabaseClient
    .from("alunos")
    .select("id, nome, numero_chamada, situacao")
    .eq("turma_id", turmaRepresentada)
    .eq("situacao", "ativo")
    .order("numero_chamada", { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  alunosTurma = data || [];

  renderAlunos();
}

function renderAlunos() {

  const lista = document.getElementById("listaAlunos");

  if (!alunosTurma.length) {
    lista.innerHTML =
      `<p class="text-muted">Nenhum aluno encontrado.</p>`;
    return;
  }

  lista.innerHTML = `
    <table class="table table-bordered align-middle">
      <thead class="table-light">
        <tr>
          <th style="width:60px">Nº</th>
          <th>Nome</th>
          <th style="width:130px">RA</th>
          <th style="width:120px">Situação</th>
        </tr>
      </thead>
      <tbody>
        ${alunosTurma.map(a => `
          <tr>
            <td>${a.numero_chamada ?? "-"}</td>
            <td>${a.nome}</td>
            <td>${a.id}</td>
            <td>${a.situacao}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

document.addEventListener(
  "DOMContentLoaded",
  carregarPagina
);
