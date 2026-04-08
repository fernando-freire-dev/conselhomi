// ============================================================
// js/modals.js — Carrega modals.html e gerencia modais globais
// Incluir em todos os HTMLs APÓS o bootstrap.bundle.min.js
// e APÓS js/supabase.js.
// ============================================================

/*(async function carregarModais() {
  try {
    const resp = await fetch("modals.html");
    if (!resp.ok) throw new Error("modals.html não encontrado");
    const html = await resp.text();

    const container = document.createElement("div");
    container.id = "globalModals";
    container.innerHTML = html;
    document.body.appendChild(container);
  } catch (err) {
    console.warn("modals.js: não foi possível carregar modals.html →", err.message);
  }
})();
-------------	Antigo Carregar Modals	-----------------
*/

let alunoAtualIndex = -1;
let contextoSelecaoAtual = null;

const selecoesModal = {
  dificuldade: [],
  sala: [],
  plataforma: []
};

function textoParaLista(texto) {
  if (!texto) return [];
  return texto.split(",").map(t => t.trim()).filter(Boolean);
}

function atualizarResumoSelecao(tipo) {
  const mapa = {
    dificuldade: "resumoDificuldade",
    sala: "resumoSala",
    plataforma: "resumoPlataforma"
  };

  const el = document.getElementById(mapa[tipo]);
  if (!el) return;

  const lista = selecoesModal[tipo] || [];

  if (lista.length === 0) {
    el.textContent = "Nenhuma disciplina selecionada";
    return;
  }

  if (lista.length <= 3) {
    el.textContent = lista.join(", ");
    return;
  }

  el.textContent = `${lista.length} disciplinas selecionadas`;
}

function alternarAreaPorRadio(nomeRadio, areaId, valorQueMostra = "true") {
  const selecionado = document.querySelector(`input[name="${nomeRadio}"]:checked`);
  const area = document.getElementById(areaId);
  if (!area) return;

  area.classList.toggle("d-none", !selecionado || selecionado.value !== valorQueMostra);
}

function montarListaDisciplinasSelecao(tipo) {
  const listaEl = document.getElementById("modalSelecionarDisciplinasLista");
  if (!listaEl) return;

  const disciplinas = window.cacheDisciplinas || [];
  const selecionadas = selecoesModal[tipo] || [];

  if (!disciplinas.length) {
    listaEl.innerHTML = `<div class="text-muted">Nenhuma disciplina encontrada.</div>`;
    return;
  }

  listaEl.innerHTML = disciplinas.map((disc, i) => {
    const checked = selecionadas.includes(disc.nome) ? "checked" : "";
    return `
      <div class="form-check mb-2">
        <input class="form-check-input chk-disciplina-selecao" type="checkbox"
          id="disc_${tipo}_${i}" value="${disc.nome}" ${checked}>
        <label class="form-check-label" for="disc_${tipo}_${i}">
          ${disc.nome}
        </label>
      </div>
    `;
  }).join("");
}

function abrirModalSelecaoDisciplinas(tipo, titulo) {
  contextoSelecaoAtual = tipo;

  const tituloEl = document.getElementById("modalSelecionarDisciplinasTitulo");
  if (tituloEl) tituloEl.textContent = titulo;

  montarListaDisciplinasSelecao(tipo);

  bootstrap.Modal.getOrCreateInstance(
    document.getElementById("modalSelecionarDisciplinas")
  ).show();
}

//Antigo inicio do arquivo
(async function carregarModais() {
  try {
    const resp = await fetch("modals.html");
    if (!resp.ok) throw new Error("modals.html não encontrado");
    const html = await resp.text();

    const container = document.createElement("div");
    container.id = "globalModals";
    container.innerHTML = html;
    document.body.appendChild(container);

    document.dispatchEvent(new CustomEvent("modalsLoaded"));
  } catch (err) {
    console.warn("modals.js: não foi possível carregar modals.html →", err.message);
  }
})();

// ── Modal: Alterar Senha ─────────────────────────────────────

let modalSenhaInstance = null;

