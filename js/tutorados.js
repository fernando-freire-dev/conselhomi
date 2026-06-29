// ============================================================
// js/tutorados.js
// Tela de tutorados do professor tutor
// Exibe alunos tutorados com dados do conselho do bimestre
// ============================================================

let professorLogado = null;
let tutoradosCache = [];       // lista de alunos tutorados
let dadosConselhoCache = {};   // chave: aluno_id → dados do conselho_alunos
let bimestreAtivo = null;      // bimestre selecionado atualmente

// ── Inicialização ─────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  await verificarUsuario();
  await definirBimestreInicial();
  await carregarTutorados();
});

async function verificarUsuario() {
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
}

// Seleciona automaticamente o último bimestre com conselho finalizado.
// Se não existir nenhum finalizado, usa o bimestre 1 como padrão.
async function definirBimestreInicial() {
  const { data, error } = await supabaseClient
    .from("conselhos")
    .select("bimestre")
    .eq("status", "finalizado")
    .order("bimestre", { ascending: false })
    .limit(1)
    .maybeSingle();

  const bimestre = data?.bimestre || 1;
  bimestreAtivo = bimestre;

  const select = document.getElementById("bimestreSelect");
  if (select) select.value = String(bimestre);
}

// ── Carregamento principal ────────────────────────────────────

async function carregarTutorados() {
  bimestreAtivo = parseInt(document.getElementById("bimestreSelect").value);

  const area = document.getElementById("areaTutorados");
  area.innerHTML = `
    <div class="text-center py-4 text-muted">
      <div class="spinner-border spinner-border-sm me-2"></div>
      Carregando tutorados...
    </div>
  `;

  document.getElementById("contadorTutorados").classList.add("d-none");
  document.getElementById("btnGerarPDF").disabled = true;

  // 1. Busca os alunos tutorados por este professor
  const { data: tutorias, error: errTutorias } = await supabaseClient
    .from("tutorias")
    .select(`
      aluno_id,
      alunos (
        id,
        nome,
        numero_chamada,
        situacao,
        turma_id,
        turmas ( id, nome, ano, ensino )
      )
    `)
    .eq("professor_id", professorLogado.id)
    .order("aluno_id");

  if (errTutorias) {
    area.innerHTML = `<div class="alert alert-danger">Erro ao carregar tutorados: ${errTutorias.message}</div>`;
    return;
  }

  // Filtra apenas alunos ativos
  const tutoradosAtivos = (tutorias || []).filter(t => t.alunos?.situacao === "ativo");
  tutoradosCache = tutoradosAtivos;

  if (tutoradosAtivos.length === 0) {
    area.innerHTML = `
      <div class="alert alert-info">
        Você não possui alunos tutorados cadastrados. Solicite ao coordenador para vincular seus tutorados.
      </div>
    `;
    return;
  }

  const alunosIds = tutoradosAtivos.map(t => t.aluno_id);

  // 2. Busca os conselhos finalizados do bimestre para extrair os conselho_ids
  //    (um conselho por turma — buscamos todas as turmas dos tutorados)
  const turmaIds = [...new Set(tutoradosAtivos.map(t => t.alunos?.turma_id).filter(Boolean))];

  const { data: conselhos, error: errConselhos } = await supabaseClient
    .from("conselhos")
    .select("id, turma_id, status, bimestre")
    .eq("bimestre", bimestreAtivo)
    .in("turma_id", turmaIds);

  if (errConselhos) {
    console.error(errConselhos);
  }

  const mapaConselhosPorTurma = {};
  (conselhos || []).forEach(c => {
    mapaConselhosPorTurma[c.turma_id] = c;
  });

  const conselhoIds = (conselhos || []).map(c => c.id);

  // 3. Busca os dados do conselho_alunos para os tutorados
  let dadosConselho = [];
  if (conselhoIds.length > 0 && alunosIds.length > 0) {
    const { data, error: errDados } = await supabaseClient
      .from("conselho_alunos")
      .select("*")
      .in("conselho_id", conselhoIds)
      .in("aluno_id", alunosIds);

    if (errDados) {
      console.error(errDados);
    } else {
      dadosConselho = data || [];
    }
  }

  dadosConselhoCache = {};
  dadosConselho.forEach(d => {
    dadosConselhoCache[d.aluno_id] = d;
  });

  // 4. Atualiza info do bimestre
  const totalComConselho = tutoradosAtivos.filter(t => !!dadosConselhoCache[t.aluno_id]).length;
  const totalSemConselho = tutoradosAtivos.length - totalComConselho;

  const infoBimestre = document.getElementById("infoBimestre");
  if (infoBimestre) {
    const temFinalizado = (conselhos || []).some(c => c.status === "finalizado");
    infoBimestre.innerHTML = temFinalizado
      ? `<span class="badge bg-success-subtle text-success border border-success-subtle">✅ Conselho finalizado</span>`
      : `<span class="badge bg-warning-subtle text-warning border border-warning-subtle">⏳ Conselho em andamento ou não iniciado</span>`;
  }

  // 5. Contadores
  const contador = document.getElementById("contadorTutorados");
  contador.classList.remove("d-none");
  document.getElementById("cntTotal").textContent = `${tutoradosAtivos.length} tutorados`;
  document.getElementById("cntComConselho").textContent = `${totalComConselho} com conselho`;
  document.getElementById("cntSemConselho").textContent = `${totalSemConselho} sem conselho`;

  // 6. Renderiza agrupado por turma
  renderTutorados(tutoradosAtivos, mapaConselhosPorTurma);

  document.getElementById("btnGerarPDF").disabled = false;
}

