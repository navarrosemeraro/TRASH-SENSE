// Controla a navegação entre as telas do menu lateral e sincroniza os dados
function alternarAba(abaAlvo) {
  const botoes = document.querySelectorAll(".nav-item");
  const secoes = document.querySelectorAll(".view-section");

  botoes.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === abaAlvo);
  });

  secoes.forEach((secao) => {
    secao.classList.toggle("hidden", secao.id !== `view-${abaAlvo}`);
  });

  // Garante que o mapa redimensione corretamente ao voltar para a Visão Geral
  if (abaAlvo === "overview" && typeof mapa !== "undefined" && mapa) {
    setTimeout(() => mapa.invalidateSize(), 80);
  }

  renderizarTabelaLixeiras();
  renderizarComparativoRotas();
}

// Renderiza a aba "Lixeiras (1.200 L)" com todos os pontos de Niterói
function renderizarTabelaLixeiras() {
  const tbody = document.getElementById("bins-table-body");
  if (!tbody) return;

  tbody.innerHTML = "";

  pontos.forEach((ponto) => {
    const status = classificarStatus(ponto.ocupacao);
    const litros = Math.round((ponto.ocupacao / 100) * TRASHSENSE_CONFIG.capacidadeLitros);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${ponto.id}</strong></td>
      <td>${ponto.nome}</td>
      <td>${ponto.bairro}</td>
      <td>
        <div class="table-meter">
          <div class="table-meter-track">
            <div class="table-meter-fill" style="width: ${ponto.ocupacao}%; background-color: ${status.cor};"></div>
          </div>
          <span>${ponto.ocupacao}% (${litros} L)</span>
        </div>
      </td>
      <td><span class="table-pill status-${status.codigo}">${status.rotulo}</span></td>
      <td>
        <button type="button" class="btn-table-action" data-id="${ponto.id}">Ver no mapa</button>
      </td>
    `;

    tr.querySelector(".btn-table-action").addEventListener("click", () => {
      pontoSelecionadoId = ponto.id;
      alternarAba("overview");
      mapa.setView(ponto.coords, 16);
      atualizarInterface();
    });

    tbody.appendChild(tr);
  });
}

// Renderiza a aba "Rotas de Coleta" comparando o modelo fixo vs. TrashSense
function renderizarComparativoRotas() {
  const container = document.getElementById("routes-comparison-cards");
  if (!container) return;

  const base = TRASHSENSE_CONFIG.pontoPartida;
  const criticos = pontos.filter((p) => p.ocupacao >= TRASHSENSE_CONFIG.limiteCritico);
  const trajetoFixo = ordenarTrajeto(base.coords, pontos);
  const trajetoInteligente = criticos.length > 0 ? ordenarTrajeto(base.coords, criticos) : { ordenados: [], distanciaTotal: 0 };

  const kmFixo = trajetoFixo.distanciaTotal.toFixed(1).replace(".", ",");
  const kmInteligente = trajetoInteligente.distanciaTotal.toFixed(1).replace(".", ",");
  const economiaReal =
    criticos.length === 0
      ? 100
      : Math.max(0, Math.round(((trajetoFixo.distanciaTotal - trajetoInteligente.distanciaTotal) / trajetoFixo.distanciaTotal) * 100));

  const listaParadas =
    trajetoInteligente.ordenados.length > 0
      ? trajetoInteligente.ordenados.map((p, idx) => `${idx + 1}. ${p.nome} (${p.ocupacao}%)`).join(" &rarr; ")
      : "Nenhuma lixeira atingiu 80% no momento.";

  container.innerHTML = `
    <article class="card route-compare-card">
      <span class="badge-neutral">Modelo Tradicional (Rota Fixa)</span>
      <h3>Coleta em Todos os Pontos</h3>
      <p class="route-desc">O caminhão percorre toda a região diariamente, mesmo parando em contêineres quase vazios.</p>
      <div class="route-stats">
        <div><small>Paradas obrigatórias</small><strong>${pontos.length} lixeiras</strong></div>
        <div><small>Distância percorrida</small><strong>${kmFixo} km</strong></div>
      </div>
    </article>

    <article class="card route-compare-card highlight-green">
      <span class="badge-pill">Modelo TrashSense (Sob Demanda)</span>
      <h3>Coleta Orientada por Sensores</h3>
      <p class="route-desc">O trajeto inclui apenas contêineres acima de 80%, reduzindo combustível e desgaste da frota.</p>
      <div class="route-stats">
        <div><small>Paradas necessárias</small><strong>${criticos.length} lixeiras</strong></div>
        <div><small>Distância otimizada</small><strong>${kmInteligente} km (-${economiaReal}%)</strong></div>
      </div>
      <div class="route-sequence">
        <small>Ordem sugerida de coleta:</small>
        <p>${listaParadas}</p>
      </div>
    </article>
  `;
}

// Integra a atualização das novas abas sempre que o mapa ou os sensores mudarem
const atualizarInterfaceBase = atualizarInterface;
atualizarInterface = function () {
  atualizarInterfaceBase();
  renderizarTabelaLixeiras();
  renderizarComparativoRotas();
};

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => alternarAba(btn.dataset.view));
  });

  const btnIrMapa = document.getElementById("btn-go-route-map");
  if (btnIrMapa) {
    btnIrMapa.addEventListener("click", () => {
      alternarAba("overview");
      if (!rotaTracada) desenharRotaNoMapa();
    });
  }

  renderizarTabelaLixeiras();
  renderizarComparativoRotas();
});