function abrirModalSenha() {
  // Garante que o modal já foi injetado no DOM
  const modalEl = document.getElementById("modalAlterarSenha");
  if (!modalEl) {
    console.warn("Modal de senha ainda não foi carregado no DOM.");
    return;
  }

  document.getElementById("senhaAtual").value        = "";
  document.getElementById("senhaNova").value         = "";
  document.getElementById("senhaNovaConfirm").value  = "";
  document.getElementById("feedbackSenha").innerHTML = "";

  if (!modalSenhaInstance) {
    modalSenhaInstance = new bootstrap.Modal(modalEl);
  }
  modalSenhaInstance.show();
}

function toggleSenhaModal(inputId) {
  const input = document.getElementById(inputId);
  if (input) input.type = input.type === "password" ? "text" : "password";
}

async function salvarNovaSenha() {
  const senhaAtual   = document.getElementById("senhaAtual").value;
  const senhaNova    = document.getElementById("senhaNova").value;
  const senhaConfirm = document.getElementById("senhaNovaConfirm").value;
  const feedback     = document.getElementById("feedbackSenha");
  const btn          = document.getElementById("btnSalvarSenha");
  const btnTexto     = document.getElementById("btnSalvarSenhaTexto");
  const spinner      = document.getElementById("btnSalvarSenhaSpinner");

  feedback.innerHTML = "";

  if (!senhaAtual || !senhaNova || !senhaConfirm) {
    feedback.innerHTML = `<div class="alert alert-warning py-2">Preencha todos os campos.</div>`;
    return;
  }

  if (senhaNova.length < 6) {
    feedback.innerHTML = `<div class="alert alert-warning py-2">A nova senha precisa ter no mínimo 6 caracteres.</div>`;
    return;
  }

  if (senhaNova !== senhaConfirm) {
    feedback.innerHTML = `<div class="alert alert-warning py-2">A confirmação de senha não confere.</div>`;
    return;
  }

  btn.disabled = true;
  btnTexto.textContent = "Salvando...";
  spinner.classList.remove("d-none");

  try {
    // Reautentica com a senha atual para garantir que é o próprio usuário
    const { data: { user } } = await supabaseClient.auth.getUser();
    const { error: reAuthErr } = await supabaseClient.auth.signInWithPassword({
      email: user.email,
      password: senhaAtual,
    });

    if (reAuthErr) {
      feedback.innerHTML = `<div class="alert alert-danger py-2">Senha atual incorreta.</div>`;
      return;
    }

    // Atualiza para a nova senha
    const { error: updateErr } = await supabaseClient.auth.updateUser({
      password: senhaNova,
    });

    if (updateErr) {
      feedback.innerHTML = `<div class="alert alert-danger py-2">Erro ao atualizar senha: ${updateErr.message}</div>`;
      return;
    }

    feedback.innerHTML = `<div class="alert alert-success py-2">Senha alterada com sucesso!</div>`;

    setTimeout(() => {
      modalSenhaInstance?.hide();
    }, 1500);

  } catch (err) {
    feedback.innerHTML = `<div class="alert alert-danger py-2">Erro inesperado: ${err.message}</div>`;
  } finally {
    btn.disabled = false;
    btnTexto.textContent = "Salvar";
    spinner.classList.add("d-none");
  }
}

// ── Adicione funções de novos modais globais abaixo desta linha ──


// ── Gestão de Alunos (Dashboard Coordenação) ─────────────────

let todosAlunos = [];
let turmasParaAlunos = [];
let modalNovoAlunoInstance = null;

// Carrega turmas no select da aba e no modal
async function carregarTurmasAlunos() {
  const { data, error } = await supabaseClient
    .from("turmas")
    .select("id, nome, ano")
    .order("nome", { ascending: true });

  if (error) { console.log(error); return; }

  turmasParaAlunos = data || [];

  // Select da aba
  const filtro = document.getElementById("filtroTurmaAlunos");
  if (filtro) {
    filtro.innerHTML = `<option value="">Selecione uma turma</option>`;
    turmasParaAlunos.forEach(t => {
      filtro.innerHTML += `<option value="${t.id}">${t.nome} - ${t.ano}</option>`;
    });
  }
}

// Popula o select de turma dentro do modal
function popularTurmasNoModal() {
  const select = document.getElementById("novoAlunoTurma");
  if (!select || turmasParaAlunos.length === 0) return;
  select.innerHTML = `<option value="">Selecione a turma...</option>`;
  turmasParaAlunos.forEach(t => {
    select.innerHTML += `<option value="${t.id}">${t.nome} - ${t.ano}</option>`;
  });

  // Se já há uma turma selecionada na aba, pré-seleciona no modal
  const filtro = document.getElementById("filtroTurmaAlunos");
  if (filtro?.value) select.value = filtro.value;
}