// ── Renderização ──────────────────────────────────────────────

function renderTutorados(tutorados, mapaConselhosPorTurma) {
  const area = document.getElementById("areaTutorados");

  // Agrupa por turma
  const porTurma = {};
  tutorados.forEach(t => {
    const turmaId = t.alunos?.turma_id || "sem-turma";
    if (!porTurma[turmaId]) {
      porTurma[turmaId] = {
        turma: t.alunos?.turmas || { nome: "Sem turma", ano: "", ensino: "" },
        alunos: []
      };
    }
    porTurma[turmaId].alunos.push(t.alunos);
  });

  // Ordena turmas por ensino e nome
  const turmasOrdenadas = Object.entries(porTurma).sort(([, a], [, b]) => {
    const ensinoA = a.turma.ensino || "";
    const ensinoB = b.turma.ensino || "";
    if (ensinoA !== ensinoB) return ensinoA.localeCompare(ensinoB, "pt-BR");
    return (a.turma.nome || "").localeCompare(b.turma.nome || "", "pt-BR");
  });

  let html = "";

  for (const [turmaId, grupo] of turmasOrdenadas) {
    const turma = grupo.turma;
    const conselho = mapaConselhosPorTurma[turmaId];
    const statusConselho = conselho?.status || null;

    const badgeConselho = statusConselho === "finalizado"
      ? `<span class="badge bg-success ms-2">Conselho finalizado</span>`
      : statusConselho
        ? `<span class="badge bg-warning text-dark ms-2">Em andamento</span>`
        : `<span class="badge bg-secondary ms-2">Sem conselho</span>`;

    const nomeTurma = `${turma.nome} - ${turma.ano}`;

    html += `
      <div class="card mb-4">
        <div class="card-header d-flex align-items-center justify-content-between">
          <div>
            <strong>${nomeTurma}</strong>
            <span class="text-muted small ms-2">${turma.ensino || ""}</span>
            ${badgeConselho}
          </div>
          <span class="badge bg-light text-dark border">${grupo.alunos.length} aluno(s)</span>
        </div>
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="table table-bordered align-middle mb-0">
              <thead class="table-light">
                <tr>
                  <th style="width:50px" class="text-center">Nº</th>
                  <th>Aluno</th>
                  <th style="width:160px">Proficiência</th>
                  <th>Resumo do Conselho</th>
                </tr>
              </thead>
              <tbody>
    `;

    // Ordena alunos por número de chamada
    const alunosOrdenados = [...grupo.alunos].sort((a, b) => {
      const nA = a?.numero_chamada ?? 9999;
      const nB = b?.numero_chamada ?? 9999;
      return nA - nB;
    });

    for (const aluno of alunosOrdenados) {
      const dados = dadosConselhoCache[aluno.id] || null;

      const proficiencia = dados?.nivel_proficiencia || null;
      const profBadge = proficiencia
        ? `<span class="badge ${corProficiencia(proficiencia)}">${proficiencia}</span>`
        : `<span class="text-muted small">—</span>`;

      const resumoHtml = dados ? montarResumoBadges(dados) : `<span class="text-muted small">Sem dados do conselho</span>`;

      html += `
        <tr>
          <td class="text-center col-chamada">${aluno.numero_chamada ?? "—"}</td>
          <td class="fw-semibold col-aluno">${aluno.nome}</td>
          <td>${profBadge}</td>
          <td>${resumoHtml}</td>
        </tr>
      `;
    }

    html += `
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  area.innerHTML = html;
}

// ── Helpers visuais ───────────────────────────────────────────

function corProficiencia(nivel) {
  if (nivel === "Proficiente") return "bg-success";
  if (nivel === "Básico") return "bg-warning text-dark";
  if (nivel === "Abaixo do Básico") return "bg-danger";
  return "bg-secondary";
}

function lerFaz(jsonb) {
  if (!jsonb || typeof jsonb !== "object") return true;
  if (jsonb.faz !== undefined) return !!jsonb.faz;
  if (jsonb.tem !== undefined) return !jsonb.tem;
  return true;
}

function montarResumoBadges(dados) {
  const badges = [];

  // Dificuldade
  const dif = dados.dificuldade;
  if (dif && typeof dif === "object" && dif.tem) {
    const qtd = dif.materias
      ? String(dif.materias).split(",").map(t => t.trim()).filter(Boolean).length
      : 0;
    badges.push(`<span class="badge text-bg-warning text-dark me-1 mb-1">Dificuldade${qtd > 0 ? ` (${qtd})` : ""}</span>`);
  }

  // Sem atividade em sala
  const sala = dados.faz_atividade_sala;
  if (!lerFaz(sala)) {
    const qtd = sala?.materias
      ? String(sala.materias).split(",").map(t => t.trim()).filter(Boolean).length
      : 0;
    badges.push(`<span class="badge text-bg-secondary me-1 mb-1">Sem atividade${qtd > 0 ? ` (${qtd})` : ""}</span>`);
  }

  // Sem plataforma
  const plat = dados.faz_plataforma;
  if (!lerFaz(plat)) {
    const qtd = plat?.materias
      ? String(plat.materias).split(",").map(t => t.trim()).filter(Boolean).length
      : 0;
    badges.push(`<span class="badge text-bg-info me-1 mb-1">Sem plataforma${qtd > 0 ? ` (${qtd})` : ""}</span>`);
  }

  // Indisciplina
  const ind = dados.indisciplina;
  const temInd = ind && typeof ind === "object" ? !!ind.tem : !!ind;
  if (temInd) {
    badges.push(`<span class="badge text-bg-danger me-1 mb-1">Indisciplina</span>`);
  }

  return badges.length > 0 ? badges.join("") : `<span class="text-muted small">Sem apontamentos</span>`;
}

// ── Geração de PDF ────────────────────────────────────────────

async function gerarPDF() {
  if (!window.jspdf?.jsPDF) {
    alert("jsPDF não carregou. Verifique os scripts no HTML.");
    return;
  }

  if (tutoradosCache.length === 0) {
    alert("Nenhum tutorado para gerar o relatório.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF("landscape", "mm", "a4");

  const pageW = doc.internal.pageSize.getWidth();
  const marginL = 8;
  const marginR = 8;
  const contentW = pageW - marginL - marginR;

  // Agrupa por turma (igual ao render)
  const porTurma = {};
  tutoradosCache.forEach(t => {
    const turmaId = t.alunos?.turma_id || "sem-turma";
    if (!porTurma[turmaId]) {
      porTurma[turmaId] = {
        turma: t.alunos?.turmas || { nome: "Sem turma", ano: "" },
        alunos: []
      };
    }
    porTurma[turmaId].alunos.push(t.alunos);
  });

  const turmasOrdenadas = Object.entries(porTurma).sort(([, a], [, b]) => {
    const ensinoA = a.turma.ensino || "";
    const ensinoB = b.turma.ensino || "";
    if (ensinoA !== ensinoB) return ensinoA.localeCompare(ensinoB, "pt-BR");
    return (a.turma.nome || "").localeCompare(b.turma.nome || "", "pt-BR");
  });

  // Monta todas as linhas de todas as turmas em sequência
  const linhasPDF = [];

  for (const [turmaId, grupo] of turmasOrdenadas) {
    const nomeTurma = `${grupo.turma.nome} - ${grupo.turma.ano}`;

    // Linha separadora de turma
    linhasPDF.push([
      { content: nomeTurma, colSpan: 5, styles: { fillColor: [30, 60, 114], textColor: 255, fontStyle: "bold", fontSize: 9 } }
    ]);

    const alunosOrdenados = [...grupo.alunos].sort((a, b) =>
      (a?.numero_chamada ?? 9999) - (b?.numero_chamada ?? 9999)
    );

    for (const aluno of alunosOrdenados) {
      const dados = dadosConselhoCache[aluno.id] || null;

      const proficiencia = dados?.nivel_proficiencia || "—";

      let resumo = "Sem dados do conselho";
      if (dados) {
        const partes = [];
        const dif = dados.dificuldade;
        if (dif?.tem) {
          const qtd = dif.materias ? String(dif.materias).split(",").filter(t => t.trim()).length : 0;
          partes.push(`Dificuldade${qtd > 0 ? ` (${qtd})` : ""}`);
        }
        if (!lerFaz(dados.faz_atividade_sala)) {
          const qtd = dados.faz_atividade_sala?.materias
            ? String(dados.faz_atividade_sala.materias).split(",").filter(t => t.trim()).length : 0;
          partes.push(`Sem atividade${qtd > 0 ? ` (${qtd})` : ""}`);
        }
        if (!lerFaz(dados.faz_plataforma)) {
          const qtd = dados.faz_plataforma?.materias
            ? String(dados.faz_plataforma.materias).split(",").filter(t => t.trim()).length : 0;
          partes.push(`Sem plataforma${qtd > 0 ? ` (${qtd})` : ""}`);
        }
        const ind = dados.indisciplina;
        if (ind && typeof ind === "object" ? !!ind.tem : !!ind) {
          partes.push("Indisciplina");
        }
        resumo = partes.length > 0 ? partes.join("   ") : "Sem apontamentos";
      }

      linhasPDF.push([
        aluno.numero_chamada ?? "",
        aluno.nome || "",
        nomeTurma,
        proficiencia,
        ""  // Assinatura
      ]);
    }
  }

  // Cabeçalho do PDF
  const nomeProfessor = professorLogado?.nome || "Professor";
  const dataEmissao = new Date().toLocaleDateString("pt-BR");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("PEI Manoel Ignácio da Silva", pageW / 2, 10, { align: "center" });

  doc.setFontSize(11);
  doc.text(
    `Relatório de Tutoria • ${nomeProfessor} • ${bimestreAtivo}º Bimestre`,
    pageW / 2, 16.5, { align: "center" }
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Emissão: ${dataEmissao}`, pageW - marginR, 23, { align: "right" });
  doc.text(`Total de tutorados: ${tutoradosCache.length}`, marginL, 23);

  doc.autoTable({
    head: [["Nº", "Aluno", "Turma", "Proficiência", "Assinatura do Responsável"]],
    body: linhasPDF,
    startY: 28,
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
      0: { cellWidth: 12, halign: "center" },
      1: { cellWidth: 70 },
      2: { cellWidth: 45 },
      3: { cellWidth: 35 },
      4: { cellWidth: 100 }
    },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    didParseCell: function(data) {
      // Cabeçalhos de turma têm colSpan — não alterar
      if (data.cell.raw === "Sem apontamentos" || data.cell.raw === "Sem dados do conselho") {
        data.cell.styles.textColor = [150, 150, 150];
        data.cell.styles.fontStyle = "italic";
      }
    }
  });

  doc.save(`Tutoria_${nomeProfessor.replace(/\s+/g, "_")}_${bimestreAtivo}Bim.pdf`);
}
