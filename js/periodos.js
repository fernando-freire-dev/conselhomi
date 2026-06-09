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