// Carrega alunos da turma selecionada
async function loadAlunos() {
  const turmaId = document.getElementById("filtroTurmaAlunos")?.value;
  const lista = document.getElementById("listaAlunos");

  if (!turmaId) {
    if (lista) lista.innerHTML = `<p class="text-muted">Selecione uma turma para ver os alunos.</p>`;
    todosAlunos = [];
    return;
  }

  const { data, error } = await supabaseClient
    .from("alunos")
    .select("id, nome, numero_chamada")
    .eq("turma_id", turmaId)
    .order("numero_chamada", { ascending: true, nullsFirst: false })
    .order("nome", { ascending: true });

  if (error) { console.log(error); return; }

  todosAlunos = data || [];
  renderAlunos();
}

// Renderiza lista com busca
function renderAlunos() {
  const lista = document.getElementById("listaAlunos");
  if (!lista) return;

  const termo = (document.getElementById("buscaAluno")?.value || "").toLowerCase().trim();

  let filtrados = todosAlunos;
  if (termo) {
    filtrados = filtrados.filter(a =>
      a.nome?.toLowerCase().includes(termo) ||
      String(a.id).includes(termo)
    );
  }

  if (filtrados.length === 0) {
    lista.innerHTML = `<p class="text-muted">Nenhum aluno encontrado.</p>`;
    return;
  }

  lista.innerHTML = `
    <table class="table table-bordered align-middle">
      <thead class="table-light">
        <tr>
          <th style="width:60px">Nº</th>
          <th>Nome</th>
          <th style="width:130px">RA</th>
          <th style="width:80px" class="text-center">Ação</th>
        </tr>
      </thead>
      <tbody>
        ${filtrados.map(a => `
          <tr>
            <td>${a.numero_chamada ?? "-"}</td>
            <td>${a.nome}</td>
            <td>${a.id}</td>
            <td class="text-center">
              <button class="btn btn-sm btn-outline-danger"
                onclick="confirmarRemoverAluno('${a.id}', '${a.nome.replace(/'/g, "\\'")}')">
                Remover
              </button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

// Abre o modal de novo aluno
function abrirModalNovoAluno() {
  popularTurmasNoModal();

  document.getElementById("novoAlunoNumeroChamada").value = "";
  document.getElementById("novoAlunoNome").value = "";
  document.getElementById("novoAlunoRA").value = "";
  document.getElementById("feedbackNovoAluno").innerHTML = "";

  if (!modalNovoAlunoInstance) {
    modalNovoAlunoInstance = new bootstrap.Modal(document.getElementById("modalNovoAluno"));
  }
  modalNovoAlunoInstance.show();
}

