let professorLogado = null;
let modoOrdenacao = "turma"; // "turma" ou "disciplina"

async function checkProfessor() {
  const { data: { user } } = await supabaseClient.auth.getUser();

  if (!user) {
    window.location.href = "index.html";
    return;
  }

  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "professor") {
    alert("Acesso restrito a professores.");
    window.location.href = "dashboard.html";
    return;
  }

  professorLogado = profile;

  const boasVindas = document.getElementById("boasVindas");
  if (boasVindas) {
    boasVindas.innerText = `Olá, ${profile.nome} 👋`;
  }

  // Verifica se é representante
  //Alterado 09_06
  const { data: representacao } = await supabaseClient
  .from("professor_turma")
  .select("id")
  .eq("professor_id", professorLogado.id)
  .eq("representante", true);

  if (representacao && representacao.length > 0) {

    const { data: turmaRepresentada } = await supabaseClient
      .from("professor_turma")
      .select("turma_id")
      .eq("professor_id", professorLogado.id)
      .eq("representante", true)
      .single();
  
    if (turmaRepresentada) {
      localStorage.setItem(
        "turma_representada",
        turmaRepresentada.turma_id
      );
    }
  }
  
  /* Função antiga que verificava se o professor é representante
  const { data: representacao } = await supabaseClient
    .from("professor_turma")
    .select("id")
    .eq("professor_id", professorLogado.id);
    */
  // 09_06 - Gerencia quem visualiza o botão da turma
  const cardGerenciarAlunos =
    document.getElementById("cardGerenciarAlunos");
  
  if (
    cardGerenciarAlunos &&
    representacao &&
    representacao.length > 0
  ) {
    cardGerenciarAlunos.style.display = "block";
  }

  const btnConselho = document.getElementById("btnConselho");
  if (btnConselho && (!representacao || representacao.length === 0)) {
    btnConselho.style.display = "none";
  }

  //09_06 mostra o botão do gerenciamento dos alunos da sala
  const btnAlunos = document.getElementById("btnAlunos");
  if (btnAlunos && (!representacao || representacao.length === 0)) {
    btnAlunos.style.display = "none";
  }
}

