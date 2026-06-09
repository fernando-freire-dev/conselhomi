let coordLogada = null;
let turmasCache = [];

document.addEventListener("DOMContentLoaded", async () => {
  await checkCoordenacao();
  await loadTurmasFiltro();
  await loadConselhos();
  popularFiltroTurmaNotasFaltas();
});

async function checkCoordenacao() {
  const { data: { user } } = await supabaseClient.auth.getUser();

  if (!user) {
    window.location.href = "index.html";
    return;
  }

  const { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("id, nome, role")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    alert("Não foi possível carregar seu perfil.");
    window.location.href = "index.html";
    return;
  }

  if (profile.role !== "coordenacao" && profile.role !== "admin") {
    alert("Acesso restrito à coordenação.");
    window.location.href = "dashboard.html";
    return;
  }

  coordLogada = profile;
}

async function loadTurmasFiltro() {
  const { data, error } = await supabaseClient
    .from("turmas")
    .select("id, nome, ano, ensino")
    .order("nome", { ascending: true });

  if (error) {
    console.log(error);
    return;
  }

  turmasCache = data || [];
  renderTurmasFiltro();
}

async function loadConselhos() {
  const ensino = document.getElementById("filtroEnsino").value;
  const turmaId = document.getElementById("filtroTurma").value;
  const bimestre = document.getElementById("filtroBimestre").value;
  const status = document.getElementById("filtroStatus").value;

  let query = supabaseClient
    .from("conselhos")
    .select(`
      id,
      turma_id,
      bimestre,
      data_conselho,
      status,
      turmas ( nome, ano, ensino )
    `)
    .order("data_conselho", { ascending: false });

  if (turmaId) query = query.eq("turma_id", turmaId);
  if (bimestre) query = query.eq("bimestre", bimestre);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;

  if (error) {
    console.log(error);
    return;
  }

  const filtrado = ensino
    ? data.filter(c => (c.turmas?.ensino || "") === ensino)
    : data;

  const tbody = document.getElementById("listaConselhos");
  tbody.innerHTML = "";

  if (!filtrado || filtrado.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6">Nenhum conselho encontrado.</td></tr>`;
    return;
  }

  filtrado.forEach(c => {
    const turmaNome = c.turmas ? `${c.turmas.nome} - ${c.turmas.ano}` : "Turma";
    const ensinoTxt = c.turmas?.ensino || "-";
    const dataTxt = c.data_conselho ? formatarDataBR(c.data_conselho) : "-";
    const statusTxt = c.status || "-";

    tbody.innerHTML += `
      <tr>
        <td>${turmaNome}</td>
        <td>${ensinoTxt}</td>
        <td>${c.bimestre}</td>
        <td>${dataTxt}</td>
        <td>${statusTxt}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="abrirConselho('${c.turma_id}', '${c.bimestre}')">
            Abrir
          </button>

          <button class="btn btn-sm ${statusTxt === "finalizado" ? "btn-outline-secondary" : "btn-secondary"}" 
            onclick="baixarRelatorio('${c.id}')" 
            ${statusTxt !== "finalizado" ? "disabled" : ""}>
            PDF
          </button>

          <button class="btn btn-sm btn-success" onclick="reabrirConselho('${c.id}')" ${statusTxt !== "finalizado" ? "disabled" : ""}>
            Reabrir
          </button>

          <button class="btn btn-sm btn-danger" onclick="excluirConselho('${c.id}')">
            Excluir
          </button>
        </td>
      </tr>
    `;
  });
}

function abrirConselho(turmaId, bimestre) {
  localStorage.setItem("conselho_turma_id", turmaId);
  localStorage.setItem("conselho_bimestre", String(bimestre));
  window.location.href = "conselho.html";
}

async function reabrirConselho(conselhoId) {
  const confirmar = confirm("Deseja reabrir este conselho? Ele volta para 'em_andamento'.");
  if (!confirmar) return;

  const { error } = await supabaseClient
    .from("conselhos")
    .update({ status: "em_andamento" })
    .eq("id", conselhoId);

  if (error) {
    alert("Erro ao reabrir.");
    console.log(error);
    return;
  }

  alert("Conselho reaberto!");
  loadConselhos();
}

