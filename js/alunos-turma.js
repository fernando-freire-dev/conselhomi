let professorAtual = null;

async function carregarPagina() {

  const {
    data: { user }
  } = await supabaseClient.auth.getUser();

  if (!user) {
    window.location.href = "index.html";
    return;
  }

  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  professorAtual = profile;

  document.getElementById("tituloTurma").innerText =
    `Professor: ${profile.nome}`;
}

document.addEventListener(
  "DOMContentLoaded",
  carregarPagina
);