// Salva novo aluno
async function salvarNovoAluno() {
  const turmaId       = document.getElementById("novoAlunoTurma").value;
  const numeroChamada = document.getElementById("novoAlunoNumeroChamada").value.trim();
  const nome          = document.getElementById("novoAlunoNome").value.trim();
  const ra            = document.getElementById("novoAlunoRA").value.trim();

  const feedback = document.getElementById("feedbackNovoAluno");
  const btn      = document.getElementById("btnSalvarNovoAluno");
  const btnTexto = document.getElementById("btnSalvarNovoAlunoTexto");
  const spinner  = document.getElementById("btnSalvarNovoAlunoSpinner");

  feedback.innerHTML = "";

  if (!turmaId || !nome || !ra) {
    feedback.innerHTML = `<div class="alert alert-warning py-2">Preencha turma, nome e RA.</div>`;
    return;
  }

  btn.disabled = true;
  btnTexto.textContent = "Salvando...";
  spinner.classList.remove("d-none");

  try {
    // 1. Verifica se RA já existe em qualquer turma
    const { data: raExistente } = await supabaseClient
      .from("alunos")
      .select("id, nome")
      .eq("id", ra)
      .maybeSingle();

    if (raExistente) {
      feedback.innerHTML = `<div class="alert alert-danger py-2">Já existe um aluno com o RA <strong>${ra}</strong> (${raExistente.nome}).</div>`;
      return;
    }

    // 2. Verifica se número de chamada já existe na mesma turma
    if (numeroChamada) {
      const { data: chamadaExistente } = await supabaseClient
        .from("alunos")
        .select("id, nome")
        .eq("turma_id", turmaId)
        .eq("numero_chamada", parseInt(numeroChamada))
        .maybeSingle();

      if (chamadaExistente) {
        feedback.innerHTML = `<div class="alert alert-danger py-2">O número de chamada <strong>${numeroChamada}</strong> já pertence ao aluno <strong>${chamadaExistente.nome}</strong> nessa turma.</div>`;
        return;
      }
    }

    // 3. Salva com nome em maiúsculas
    const { error } = await supabaseClient
      .from("alunos")
      .insert([{
        id: ra,
        nome: nome.toUpperCase(),
        turma_id: turmaId,
        numero_chamada: numeroChamada ? parseInt(numeroChamada) : null,
        foto_url: null,
      }]);

    if (error) {
      feedback.innerHTML = `<div class="alert alert-danger py-2">Erro ao salvar: ${error.message}</div>`;
      return;
    }

    feedback.innerHTML = `<div class="alert alert-success py-2">Aluno <strong>${nome}</strong> adicionado com sucesso!</div>`;

    // Atualiza a lista se a turma do modal for a mesma do filtro
    const filtroTurma = document.getElementById("filtroTurmaAlunos");
    if (filtroTurma && (!filtroTurma.value || filtroTurma.value === turmaId)) {
      filtroTurma.value = turmaId;
      await loadAlunos();
    }

    setTimeout(() => modalNovoAlunoInstance?.hide(), 1500);

  } catch (err) {
    feedback.innerHTML = `<div class="alert alert-danger py-2">Erro inesperado: ${err.message}</div>`;
  } finally {
    btn.disabled = false;
    btnTexto.textContent = "Salvar";
    spinner.classList.add("d-none");
  }
}

// Confirma e remove aluno
async function confirmarRemoverAluno(alunoId, nome) {
  const confirmar = confirm(
    `Deseja remover o aluno "${nome}" (RA: ${alunoId})?\n\nEssa ação é permanente.`
  );
  if (!confirmar) return;

  const { error } = await supabaseClient
    .from("alunos")
    .delete()
    .eq("id", alunoId);

  if (error) {
    alert("Erro ao remover aluno: " + error.message);
    return;
  }

  alert(`Aluno "${nome}" removido com sucesso!`);
  await loadAlunos();
}

// Chamado ao entrar na aba Alunos
async function onAbaAlunos() {
  if (turmasParaAlunos.length === 0) {
    await carregarTurmasAlunos();
  }
}


// Modal para mostrar disciplinas associadas a uma turma
let modalDisciplinasInstance = null;
let turmaIdAtiva = null;

async function abrirModalDisciplinas(turmaId, turmaNome) {
  turmaIdAtiva = turmaId;
  document.getElementById("nomeTurmaModal").innerText = turmaNome;
  
  const modalEl = document.getElementById("modalDisciplinasTurma");
  if (!modalDisciplinasInstance) {
    modalDisciplinasInstance = new bootstrap.Modal(modalEl);
  }

  // Limpa e carrega os dados
  await carregarSelectDisciplinas();
  await listarDisciplinasDaTurma();
  
  modalDisciplinasInstance.show();
}

async function carregarSelectDisciplinas() {
  const select = document.getElementById("selectNovaDisciplina");
  const { data, error } = await supabaseClient
    .from("disciplinas")
    .select("id, nome")
    .order("nome");

  if (error) return;

  select.innerHTML = '<option value="">Selecione...</option>';
  data.forEach(d => {
    select.innerHTML += `<option value="${d.id}">${d.nome}</option>`;
  });
}