async function excluirConselho(conselhoId) {
  const confirmar = confirm(
    "ATENÇÃO: excluir é permanente e remove os registros do conselho.\n\nDeseja continuar?"
  );
  if (!confirmar) return;

  const { error } = await supabaseClient
    .from("conselhos")
    .delete()
    .eq("id", conselhoId);

  if (error) {
    alert("Erro ao excluir.");
    console.log(error);
    return;
  }

  alert("Conselho excluído com sucesso!");
  loadConselhos();
}

function formatarDataBR(data) {
  const d = new Date(data);

  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const ano = d.getFullYear();

  return `${dia}/${mes}/${ano}`;
}

// =============================
// Relatório do Conselho (PDF)
// =============================
async function baixarRelatorio(conselhoId) {
  if (!window.jspdf?.jsPDF) {
    alert("jsPDF não carregou. Verifique os scripts do jsPDF e autoTable no HTML.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF("landscape", "mm", "a4");

  const pageW = doc.internal.pageSize.getWidth();
  const marginL = 8;
  const marginR = 8;
  const contentW = pageW - marginL - marginR;

  // ── Buscar dados ──────────────────────────────────────────
  const { data: conselho, error: errConselho } = await supabaseClient
    .from("conselhos")
    .select("id, bimestre, turma_id, observacoes_gerais, data_conselho, turmas(nome, ano)")
    .eq("id", conselhoId)
    .single();

  if (errConselho || !conselho) {
    alert("Erro ao buscar dados do conselho.");
    return;
  }

  const { data: registros, error: errRegistros } = await supabaseClient
    .from("conselho_alunos")
    .select(`
      aluno_id,
      dificuldade,
      faz_atividade_sala,
      faz_plataforma,
      indisciplina,
      nivel_proficiencia,
      alunos ( nome, numero_chamada )
    `)
    .eq("conselho_id", conselhoId)
    .order("numero_chamada", { foreignTable: "alunos", ascending: true });

  if (errRegistros) {
    alert("Erro ao buscar registros do conselho.");
    return;
  }

  // Ordena por número de chamada
  const registrosOrdenados = (registros || []).sort((a, b) => {
    const nA = a.alunos?.numero_chamada ?? 9999;
    const nB = b.alunos?.numero_chamada ?? 9999;
    return nA - nB;
  });

  // ── Helpers para montar o resumo ──────────────────────────
  function montarResumo(r) {
    const badges = [];

    // Dificuldade
    const dif = r.dificuldade;
    if (dif && typeof dif === "object" && dif.tem) {
      const qtd = dif.materias
        ? dif.materias.split(",").map(t => t.trim()).filter(Boolean).length
        : 0;
      badges.push(`Dificuldade${qtd > 0 ? ` (${qtd})` : ""}`);
    }

    // Sem atividade em sala
    const sala = r.faz_atividade_sala;
    const fazSala = sala && typeof sala === "object"
      ? (sala.faz !== undefined ? !!sala.faz : true)
      : true;
    if (!fazSala) {
      const qtd = sala?.materias
        ? sala.materias.split(",").map(t => t.trim()).filter(Boolean).length
        : 0;
      badges.push(`Sem atividade${qtd > 0 ? ` (${qtd})` : ""}`);
    }

    // Sem plataforma
    const plat = r.faz_plataforma;
    const fazPlat = plat && typeof plat === "object"
      ? (plat.faz !== undefined ? !!plat.faz : true)
      : true;
    if (!fazPlat) {
      const qtd = plat?.materias
        ? plat.materias.split(",").map(t => t.trim()).filter(Boolean).length
        : 0;
      badges.push(`Sem plataforma${qtd > 0 ? ` (${qtd})` : ""}`);
    }

    // Indisciplina
    const ind = r.indisciplina;
    const temInd = ind && typeof ind === "object" ? !!ind.tem : !!ind;
    if (temInd) badges.push("Indisciplina");

    return badges.length > 0 ? badges.join("   ") : "Sem apontamentos";
  }

  // ── Cabeçalho do PDF ─────────────────────────────────────
  const turmaTxt = conselho.turmas
    ? `${conselho.turmas.nome} - ${conselho.turmas.ano || ""}`.trim()
    : "Turma";

  const dataConselhoTxt = conselho.data_conselho ? formatarDataBR(conselho.data_conselho) : "-";
  const dataEmissaoTxt = formatarDataBR(new Date());

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("PEI Manoel Ignácio da Silva", pageW / 2, 10, { align: "center" });

  doc.setFontSize(11);
  doc.text(
    `Relatório do Conselho de Classe • ${turmaTxt} • ${conselho.bimestre}º Bimestre`,
    pageW / 2, 16.5, { align: "center" }
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Data do conselho: ${dataConselhoTxt}`, marginL, 23);
  doc.text(`Emissão: ${dataEmissaoTxt}`, pageW - marginR, 23, { align: "right" });

  doc.text("Professor representante: ____________________________________________", marginL, 29);
  doc.text("Reunião com responsáveis (data): ____/____/______", pageW - marginR, 29, { align: "right" });

  // ── Observações gerais ────────────────────────────────────
  const obsLabelY = 35;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Observações gerais da turma:", marginL, obsLabelY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const obs = (conselho.observacoes_gerais || "").trim() || "—";
  const boxPadding = 3;
  const boxStartY = obsLabelY + 2;
  const obsLines = doc.splitTextToSize(obs, contentW - boxPadding * 2);
  const lineHeight = 4.5;
  const boxHeight = obsLines.length * lineHeight + boxPadding * 2;

  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(marginL, boxStartY, contentW, boxHeight);
  doc.text(obsLines, marginL + boxPadding, obsLabelY + 6 + boxPadding);

  let startY = boxStartY + boxHeight + 2;
  if (startY < 45) startY = 45;

  // ── Tabela simplificada ───────────────────────────────────
  const colunas = ["Nº", "Nome", "Resumo", "Proficiência", "Assinatura do responsável"];

  const linhas = registrosOrdenados.map(r => [
    r.alunos?.numero_chamada ?? "",
    r.alunos?.nome || "",
    montarResumo(r),
    r.nivel_proficiencia || "-",
    ""
  ]);

  doc.autoTable({
    head: [colunas],
    body: linhas,
    startY,
    theme: "grid",
    margin: { left: marginL, right: marginR },
    styles: {
      fontSize: 9,
      cellPadding: 2,
      valign: "middle",
      overflow: "linebreak"
    },
    headStyles: {
      fontSize: 9,
      fillColor: [30, 60, 114],
      textColor: 255,
      fontStyle: "bold"
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },  // Nº
      1: { cellWidth: 60 },                     // Nome
      2: { cellWidth: 110 },                    // Resumo — maior para caber os badges
      3: { cellWidth: 30 },                     // Proficiência
      4: { cellWidth: 67 }                      // Assinatura
    },
    // Linha zebrada para facilitar leitura
    alternateRowStyles: { fillColor: [245, 247, 250] },
    didParseCell: function(data) {
      // Destaca "Sem apontamentos" em cinza
      if (data.column.index === 2 && data.cell.raw === "Sem apontamentos") {
        data.cell.styles.textColor = [150, 150, 150];
        data.cell.styles.fontStyle = "italic";
      }
    }
  });

  doc.save(`Relatorio_Conselho_${conselho.turmas?.nome || "Turma"}_${conselho.bimestre}Bim.pdf`);
}

async function logout() {
  await supabaseClient.auth.signOut();
  window.location.href = "index.html";
}

// Inicia o conselho pelo perfil da coordenação
async function iniciarConselho() {
  const turmaId = document.getElementById("filtroTurma").value;
  const bimestre = document.getElementById("filtroBimestre").value;

  if (!turmaId) {
    alert("Selecione uma turma para iniciar o conselho.");
    return;
  }
  if (!bimestre) {
    alert("Selecione um bimestre para iniciar o conselho.");
    return;
  }

  const { data: existente, error: errBusca } = await supabaseClient
    .from("conselhos")
    .select("id")
    .eq("turma_id", turmaId)
    .eq("bimestre", bimestre)
    .maybeSingle();

  if (errBusca) {
    console.log(errBusca);
    alert("Erro ao verificar conselho.");
    return;
  }

  if (!existente) {
    const { error: errCria } = await supabaseClient
      .from("conselhos")
      .insert({ turma_id: turmaId, bimestre: parseInt(bimestre, 10) });

    if (errCria) {
      console.log(errCria);
      alert("Erro ao iniciar conselho (criar).");
      return;
    }
  }

  localStorage.setItem("conselho_turma_id", turmaId);
  localStorage.setItem("conselho_bimestre", String(bimestre));
  window.location.href = "conselho.html";
}

function renderTurmasFiltro() {
  const ensino = document.getElementById("filtroEnsino").value;

  const select = document.getElementById("filtroTurma");
  const turmaSelecionadaAntes = select.value;

  select.innerHTML = `<option value="">Todas</option>`;

  const turmasFiltradas = ensino
    ? turmasCache.filter(t => (t.ensino || "") === ensino)
    : turmasCache;

  turmasFiltradas.forEach(t => {
    const ensinoTxt = t.ensino ? ` (${t.ensino})` : "";
    select.innerHTML += `<option value="${t.id}">${t.nome} - ${t.ano}${ensinoTxt}</option>`;
  });

  const aindaExiste = [...select.options].some(o => o.value === turmaSelecionadaAntes);
  if (aindaExiste) select.value = turmaSelecionadaAntes;
}

function onEnsinoChange() {
  document.getElementById("filtroTurma").value = "";
  renderTurmasFiltro();
  loadConselhos();
}

// =====================================================
// NOVA ABA: ALUNOS
// =====================================================
function onAbaAlunos() {
  popularFiltroTurmaAlunos();
}

function popularFiltroTurmaAlunos() {
  const select = document.getElementById("filtroTurmaAlunos");
  if (!select) return;

  const valorAtual = select.value;
  select.innerHTML = `<option value="">Selecione uma turma</option>`;

  turmasCache.forEach(t => {
    select.innerHTML += `<option value="${t.id}">${t.nome} - ${t.ano}</option>`;
  });

  if ([...select.options].some(o => o.value === valorAtual)) {
    select.value = valorAtual;
  }
}

// =====================================================
// NOVA ABA: NOTAS E FALTAS
// =====================================================
function onAbaNotasFaltas() {
  popularFiltroTurmaNotasFaltas();
}

function popularFiltroTurmaNotasFaltas() {
  const select = document.getElementById("filtroTurmaNotasFaltas");
  if (!select) return;

  const valorAtual = select.value;
  select.innerHTML = `<option value="">Selecione uma turma</option>`;

  turmasCache.forEach(t => {
    select.innerHTML += `<option value="${t.id}">${t.nome} - ${t.ano}</option>`;
  });

  if ([...select.options].some(o => o.value === valorAtual)) {
    select.value = valorAtual;
  }
}

function abrirImportacaoMapaoCoordenacao() {
  const turmaId = document.getElementById("filtroTurmaNotasFaltas")?.value || "";
  const bimestre = document.getElementById("filtroBimestreNotasFaltas")?.value || "";

  if (!turmaId) {
    alert("Selecione uma turma antes de subir o mapão.");
    return;
  }

  if (!bimestre) {
    alert("Selecione um bimestre antes de subir o mapão.");
    return;
  }

  localStorage.setItem("mapao_coord_turma_id", turmaId);
  localStorage.setItem("mapao_coord_bimestre", bimestre);

  window.location.href = "importar-mapao.html";
}

async function visualizarNotasFaltasCoordenacao() {
  const turmaId = document.getElementById("filtroTurmaNotasFaltas")?.value;
  const bimestre = document.getElementById("filtroBimestreNotasFaltas")?.value;
  const preview = document.getElementById("previewNotasFaltasCoordenacao");

  if (!turmaId) {
    alert("Selecione uma turma.");
    return;
  }

  if (!bimestre) {
    alert("Selecione um bimestre.");
    return;
  }

  preview.innerHTML = `
    <div class="alert alert-info py-2 mb-0">
      Carregando notas e faltas...
    </div>
  `;

  try {
    const { data: turmaInfo } = await supabaseClient
      .from("turmas")
      .select("id, nome, ano")
      .eq("id", turmaId)
      .single();

    const { data: disciplinasRel, error: errDisciplinas } = await supabaseClient
      .from("turma_disciplinas")
      .select("disciplinas(id, nome, apelido)")
      .eq("turma_id", turmaId);

    if (errDisciplinas) {
      console.error(errDisciplinas);
      preview.innerHTML = `<div class="alert alert-danger mb-0">Erro ao carregar disciplinas da turma.</div>`;
      return;
    }

    const disciplinas = (disciplinasRel || [])
      .filter(item => item.disciplinas)
      .map(item => ({
        id:      item.disciplinas.id,
        nome:    item.disciplinas.nome,
        apelido: item.disciplinas.apelido || null,
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    const { data: alunos, error: errAlunos } = await supabaseClient
      .from("alunos")
      .select("id, nome, numero_chamada")
      .eq("turma_id", turmaId)
      .order("numero_chamada", { ascending: true, nullsFirst: false })
      .order("nome", { ascending: true });

    if (errAlunos) {
      console.error(errAlunos);
      preview.innerHTML = `<div class="alert alert-danger mb-0">Erro ao carregar alunos da turma.</div>`;
      return;
    }

    const { data: notas, error: errNotas } = await supabaseClient
      .from("notas_frequencia")
      .select("aluno_id, disciplina_id, bimestre, media, faltas")
      .eq("bimestre", parseInt(bimestre, 10))
      .in("aluno_id", (alunos || []).map(a => a.id));

    if (errNotas) {
      console.error(errNotas);
      preview.innerHTML = `<div class="alert alert-danger mb-0">Erro ao carregar notas e faltas.</div>`;
      return;
    }

    renderPreviewNotasFaltasCoordenacao({
      turmaInfo,
      bimestre,
      alunos: alunos || [],
      disciplinas,
      notas: notas || []
    });

  } catch (err) {
    console.error(err);
    preview.innerHTML = `<div class="alert alert-danger mb-0">Erro inesperado ao montar a prévia.</div>`;
  }
}

function renderPreviewNotasFaltasCoordenacao({ turmaInfo, bimestre, alunos, disciplinas, notas }) {
  const preview = document.getElementById("previewNotasFaltasCoordenacao");

  if (!alunos || alunos.length === 0) {
    preview.innerHTML = `
      <div class="alert alert-warning mb-0">
        Nenhum aluno encontrado para a turma selecionada.
      </div>
    `;
    return;
  }

  if (!disciplinas || disciplinas.length === 0) {
    preview.innerHTML = `
      <div class="alert alert-warning mb-0">
        Nenhuma disciplina vinculada a essa turma.
      </div>
    `;
    return;
  }

  const mapaNotas = {};
  (notas || []).forEach(n => {
    mapaNotas[`${n.aluno_id}_${n.disciplina_id}`] = n;
  });

  let totalEsperado = alunos.length * disciplinas.length;
  let totalComNota = 0;

  const thDisciplinas = disciplinas.map(d => {
    const label = d.apelido || d.nome;
    const title = d.apelido ? `title="${d.nome}"` : "";
    return `
      <th ${title}>
        <div>${label}</div>
        <div class="small text-muted">Média / Faltas</div>
      </th>
    `;
  }).join("");

  const linhas = alunos.map(aluno => {
    const tds = disciplinas.map(disc => {
      const registro = mapaNotas[`${aluno.id}_${disc.id}`];

      if (!registro || registro.media === null || registro.media === undefined) {
        return `<td class="text-center text-muted">—</td>`;
      }

      totalComNota++;
      return `<td class="text-center"><strong>${registro.media}</strong> <span class="text-muted">/ ${registro.faltas ?? 0}</span></td>`;
    }).join("");

    return `
      <tr>
        <td class="text-center">${aluno.numero_chamada ?? ""}</td>
        <td>${aluno.nome}</td>
        ${tds}
      </tr>
    `;
  }).join("");

  const totalSemNota = totalEsperado - totalComNota;
  const nomeTurma = turmaInfo ? `${turmaInfo.nome} - ${turmaInfo.ano}` : "Turma";

  preview.innerHTML = `
    <div class="border rounded p-3 bg-light-subtle mb-3">
      <div class="fw-semibold">${nomeTurma} • ${bimestre}º Bimestre</div>
      <div class="small text-muted mt-1">
        ✅ ${totalComNota} notas carregadas &nbsp;&nbsp;|&nbsp;&nbsp;
        ⚠️ ${totalSemNota} sem nota
      </div>
    </div>

    <div class="table-responsive">
      <table class="table table-bordered table-sm align-middle">
        <thead class="table-light">
          <tr>
            <th style="width:50px;">#</th>
            <th style="min-width:220px;">Aluno</th>
            ${thDisciplinas}
          </tr>
        </thead>
        <tbody>
          ${linhas}
        </tbody>
      </table>
    </div>
  `;
}

// =====================================================
// 08/06/2026 - Carrega os períodos cadastrados
// =====================================================

window.carregarPeriodos = async function () {

  const { data, error } = await supabaseClient
    .from("periodos")
    .select("*")
    .order("bimestre");

  if (error) {
    console.error(error);
    return;
  }

  const tbody = document.getElementById("listaPeriodos");

  tbody.innerHTML = "";

  data.forEach(periodo => {

    // =====================================================
    // 08/06/2026 - Define o badge de status do período
    // =====================================================

    const badgeStatus =
      periodo.status === "aberto"
        ? '<span class="badge bg-success">Aberto</span>'
        : '<span class="badge bg-danger">Fechado</span>';

    // =====================================================
    // 08/06/2026 - Define a ação disponível para o período
    // =====================================================

    const botaoAcao =
      periodo.status === "aberto"
        ? `
          <button
            class="btn btn-danger btn-sm"
            onclick="alterarStatusPeriodo(${periodo.bimestre}, 'fechado')">
            Fechar
          </button>
        `
        : `
          <button
            class="btn btn-success btn-sm"
            onclick="alterarStatusPeriodo(${periodo.bimestre}, 'aberto')">
            Abrir
          </button>
        `;

    tbody.innerHTML += `
      <tr>
        <td>${periodo.bimestre}º</td>
        <td>${periodo.descricao}</td>
        <td>${badgeStatus}</td>
        <td>${botaoAcao}</td>
      </tr>
    `;

  });

};

// =====================================================
// 08/06/2026 - Atualiza o status do período
// =====================================================

window.alterarStatusPeriodo = async function (
  bimestre,
  novoStatus
) {

  // =====================================================
  // 08/06/2026 - Obtém usuário autenticado e perfil
  // =====================================================
  
  const { data: { user } } = await supabaseClient.auth.getUser();
  
  const { data: profile, error: profileError } = await supabaseClient
    .from("profiles")
    .select("nome, role")
    .eq("id", user.id)
    .single();
  
  if (profileError) {
    alert("Erro ao identificar usuário.");
    console.error(profileError);
    return;
  }
  // =====================================================
  // 08/06/2026 - Permite alteração apenas para
  // coordenação e administradores
  // =====================================================

  if (
    profile.role !== "coordenacao" &&
    profile.role !== "admin"
  ) {
    alert("Você não possui permissão para alterar períodos.");
    return;
  }

  const confirmar = confirm(
    `Deseja alterar o ${bimestre}º bimestre para "${novoStatus}"?`
  );

  if (!confirmar) return;

  const { error } = await supabaseClient
    .from("periodos")
    .update({
      status: novoStatus,
      alterado_por: profile.nome,
      data_alteracao: new Date().toISOString()
    })
    .eq("bimestre", bimestre);

  if (error) {
    alert("Erro ao atualizar período.");
    console.error(error);
    return;
  }

  alert("Status atualizado com sucesso!");

  carregarPeriodos();

};