function normalizarTexto(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function extrairOrdemTurma(nomeTurma) {
  const texto = String(nomeTurma || "").trim();

  const anoMatch = texto.match(/^(\d+)[º°]?\s*ano/i);
  const letraMatch = texto.match(/\b([A-Z])\b/);
  const suffixMatch = texto.match(/-\s*(.+)$/);

  const ano = anoMatch ? parseInt(anoMatch[1], 10) : 999;
  const letra = letraMatch ? letraMatch[1] : "Z";
  const sufixo = suffixMatch ? suffixMatch[1].trim().toUpperCase() : "";

  return { ano, letra, sufixo };
}

function compararTurmas(nomeTurmaA, nomeTurmaB) {
  const a = extrairOrdemTurma(nomeTurmaA);
  const b = extrairOrdemTurma(nomeTurmaB);

  if (a.ano !== b.ano) return a.ano - b.ano;
  if (a.letra !== b.letra) return a.letra.localeCompare(b.letra, "pt-BR");
  return a.sufixo.localeCompare(b.sufixo, "pt-BR");
}

function ordenarDisciplinas(lista, modo = "turma") {
  return [...lista].sort((a, b) => {
    const turmaA = a.turmas?.nome || "";
    const turmaB = b.turmas?.nome || "";
    const disciplinaA = a.disciplinas?.nome || "";
    const disciplinaB = b.disciplinas?.nome || "";

    if (modo === "disciplina") {
      const compDisciplina = normalizarTexto(disciplinaA).localeCompare(
        normalizarTexto(disciplinaB),
        "pt-BR"
      );
      if (compDisciplina !== 0) return compDisciplina;

      const compTurma = compararTurmas(turmaA, turmaB);
      if (compTurma !== 0) return compTurma;

      return String(a.turmas?.ano || "").localeCompare(
        String(b.turmas?.ano || ""),
        "pt-BR"
      );
    }

    // padrão: ordenar por turma
    const compTurma = compararTurmas(turmaA, turmaB);
    if (compTurma !== 0) return compTurma;

    const compDisciplina = normalizarTexto(disciplinaA).localeCompare(
      normalizarTexto(disciplinaB),
      "pt-BR"
    );
    if (compDisciplina !== 0) return compDisciplina;

    return String(a.turmas?.ano || "").localeCompare(
      String(b.turmas?.ano || ""),
      "pt-BR"
    );
  });
}

function escaparParaHTML(texto) {
  return String(texto || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escaparParaJS(texto) {
  return String(texto || "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");
}

async function loadMinhasDisciplinas() {
  const { data, error } = await supabaseClient
    .from("professor_disciplina_turma")
    .select(`
      id,
      turma_id,
      disciplina_id,
      turmas ( nome, ano ),
      disciplinas ( nome )
    `)
    .eq("professor_id", professorLogado.id);

  if (error) {
    console.log(error);
    return;
  }

  const container = document.getElementById("listaDisciplinas");
  if (!container) return;

  container.innerHTML = "";

  if (!data || data.length === 0) {
    container.innerHTML = "<p>Você ainda não possui disciplinas vinculadas.</p>";
    return;
  }

  const dadosOrdenados = ordenarDisciplinas(data, modoOrdenacao);

  dadosOrdenados.forEach((item) => {
    const turmaNome = item.turmas?.nome || "";
    const turmaAno = item.turmas?.ano || "";
    const disciplinaNome = item.disciplinas?.nome || "";

    container.innerHTML += `
      <div class="d-flex justify-content-between align-items-center border p-3 mb-2 rounded">
        <div>
          <strong>${escaparParaHTML(turmaNome || "Turma")} - ${escaparParaHTML(turmaAno || "")}</strong><br>
          ${escaparParaHTML(disciplinaNome || "Disciplina")}
        </div>
        <button
          class="btn btn-primary"
          onclick="irParaLancamento(
            '${escaparParaJS(item.turma_id)}',
            '${escaparParaJS(item.disciplina_id)}',
            '${escaparParaJS(turmaNome)}',
            '${escaparParaJS(disciplinaNome)}'
          )"
        >
          Lançar Notas
        </button>
      </div>
    `;
  });
}

function alterarOrdenacao() {
  const select = document.getElementById("ordenacaoSelect");
  if (!select) return;

  modoOrdenacao = select.value;
  loadMinhasDisciplinas();
}

function irParaLancamento(turmaId, disciplinaId, turmaNome, disciplinaNome) {
  localStorage.setItem("turma_id", turmaId);
  localStorage.setItem("disciplina_id", disciplinaId);
  localStorage.setItem("turma_nome", turmaNome);
  localStorage.setItem("disciplina_nome", disciplinaNome);

  window.location.href = "lancamento-notas.html";
}

async function logout() {
  await supabaseClient.auth.signOut();
  window.location.href = "index.html";
}

function abrirLancamento() {
  const menuPrincipal = document.getElementById("menuPrincipal");
  const areaDisciplinas = document.getElementById("areaDisciplinas");

  if (menuPrincipal) menuPrincipal.style.display = "none";
  if (areaDisciplinas) areaDisciplinas.style.display = "block";
}

function voltarMenu() {
  const menuPrincipal = document.getElementById("menuPrincipal");
  const areaDisciplinas = document.getElementById("areaDisciplinas");

  if (menuPrincipal) menuPrincipal.style.display = "block";
  if (areaDisciplinas) areaDisciplinas.style.display = "none";
}

function irParaConselho() {
  window.location.href = "conselho.html";
}

//Função para carregar a tela de gerenciamento dos alunos da turma do professor representante
function irParaGerenciarAlunos() {
  window.location.href = "alunos-turma.html";
}

document.addEventListener("DOMContentLoaded", async () => {
  await checkProfessor();
  await loadMinhasDisciplinas();

  const selectOrdenacao = document.getElementById("ordenacaoSelect");
  if (selectOrdenacao) {
    selectOrdenacao.value = modoOrdenacao;
    selectOrdenacao.addEventListener("change", alterarOrdenacao);
  }
});