async function listarDisciplinasDaTurma() {
  const corpo = document.getElementById("listaDisciplinasCorpo");
  const badge = document.getElementById("totalDisciplinasBadge");
  if(!corpo) return;

  corpo.innerHTML = '<tr><td colspan="2" class="text-center text-muted py-3">Carregando...</td></tr>';

  // CONSULTA ATUALIZADA: Usando turma_disciplina
  const { data, error } = await supabaseClient
    .from("turma_disciplinas") // <--- Mudamos aqui
    .select(`
      id, 
      disciplina_id, 
      disciplinas ( nome )
    `)
    .eq("turma_id", turmaIdAtiva);

  if (error) {
    console.error("Erro Supabase:", error);
    corpo.innerHTML = '<tr><td colspan="2" class="text-center text-danger">Erro ao carregar dados.</td></tr>';
    return;
  }

  badge.innerText = data.length;
  corpo.innerHTML = "";

  if (data.length === 0) {
    corpo.innerHTML = '<tr><td colspan="2" class="text-center text-muted py-3">Nenhuma disciplina na grade desta turma.</td></tr>';
    return;
  }

  data.forEach(item => {
    corpo.innerHTML += `
      <tr>
        <td class="align-middle fw-medium">${item.disciplinas?.nome || 'Sem nome'}</td>
        <td class="text-end">
          <button class="btn btn-sm text-danger" onclick="removerVinculoDisciplina('${item.id}')">
            <i class="bi bi-trash"></i> Remover
          </button>
        </td>
      </tr>
    `;
  });
}

async function vincularNovaDisciplina() {
  const discId = document.getElementById("selectNovaDisciplina").value;
  if (!discId) return alert("Selecione uma disciplina.");

  const { error } = await supabaseClient
    .from("turma_disciplinas") // <--- ajuste aqui também
    .insert([{ 
      turma_id: turmaIdAtiva, 
      disciplina_id: discId 
    }]);

  if (error) {
    alert("Erro ao salvar: " + error.message);
  } else {
    listarDisciplinasDaTurma();
  }
}

async function removerVinculoDisciplina(id) {
  if (!confirm("Deseja remover o vínculo desta disciplina com a turma?")) return;

  const { error } = await supabaseClient
    .from("professor_disciplina_turma")
    .delete()
    .eq("id", id);

  if (error) {
    alert("Erro ao remover: " + error.message);
  } else {
    listarDisciplinasDaTurma();
  }
}

//Função para abrir o modal de destaque do conselho dos alunos


function listaDisciplinasModalHtml(containerId, selecionadas = []) {
  if (!Array.isArray(window.cacheDisciplinas)) return "";

  return (window.cacheDisciplinas || []).map((disc, i) => {
    const checked = selecionadas.includes(disc.nome) ? "checked" : "";
    return `
      <div class="col-md-4 col-sm-6">
        <div class="form-check">
          <input class="form-check-input ${containerId}-chk" type="checkbox"
            id="${containerId}_${i}" value="${disc.nome}" ${checked}>
          <label class="form-check-label" for="${containerId}_${i}">
            ${disc.nome}
          </label>
        </div>
      </div>
    `;
  }).join("");
}

function obterSelecionadasPorClasse(classe) {
  return Array.from(document.querySelectorAll(`.${classe}:checked`)).map(el => el.value);
}

function textoParaLista(texto) {
  if (!texto) return [];
  return texto.split(",").map(t => t.trim()).filter(Boolean);
}

function alternarAreaPorRadio(nomeRadio, areaId, valorQueMostra = "true") {
  const selecionado = document.querySelector(`input[name="${nomeRadio}"]:checked`);
  const area = document.getElementById(areaId);
  if (!area) return;

  area.classList.toggle("d-none", !selecionado || selecionado.value !== valorQueMostra);
}

function configurarEventosModalConselho() {
  document.querySelectorAll('input[name="modalDificuldade"]').forEach(el => {
    el.addEventListener("change", () => alternarAreaPorRadio("modalDificuldade", "modalDificuldadeArea", "true"));
  });

  document.querySelectorAll('input[name="modalFazSala"]').forEach(el => {
    el.addEventListener("change", () => alternarAreaPorRadio("modalFazSala", "modalSalaArea", "false"));
  });

  document.querySelectorAll('input[name="modalFazPlataforma"]').forEach(el => {
    el.addEventListener("change", () => alternarAreaPorRadio("modalFazPlataforma", "modalPlataformaArea", "false"));
  });

  document.querySelectorAll('input[name="modalIndisciplina"]').forEach(el => {
    el.addEventListener("change", () => alternarAreaPorRadio("modalIndisciplina", "modalIndisciplinaArea", "true"));
  });
}

