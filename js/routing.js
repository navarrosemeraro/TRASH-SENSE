let camadaRota = null;
let rotaTracada = false;

// Calcula distância aproximada entre duas coordenadas (em km)
function calcularDistanciaKm(coordA, coordB) {
  const rad = Math.PI / 180;
  const dLat = (coordB[0] - coordA[0]) * rad;
  const dLon = (coordB[1] - coordA[1]) * rad;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(coordA[0] * rad) *
      Math.cos(coordB[0] * rad) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Ordena os pontos pelo vizinho mais próximo para evitar zigue-zague no mapa
function ordenarTrajeto(origemCoords, listaPontos) {
  const pendentes = [...listaPontos];
  const ordenados = [];
  let atual = origemCoords;
  let distanciaTotal = 0;

  while (pendentes.length > 0) {
    let maisProximoIdx = 0;
    let menorDist = calcularDistanciaKm(atual, pendentes[0].coords);

    for (let i = 1; i < pendentes.length; i++) {
      const dist = calcularDistanciaKm(atual, pendentes[i].coords);
      if (dist < menorDist) {
        menorDist = dist;
        maisProximoIdx = i;
      }
    }

    const proximo = pendentes.splice(maisProximoIdx, 1)[0];
    ordenados.push(proximo);
    distanciaTotal += menorDist;
    atual = proximo.coords;
  }

  // Soma o retorno para a base operacional
  distanciaTotal += calcularDistanciaKm(atual, origemCoords);

  return { ordenados, distanciaTotal };
}

function limparRotaDoMapa() {
  if (camadaRota) {
    mapa.removeLayer(camadaRota);
    camadaRota = null;
  }
  const resumoFlutuante = document.getElementById("route-summary-pill");
  if (resumoFlutuante) resumoFlutuante.remove();
}

function desenharRotaNoMapa() {
  limparRotaDoMapa();

  const criticos = pontos.filter((p) => p.ocupacao >= TRASHSENSE_CONFIG.limiteCritico);
  const btnColeta = document.getElementById("btn-collect");

  if (criticos.length === 0) {
    rotaTracada = false;
    btnColeta.textContent = "Traçar Rota de Coleta";
    mostrarAvisoRota("Nenhuma lixeira atingiu 80% ainda. Clique em '+ Simular Descarte'.");
    return;
  }

  const base = TRASHSENSE_CONFIG.pontoPartida;
  const trajetoTradicional = ordenarTrajeto(base.coords, pontos);
  const trajetoOtimizado = ordenarTrajeto(base.coords, criticos);

  camadaRota = L.layerGroup().addTo(mapa);

  // 1. Linha tracejada cinza: rota tradicional (passa em todas as 8 lixeiras)
  const coordsTradicional = [
    base.coords,
    ...trajetoTradicional.ordenados.map((p) => p.coords),
    base.coords
  ];
  L.polyline(coordsTradicional, {
    color: "#8C977D",
    weight: 3,
    opacity: 0.55,
    dashArray: "7, 8"
  }).addTo(camadaRota);

  // 2. Linha sólida verde-musgo: rota inteligente TrashSense (só nas cheias)
  const coordsOtimizada = [
    base.coords,
    ...trajetoOtimizado.ordenados.map((p) => p.coords),
    base.coords
  ];
  const linhaOtimizada = L.polyline(coordsOtimizada, {
    color: "#526C2A",
    weight: 5,
    opacity: 0.95
  }).addTo(camadaRota);

  // 3. Marcador da Base Operacional (Garagem)
  const iconeBase = L.divIcon({
    className: "ts-marker-wrapper",
    html: `<div class="ts-depot-marker">Base • Garagem</div>`,
    iconSize: [116, 28],
    iconAnchor: [58, 14]
  });
  L.marker(base.coords, { icon: iconeBase }).addTo(camadaRota);

  // 4. Numeração da ordem de parada nas lixeiras críticas
  trajetoOtimizado.ordenados.forEach((ponto, index) => {
    const iconeOrdem = L.divIcon({
      className: "ts-marker-wrapper",
      html: `<div class="ts-stop-badge">${index + 1}</div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 28]
    });
    L.marker(ponto.coords, { icon: iconeOrdem }).addTo(camadaRota);
  });

  // Ajusta o zoom suavemente para enquadrar toda a rota
  mapa.fitBounds(linhaOtimizada.getBounds(), { padding: [55, 55] });

  const kmTradicional = trajetoTradicional.distanciaTotal.toFixed(1).replace(".", ",");
  const kmOtimizado = trajetoOtimizado.distanciaTotal.toFixed(1).replace(".", ",");

  mostrarAvisoRota(
    `Rota Otimizada: <strong>${criticos.length} paradas (${kmOtimizado} km)</strong> vs. Tradicional: ${pontos.length} paradas (${kmTradicional} km)`
  );

  rotaTracada = true;
  btnColeta.textContent = "Concluir Coleta (Esvaziar)";
}

function executarColeta() {
  pontos = pontos.map((ponto) => {
    if (ponto.ocupacao >= TRASHSENSE_CONFIG.limiteCritico) {
      return { ...ponto, ocupacao: 6 }; // Lixeira esvaziada
    }
    return ponto;
  });

  limparRotaDoMapa();
  rotaTracada = false;
  document.getElementById("btn-collect").textContent = "Traçar Rota de Coleta";
  atualizarInterface();
}

function mostrarAvisoRota(mensagemHtml) {
  const avisoAnterior = document.getElementById("route-summary-pill");
  if (avisoAnterior) avisoAnterior.remove();

  const mapPanel = document.querySelector(".map-panel");
  const pill = document.createElement("div");
  pill.id = "route-summary-pill";
  pill.className = "route-summary-pill";
  pill.innerHTML = mensagemHtml;
  mapPanel.appendChild(pill);
}

document.addEventListener("DOMContentLoaded", () => {
  const btnColeta = document.getElementById("btn-collect");
  const btnSimular = document.getElementById("btn-step");

  btnColeta.addEventListener("click", () => {
    if (!rotaTracada) {
      desenharRotaNoMapa();
    } else {
      executarColeta();
    }
  });

  // Se simular mais descartes com a rota já aberta, recalcula automaticamente
  btnSimular.addEventListener("click", () => {
    if (rotaTracada) {
      desenharRotaNoMapa();
    }
  });
});