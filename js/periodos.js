// =====================================================
// PERIODOS.JS
// Funções relacionadas ao controle de períodos/bimestres
// =====================================================

async function verificarPeriodoAberto(bimestre) {

  const numeroBimestre = parseInt(bimestre);

  const { data: periodo, error } = await supabaseClient
    .from("periodos")
    .select("status")
    .eq("bimestre", numeroBimestre)
    .maybeSingle();

  if (error) {
    console.error("Erro ao consultar período:", error);
    throw new Error("Erro ao verificar o status do período.");
  }

  if (!periodo) {
    throw new Error(`Período ${numeroBimestre} não encontrado.`);
  }

  return periodo.status === "aberto";
}

async function validarPeriodoAberto(bimestre) {

  try {

    const aberto = await verificarPeriodoAberto(bimestre);

    if (!aberto) {
      alert(`❌ O ${bimestre}º bimestre está fechado para edição.`);
      return false;
    }

    return true;

  } catch (erro) {

    console.error(erro);
    alert(erro.message);

    return false;
  }
}

// =====================================================
// Busca o bimestre com status "aberto" e pré-seleciona
// o <select> informado pelo ID.
// Retorna o número do bimestre ativo ou null.
// =====================================================
async function carregarBimestreAtivo(selectId) {

  const { data, error } = await supabaseClient
    .from("periodos")
    .select("bimestre")
    .eq("status", "aberto")
    .order("bimestre")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar bimestre ativo:", error);
    return null;
  }

  if (!data) return null;

  const select = document.getElementById(selectId);
  if (select) {
    select.value = String(data.bimestre);
  }

  return data.bimestre;
}