window.abrirModalConselho = async function(index) {
  const linhas = document.querySelectorAll("#corpoTabela tr");
  alunoAtualIndex = index;

  const linha = linhas[index];
  if (!linha) return;

  const alunoId = linha.getAttribute("data-aluno-id");
  const nome = linha.querySelector(".col-aluno")?.innerText || "";
  document.getElementById("modalAlunoTitulo").innerText = nome;

  const dificuldadeMarcada = linha.querySelector(".dificuldadeChk")?.checked || false;
  const dificuldadeTexto = linha.querySelector(".dificuldadeTxt")?.value || "";

  const fazSala = linha.querySelector(".selFazSala")?.value || "true";
  const salaTexto = linha.querySelector(".salaMateriasTxt")?.value || "";

  const fazPlataforma = linha.querySelector(".selFazPlataforma")?.value || "true";
  const plataformaTexto = linha.querySelector(".plataformaMateriasTxt")?.value || "";

  const indisciplinaMarcada = linha.querySelector(".indisciplinaChk")?.checked || false;
  const indisciplinaTexto = linha.querySelector(".indisciplinaTxt")?.value || "";

  selecoesModal.dificuldade = textoParaLista(dificuldadeTexto);
  selecoesModal.sala = textoParaLista(salaTexto);
  selecoesModal.plataforma = textoParaLista(plataformaTexto);

  document.getElementById("modalDificuldadeSim").checked = dificuldadeMarcada;
  document.getElementById("modalDificuldadeNao").checked = !dificuldadeMarcada;

  document.getElementById("modalFazSalaSim").checked = fazSala === "true";
  document.getElementById("modalFazSalaNao").checked = fazSala === "false";

  document.getElementById("modalFazPlataformaSim").checked = fazPlataforma === "true";
  document.getElementById("modalFazPlataformaNao").checked = fazPlataforma === "false";

  document.getElementById("modalIndisciplinaSim").checked = indisciplinaMarcada;
  document.getElementById("modalIndisciplinaNao").checked = !indisciplinaMarcada;

  document.getElementById("modalIndisciplinaTxt").value = indisciplinaTexto;

  document.getElementById("modalProficiencia").value =
    linha.querySelector(".proficiencia")?.value || "";

  // Não marcar como concluído ao abrir o modal
  // linha.querySelector(".concluidoSwitch").checked = true;

  alternarAreaPorRadio("modalDificuldade", "modalDificuldadeArea", "true");
  alternarAreaPorRadio("modalFazSala", "modalSalaArea", "false");
  alternarAreaPorRadio("modalFazPlataforma", "modalPlataformaArea", "false");
  alternarAreaPorRadio("modalIndisciplina", "modalIndisciplinaArea", "true");

  atualizarResumoSelecao("dificuldade");
  atualizarResumoSelecao("sala");
  atualizarResumoSelecao("plataforma");

  document.getElementById("btnAnterior").disabled = index === 0;
  document.getElementById("btnProximo").disabled = index === linhas.length - 1;

  const textoProfAnterior = document.getElementById("textoProficienciaAnterior");
  if (textoProfAnterior) {
    textoProfAnterior.textContent = "Proficiência no conselho anterior: carregando...";
  }

  try {
    const profAnterior = await buscarProficienciaBimestreAnterior(alunoId, conselhoAtual);

    if (textoProfAnterior) {
      textoProfAnterior.textContent = profAnterior
        ? `Proficiência no conselho anterior: ${profAnterior}`
        : "Proficiência no conselho anterior: não registrada";
    }
  } catch (err) {
    console.error("Erro ao carregar proficiência anterior:", err);
    if (textoProfAnterior) {
      textoProfAnterior.textContent = "Proficiência no conselho anterior: não foi possível carregar";
    }
  }

  bootstrap.Modal.getOrCreateInstance(
    document.getElementById("modalConselhoAluno")
  ).show();
};

