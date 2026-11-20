let pontos = TRASHSENSE_CONFIG.pontosColeta.map((p) => ({ ...p }));
let pontoSelecionadoId = "TS-01";
let termoBusca = "";
let mapa = null;
let camadaMarcadores = null;

function classificarStatus(ocupacao) {
  if (ocupacao >= TRASHSENSE_CONFIG.limiteCritico) {
    return {
      codigo: "critical",
      rotulo: "Cheia • Coletar",
      acao: "Incluir na próxima rota",
      cor: "var(--status-critical)"
    };
  }
  if (ocupacao >= TRASHSENSE_CONFIG.limiteAtencao) {
    return {
      codigo: "warn",
      rotulo: "Atenção",
      acao: "Monitorar enchimento",
      cor: "var(--status-warn)"
    };
  }
  return {
    codigo: "ok",
    rotulo: "Disponível",
    acao: "Não precisa coletar",
    cor: "var(--status-ok)"
  };
}

function inicializarMapa() {
  mapa = L.map("map", { zoomControl: false }).setView(
    TRASHSENSE_CONFIG.centroMapa,
    TRASHSENSE_CONFIG.zoomInicial
  );

  // Mapa claro e limpo para combinar com a paleta TrashSense
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap",
    maxZoom: 19
  }).addTo(mapa);

  L.control.zoom({ position: "bottomright" }).addTo(mapa);
  camadaMarcadores = L.layerGroup().addTo(mapa);
}

function renderizarMapa() {
  if (!camadaMarcadores) return;
  camadaMarcadores.clearLayers();

  pontos.forEach((ponto) => {
    const status = classificarStatus(ponto.ocupacao);
    const selecionado = ponto.id === pontoSelecionadoId;
    const correspondeBusca =
      termoBusca === "" ||
      ponto.nome.toLowerCase().includes(termoBusca) ||
      ponto.id.toLowerCase().includes(termoBusca) ||
      ponto.bairro.toLowerCase().includes(termoBusca);

    const icone = L.divIcon({
      className: "ts-marker-wrapper",
      html: `
        <div class="ts-marker status-${status.codigo} ${selecionado ? "selected" : ""} ${
          !correspondeBusca ? "dimmed" : ""
        }">
          <span class="ts-dot"></span>
          <span>${ponto.id} • ${ponto.ocupacao}%</span>
        </div>
      `,
      iconSize: [104, 30],
      iconAnchor: [52, 15]
    });

    const marcador = L.marker(ponto.coords, { icon: icone });

    marcador.on("click", () => {
      pontoSelecionadoId = ponto.id;
      mapa.panTo(ponto.coords);
      atualizarInterface();
    });

    marcador.addTo(camadaMarcadores);
  });
}

function renderizarDetalhes() {
  const ponto = pontos.find((p) => p.id === pontoSelecionadoId) || pontos[0];
  const status = classificarStatus(ponto.ocupacao);
  const litrosOcupados = Math.round((ponto.ocupacao / 100) * TRASHSENSE_CONFIG.capacidadeLitros);

  document.getElementById("detail-name").textContent = ponto.nome;

  const badge = document.getElementById("detail-badge");
  badge.textContent = `${ponto.ocupacao}% • ${status.rotulo}`;
  badge.style.backgroundColor =
    status.codigo === "critical"
      ? "rgba(200, 75, 49, 0.14)"
      : status.codigo === "warn"
      ? "rgba(212, 155, 39, 0.16)"
      : "var(--bg-badge-green)";
  badge.style.color =
    status.codigo === "critical"
      ? "var(--status-critical)"
      : status.codigo === "warn"
      ? "#9A6E12"
      : "var(--verde-musgo)";

  document.getElementById("detail-volume").textContent =
    `Volume ocupado (${litrosOcupados} L de ${TRASHSENSE_CONFIG.capacidadeLitros} L)`;

  const barra = document.getElementById("detail-bar");
  barra.style.width = `${ponto.ocupacao}%`;
  barra.style.backgroundColor = status.cor;

  document.getElementById("detail-id").textContent = `${ponto.id} (${ponto.bairro})`;
  document.getElementById("detail-action").textContent = status.acao;
}

function renderizarResumo() {
  const total = pontos.length;
  const criticos = pontos.filter((p) => p.ocupacao >= TRASHSENSE_CONFIG.limiteCritico).length;
  const atencao = pontos.filter(
    (p) =>
      p.ocupacao >= TRASHSENSE_CONFIG.limiteAtencao &&
      p.ocupacao < TRASHSENSE_CONFIG.limiteCritico
  ).length;
  const disponiveis = total - criticos - atencao;

  const evitadas = total - criticos;
  const economia =
    criticos === 0 ? 100 : Math.min(35, Math.max(15, Math.round((evitadas / total) * 38)));

  document.getElementById("kpi-economy").textContent = `-${economia}%`;
  document.getElementById("kpi-critical").textContent = `${criticos} de ${total}`;
  document.getElementById("kpi-skipped").textContent = `${evitadas} lixeiras`;

  const pctOk = Math.round((disponiveis / total) * 100);
  const pctWarn = Math.round((atencao / total) * 100);
  const pctFull = 100 - pctOk - pctWarn;

  document.getElementById("seg-ok").style.width = `${pctOk}%`;
  document.getElementById("seg-warn").style.width = `${pctWarn}%`;
  document.getElementById("seg-full").style.width = `${pctFull}%`;

  document.getElementById("legend-ok").textContent = `Disponíveis (${pctOk}%)`;
  document.getElementById("legend-warn").textContent = `Quase cheias (${pctWarn}%)`;
  document.getElementById("legend-full").textContent = `Cheias (${pctFull}%)`;
}

function simularDescarte() {
  pontos = pontos.map((ponto) => {
    const variacao = Math.floor(Math.random() * 7) - 2;
    const incremento = Math.max(4, ponto.fluxoHora + variacao);
    return {
      ...ponto,
      ocupacao: Math.min(100, ponto.ocupacao + incremento)
    };
  });
  atualizarInterface();
}

function atualizarInterface() {
  renderizarMapa();
  renderizarDetalhes();
  renderizarResumo();
}

document.addEventListener("DOMContentLoaded", () => {
  inicializarMapa();
  atualizarInterface();

  document.getElementById("btn-step").addEventListener("click", simularDescarte);

  document.getElementById("search-input").addEventListener("input", (e) => {
    termoBusca = e.target.value.trim().toLowerCase();
    renderizarMapa();
  });
});