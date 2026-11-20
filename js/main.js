const TITULOS_ABAS = {
  home: "Visão Executiva",
  overview: "Mapa de Lixeiras",
  bins: "Contêineres Monitorados",
  routes: "Rotas de Coleta",
  goals: "Impacto e Metas"
};

function alternarAba(abaAlvo) {
  const botoes = document.querySelectorAll(".nav-item");
  const secoes = document.querySelectorAll(".view-section");
  const titulo = document.getElementById("topbar-heading");

  botoes.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === abaAlvo);
  });

  secoes.forEach((secao) => {
    secao.classList.toggle("hidden", secao.id !== `view-${abaAlvo}`);
  });

  if (titulo && TITULOS_ABAS[abaAlvo]) {
    titulo.textContent = TITULOS_ABAS[abaAlvo];
  }

  if (abaAlvo === "overview" && typeof mapa !== "undefined" && mapa) {
    setTimeout(() => mapa.invalidateSize(), 80);
  }

  renderizarPaginaInicial();
  renderizarTabelaLixeiras();
  renderizarComparativoRotas();
}

// Sincroniza a Página Inicial com os dados reais dos 8 contêineres
function renderizarPaginaInicial() {
  const total = pontos.length;
  const criticos = pontos.filter((p) => p.ocupacao >= TRASHSENSE_CONFIG.limiteCritico).length;
  const atencao = pontos.filter(
    (p) =>
      p.ocupacao >= TRASHSENSE_CONFIG.limiteAtencao &&
      p.ocupacao < TRASHSENSE_CONFIG.limiteCritico
  ).length;
  const disponiveis = total - criticos - atencao;

  const pctOk = Math.round((disponiveis / total) * 100);
  const pctWarn = Math.round((atencao / total) * 100);
  const pctCritical = 100 - pctOk - pctWarn;

  // 4 Cards superiores
  const elTotal = document.getElementById("home-total-bins");
  if (elTotal) elTotal.textContent = total;
  document.getElementById("home-pct-ok").textContent = `${pctOk}%`;
  document.getElementById("home-pct-warn").textContent = `${pctWarn}%`;
  document.getElementById("home-pct-critical").textContent = `${pctCritical}%`;

  // Card escuro de Rotas
  document.getElementById("home-active-routes").textContent = criticos > 0 ? "1" : "0";

  // Indicadores da operação (litros atuais + já coletados + economia)
  const litrosAtuais = pontos.reduce(
    (acc, p) => acc + Math.round((p.ocupacao / 100) * TRASHSENSE_CONFIG.capacidadeLitros),
    0
  );
  const totalVolume = litrosAtuais + (typeof litrosColetadosAcumulados !== "undefined" ? litrosColetadosAcumulados : 0);
  document.getElementById("home-waste-volume").textContent = `${totalVolume.toLocaleString("pt-BR")} L`;

  const evitadas = total - criticos;
  const economia =
    criticos === 0 ? 100 : Math.min(35, Math.max(15, Math.round((evitadas / total) * 38)));
  document.getElementById("home-route-saving").textContent = `-${economia}%`;

  // Gráfico: média real de ocupação de Praias da Baía (UFF / Icaraí)
  const mediaOcupacao = Math.round(
    pontos.reduce((acc, p) => acc + p.ocupacao, 0) / total
  );
  document.getElementById("bar-val-baia").textContent = `${mediaOcupacao}%`;
  document.getElementById("bar-fill-baia").style.height = `${mediaOcupacao}%`;

  // Carimbo de horário atualizado
  const agora = new Date();
  const dataFmt = agora.toLocaleDateString("pt-BR");
  const horaFmt = agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  document.getElementById("home-last-update").textContent = `${dataFmt} às ${horaFmt}`;
}

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

function renderizarComparativoRotas() {
  const container = document.getElementById("routes-comparison-cards");
  if (!container) return;

  const base = TRASHSENSE_CONFIG.pontoPartida;
  const criticos = pontos.filter((p) => p.ocupacao >= TRASHSENSE_CONFIG.limiteCritico);
  const trajetoFixo = ordenarTrajeto(base.coords, pontos);
  const trajetoInteligente =
    criticos.length > 0 ? ordenarTrajeto(base.coords, criticos) : { ordenados: [], distanciaTotal: 0 };

  const kmFixo = trajetoFixo.distanciaTotal.toFixed(1).replace(".", ",");
  const kmInteligente = trajetoInteligente.distanciaTotal.toFixed(1).replace(".", ",");
  const economiaReal =
    criticos.length === 0
      ? 100
      : Math.max(
          0,
          Math.round(
            ((trajetoFixo.distanciaTotal - trajetoInteligente.distanciaTotal) /
              trajetoFixo.distanciaTotal) *
              100
          )
        );

  const listaParadas =
    trajetoInteligente.ordenados.length > 0
      ? trajetoInteligente.ordenados
          .map((p, idx) => `${idx + 1}. ${p.nome} (${p.ocupacao}%)`)
          .join(" &rarr; ")
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

const atualizarInterfaceBase = atualizarInterface;
atualizarInterface = function () {
  atualizarInterfaceBase();
  renderizarPaginaInicial();
  renderizarTabelaLixeiras();
  renderizarComparativoRotas();
};

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => alternarAba(btn.dataset.view));
  });

  const btnHomeRoutes = document.getElementById("btn-home-to-routes");
  if (btnHomeRoutes) {
    btnHomeRoutes.addEventListener("click", () => alternarAba("routes"));
  }

  const btnIrMapa = document.getElementById("btn-go-route-map");
  if (btnIrMapa) {
    btnIrMapa.addEventListener("click", () => {
      alternarAba("overview");
      if (!rotaTracada) desenharRotaNoMapa();
    });
  }

  renderizarPaginaInicial();
  renderizarTabelaLixeiras();
  renderizarComparativoRotas();
});