async function salvarAlunoModalAtual() {
  const linhas = document.querySelectorAll("#corpoTabela tr");
  const linha = linhas[alunoAtualIndex];
  if (!linha) return false;

  const dificuldade = document.querySelector('input[name="modalDificuldade"]:checked')?.value === "true";
  const fazSala = document.querySelector('input[name="modalFazSala"]:checked')?.value || "true";
  const fazPlataforma = document.querySelector('input[name="modalFazPlataforma"]:checked')?.value || "true";
  const indisciplina = document.querySelector('input[name="modalIndisciplina"]:checked')?.value === "true";

  const textoIndisciplina = document.getElementById("modalIndisciplinaTxt").value.trim();
  const proficiencia = document.getElementById("modalProficiencia").value || "";

  if (dificuldade && selecoesModal.dificuldade.length === 0) {
    alert("Se marcar 'Tem dificuldade = Sim', selecione pelo menos uma disciplina.");
    return false;
  }

  if (fazSala === "false" && selecoesModal.sala.length === 0) {
    alert("Se marcar 'Faz atividade em sala = Não', selecione pelo menos uma disciplina.");
    return false;
  }

  if (fazPlataforma === "false" && selecoesModal.plataforma.length === 0) {
    alert("Se marcar 'Faz plataformas = Não', selecione pelo menos uma disciplina.");
    return false;
  }

  if (indisciplina && !textoIndisciplina) {
    alert("Se marcar 'Indisciplina = Sim', descreva a indisciplina.");
    return false;
  }

  if (!proficiencia) {
    alert("Selecione o nível de proficiência do aluno.");
    return false;
  }
  const alunoId = linha.getAttribute("data-aluno-id");

  if (proficiencia && conselhoAtual?.bimestre > 1) {
    try {
      const validacao = await validarProficienciaBimestreAnterior(
        alunoId,
        conselhoAtual,
        proficiencia
      );
  
      if (!validacao.permitido) {
        alert(
          `O aluno não pode regredir na proficiência.\n\n` +
          `Bimestre anterior: ${validacao.nivelAnterior}\n` +
          `Selecionado agora: ${proficiencia}`
        );
        return false;
      }
    } catch (err) {
      console.error(err);
      alert("Erro ao validar a proficiência do bimestre anterior.");
      return false;
    }
  }

  function atualizarResumoVisualLinha(linha) {
  if (!linha) return;

  const difTem = linha.querySelector(".dificuldadeChk")?.checked || false;
  const difMat = linha.querySelector(".dificuldadeTxt")?.value?.trim() || "";

  const fazSala = linha.querySelector(".selFazSala")?.value === "true";
  const salaMat = linha.querySelector(".salaMateriasTxt")?.value?.trim() || "";

  const fazPlat = linha.querySelector(".selFazPlataforma")?.value === "true";
  const platMat = linha.querySelector(".plataformaMateriasTxt")?.value?.trim() || "";

  const indTem = linha.querySelector(".indisciplinaChk")?.checked || false;
  const proficiencia = linha.querySelector(".proficiencia")?.value || "";
  const concluido = linha.querySelector(".concluidoSwitch")?.checked || false;

  const badges = [];

  if (difTem) {
    const qtdDif = difMat
      ? difMat.split(",").map(t => t.trim()).filter(Boolean).length
      : 0;
    badges.push(
      `<span class="badge text-bg-warning text-dark me-1 mb-1">Dificuldade${qtdDif > 0 ? ` (${qtdDif})` : ""}</span>`
    );
  }

  if (!fazSala) {
    const qtdSala = salaMat
      ? salaMat.split(",").map(t => t.trim()).filter(Boolean).length
      : 0;
    badges.push(
      `<span class="badge text-bg-secondary me-1 mb-1">Sem atividade${qtdSala > 0 ? ` (${qtdSala})` : ""}</span>`
    );
  }

  if (!fazPlat) {
    const qtdPlat = platMat
      ? platMat.split(",").map(t => t.trim()).filter(Boolean).length
      : 0;
    badges.push(
      `<span class="badge text-bg-info me-1 mb-1">Sem plataforma${qtdPlat > 0 ? ` (${qtdPlat})` : ""}</span>`
    );
  }

  if (indTem) {
    badges.push(
      `<span class="badge text-bg-danger me-1 mb-1">Indisciplina</span>`
    );
  }

  const resumoHtml = badges.length
    ? badges.join("")
    : `<span class="text-muted small">Sem apontamentos</span>`;

  const proficienciaHtml = proficiencia
    ? `<span>${proficiencia}</span>`
    : `<span class="text-muted">-</span>`;

  const statusHtml = `
    <span class="badge status-badge ${concluido ? "text-bg-success" : "text-bg-secondary"}">
      ${concluido ? "Concluído" : "Pendente"}
    </span>
  `;

  const tdResumo = linha.querySelector(".cell-resumo");
  const tdProficiencia = linha.querySelector(".cell-proficiencia");
  const tdStatus = linha.querySelector(".cell-status");

  if (tdResumo) tdResumo.innerHTML = resumoHtml;
  if (tdProficiencia) tdProficiencia.innerHTML = proficienciaHtml;
  if (tdStatus) tdStatus.innerHTML = statusHtml;
}

  linha.querySelector(".dificuldadeChk").checked = dificuldade;
  linha.querySelector(".dificuldadeTxt").value = dificuldade ? selecoesModal.dificuldade.join(", ") : "";
  
  linha.querySelector(".selFazSala").value = fazSala;
  linha.querySelector(".salaMateriasTxt").value = fazSala === "false" ? selecoesModal.sala.join(", ") : "";
  
  linha.querySelector(".selFazPlataforma").value = fazPlataforma;
  linha.querySelector(".plataformaMateriasTxt").value = fazPlataforma === "false" ? selecoesModal.plataforma.join(", ") : "";
  
  linha.querySelector(".indisciplinaChk").checked = indisciplina;
  linha.querySelector(".indisciplinaTxt").value = indisciplina ? textoIndisciplina : "";
  
  linha.querySelector(".proficiencia").value =
    document.getElementById("modalProficiencia").value;
  
  // concluído automático
  linha.querySelector(".concluidoSwitch").checked = true;
  
  atualizarStatusLinha(linha);
  atualizarContadoresTabela();
  atualizarResumoVisualLinha(linha);
  
  return true;
}

