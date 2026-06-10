let professorAtual = null;
let turmaRepresentada = null;
let turmaRepresentadaNome = "";

async function carregarPagina() {

  const {
    data: { user }
  } = await supabaseClient.auth.getUser();

  if (!user) {
    window.location.href = "index.html";
    return;
  }

  const { data: profile, error: erroProfile } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    document.getElementById("tituloTurma").innerText =
      "Perfil não encontrado.";
    return;
  }

  professorAtual = profile;
  
  const { data: representacao, error } = await supabaseClient
    .from("professor_turma")
    .select("*")
    .eq("professor_id", professorAtual.id)
    .eq("representante", true);

  const turmaId = representacao[0].turma_id;
  turmaRepresentada = turmaId;
  
  const { data: turma, error: erroTurma } = await supabaseClient
    .from("turmas")
    .select("id, nome, ano")
    .eq("id", turmaId)
    .single();
  
  if (turma) {
  
    turmaRepresentadaNome =
      `${turma.nome} - ${turma.ano}`;
  
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

function abrirModalNovoAlunoRepresentante() {

  abrirModalNovoAluno();

  setTimeout(() => {

    const selectTurma =
      document.getElementById("novoAlunoTurma");

    if (!selectTurma) return;

    selectTurma.disabled = false;

    selectTurma.innerHTML = `
      <option value="${turmaRepresentada}">
        ${turmaRepresentadaNome}
      </option>
    `;

    selectTurma.value = turmaRepresentada;
    selectTurma.disabled = true;

  }, 100);

}

document.addEventListener(
  "DOMContentLoaded",
  carregarPagina
);