document.addEventListener("modalsLoaded", () => {
  document.querySelectorAll('input[name="modalDificuldade"]').forEach(el => {
    el.addEventListener("change", () => alternarAreaPorRadio("modalDificuldade", "modalDificuldadeArea", "true"));
  });

  document.querySelectorAll('input[name="modalFazSala"]').forEach(el => {
    el.addEventListener("change", () => alternarAreaPorRadio("modalFazSala", "modalSalaArea", "false"));
  });

  document.querySelectorAll('input[name="modalFazPlataforma"]').forEach(el => {
    el.addEventListener("change", () => alternarAreaPorRadio("modalFazPlataforma", "modalPlataformaArea", "false"));
  });

  document.querySelectorAll('input[name="modalIndisciplina"]').forEach(el => {
    el.addEventListener("change", () => alternarAreaPorRadio("modalIndisciplina", "modalIndisciplinaArea", "true"));
  });

  document.getElementById("btnSelecionarDificuldade")?.addEventListener("click", () => {
    abrirModalSelecaoDisciplinas("dificuldade", "Selecionar disciplinas com dificuldade");
  });

  document.getElementById("btnSelecionarSala")?.addEventListener("click", () => {
    abrirModalSelecaoDisciplinas("sala", "Selecionar disciplinas sem atividade em sala");
  });

  document.getElementById("btnSelecionarPlataforma")?.addEventListener("click", () => {
    abrirModalSelecaoDisciplinas("plataforma", "Selecionar disciplinas sem plataformas");
  });

  document.getElementById("btnConfirmarDisciplinas")?.addEventListener("click", () => {
    if (!contextoSelecaoAtual) return;

    const marcadas = Array.from(
      document.querySelectorAll(".chk-disciplina-selecao:checked")
    ).map(el => el.value);

    selecoesModal[contextoSelecaoAtual] = marcadas;
    atualizarResumoSelecao(contextoSelecaoAtual);

    bootstrap.Modal.getInstance(document.getElementById("modalSelecionarDisciplinas"))?.hide();
  });

  document.getElementById("btnSalvarAluno")?.addEventListener("click", async () => {
  const salvou = await salvarAlunoModalAtual();
  if (!salvou) return;

  bootstrap.Modal.getInstance(document.getElementById("modalConselhoAluno"))?.hide();
});

document.getElementById("btnAnterior")?.addEventListener("click", async () => {
  const salvou = await salvarAlunoModalAtual();
  if (!salvou) return;

  if (alunoAtualIndex > 0) abrirModalConselho(alunoAtualIndex - 1);
});

document.getElementById("btnProximo")?.addEventListener("click", async () => {
  const salvou = await salvarAlunoModalAtual();
  if (!salvou) return;

  const linhas = document.querySelectorAll("#corpoTabela tr");
  if (alunoAtualIndex < linhas.length - 1) abrirModalConselho(alunoAtualIndex + 1);
});
});
