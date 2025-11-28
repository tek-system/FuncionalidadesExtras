const { createApp, ref, reactive, onBeforeMount, onMounted, computed, watch, nextTick, markRaw } = Vue;
const { createVuetify } = Vuetify;
const { pedidos, enderecosEmpresa } = window.DATA_ROTEIRIZAR;
const vuetify = createVuetify({
    theme: { defaultTheme: "light" }
});
const app = createApp({
    setup() {
        const loading = ref(false);
        const map = ref(null);
        const mapDiv = ref(null);
        const directionsService = ref(null);
        const directionsRenderer = ref(null);
        const markers = ref([]);
        const drawer = ref(false);
        const opcoesRota = reactive({
            pontoSaida: null,
            pontoDestino: null,
            evitarPedagios: false,
            evitarRodovias: false,
            evitarBalsas: false,
            apenasCidades: true,
            otimizarDestinos: true,
        });
        const saidaNaEmpresa = ref(true);
        const retornoNaEmpresa = ref(true);
        const metricasResultantesDaRota = reactive({
            distanciaTotalKm: 0.0,
            duracaoTotalHoras: "",
        });
        const dialogState = reactive({
            visivel: false,
            titulo: "",
            texto: "",
            corTitulo: "bg-blue-darken-1",
            corTexto: "text-blue-darken-1"
        });
        function toggleDrawer() {
            drawer.value = !drawer.value;
        }
        function initOpcoesRota(objetoOpcoesRota) {
            const enderecoDefault = enderecosEmpresaRef.value[0].endereco;
            if (objetoOpcoesRota != undefined && objetoOpcoesRota != null) {
                opcoesRota.evitarPedagios = objetoOpcoesRota.evitarPedagios;
                opcoesRota.evitarRodovias = objetoOpcoesRota.evitarRodovias;
                opcoesRota.evitarBalsas = objetoOpcoesRota.evitarBalsas;
                opcoesRota.apenasCidades = objetoOpcoesRota.apenasCidades;
                opcoesRota.otimizarDestinos = objetoOpcoesRota.otimizarDestinos;
                opcoesRota.pontoSaida = objetoOpcoesRota.pontoSaida;
                opcoesRota.pontoDestino = objetoOpcoesRota.pontoDestino;
            }
            else {
                opcoesRota.evitarPedagios = false;
                opcoesRota.evitarRodovias = false;
                opcoesRota.evitarBalsas = false;
                opcoesRota.apenasCidades = true;
                opcoesRota.otimizarDestinos = true;
                opcoesRota.pontoSaida = enderecoDefault;
                opcoesRota.pontoDestino = enderecoDefault;
            }
        }
        function abrirDialog(titulo, mensagem, corTitulo, corTexto) {
            dialogState.titulo = String(titulo);
            dialogState.texto = String(mensagem);
            dialogState.corTitulo = String(corTitulo);
            dialogState.corTexto = String(corTexto);
            dialogState.visivel = true;
        };
        function fecharDialog() {
            dialogState.titulo = "";
            dialogState.texto = "";
            dialogState.corTitulo = "";
            dialogState.corTexto = "";
            dialogState.visivel = false;
        };
        function limparMarkers() {
            markers.value.forEach(marker => {
                marker.infoWindow.close();   
                marker.setMap(null);
            });
            markers.value = [];
        }
        async function initMap() {
            const enderecoSaida = enderecosEmpresaRef.value.find(item => item.endereco === opcoesRota.pontoSaida);
            let lat = enderecoSaida.lat;
            let lng = enderecoSaida.lng;
            if (!mapDiv.value) {
                abrirDialog("Erro ao carregar o mapa!", "Não foi possível abrir o mapa! Div do mapa não encontrada.", "bg-red-darken-4", "text-red-darken-4")
                console.error("Div do mapa não encontrada.");
                return null;
            }
            if (typeof google === "undefined" || typeof google.maps === "undefined") {
                abrirDialog("Erro API Google", "Não foi possível carregar a API do Google Maps. Verifique sua chave e conexão.", "bg-red-darken-4", "text-red-darken-4");
                console.error("Google Maps API não carregou.");
                return null;
            }
            const localizacao = {
                lat: parseFloat(lat),
                lng: parseFloat(lng)
            };
            map.value = new google.maps.Map(mapDiv.value, {
                zoom: 5,
                center: localizacao,
                mapTypeId: "roadmap"
            });
            await nextTick();
            directionsService.value = new google.maps.DirectionsService();
            directionsRenderer.value = new google.maps.DirectionsRenderer({ suppressMarkers: true });
            directionsRenderer.value.setMap(map.value);                    
            await calcularRota();
        };        
        async function calcularRota() {
            
            try {
                loading.value = true;
                if (pedidosRef.value.length === 0)
                    throw new Error("Nenhum ponto de entrega identificado!");
                await desenharRota();
                limparMarkers();
                adicionarMarkers(map.value);
            } catch (error) {
                console.error("Ocorreu um erro:", error);
                abrirDialog(
                    "Ocorreu um erro!",
                    String(error),
                    "bg-red-darken-4",
                    "text-red-darken-4"
                );
                loading.value = false;
            }
        }
        async function desenharRota() {
            const request = await montarRequestRota();
            if (!directionsRenderer.value || !directionsService.value) {
                await nextTick();
                directionsService.value = new google.maps.DirectionsService();
                directionsRenderer.value = new google.maps.DirectionsRenderer();
                directionsRenderer.value.setMap(map.value);
            }
            loading.value = true;
            try {
                const renderer = directionsRenderer.value;
                const result = await directionsService.value.route(request);
                renderer.setDirections(result);
                setMetricasResultantesDaRota(result.routes[0].legs);
            } catch (status) {
                console.error("Erro ao calcular a rota:", status);
                abrirDialog(
                    "Erro na Rota",
                    `Não foi possível calcular a rota. Status: ${status}`,
                    "bg-red-darken-4",
                    "text-red-darken-4"
                );
            } finally {
                loading.value = false;
            }
        }
        async function montarRequestRota() {
            if (typeof google === "undefined" || typeof google.maps === "undefined") {
                console.warn("A API do Google Maps ainda não foi carregada.");
                return null;
            }
            const dadosParaRequest = enderecosDestinos.value;
            const originItem = dadosParaRequest.find(item => item.endereco === opcoesRota.pontoSaida);
            const destinationItem = dadosParaRequest.find(item => item.endereco === opcoesRota.pontoDestino);
            if (!originItem || !destinationItem)
                throw new Error("Não foi possível encontrar as coordenadas para a saída ou destino.");
            const originCoords = originItem.lat.replace(",", ".") + "," + originItem.lng.replace(",", ".");
            const destinationCoords = destinationItem.lat.replace(",", ".") + "," + destinationItem.lng.replace(",", ".");
            const waypoints = dadosParaRequest
                .filter(item => 
                    !item.possivelSaida && 
                    item.endereco !== opcoesRota.pontoDestino &&
                    item.lat != "0" && item.lng != "0"
                )
                .map(endereco => ({
                    location: endereco.lat.replace(",", ".") + "," + endereco.lng.replace(",", "."),
                    stopover: true
                })
            );
            const request = {
                origin: originCoords,
                destination: destinationCoords,
                waypoints: waypoints,
                optimizeWaypoints: opcoesRota.otimizarDestinos,
                avoidTolls: opcoesRota.evitarPedagios,
                avoidHighways: opcoesRota.evitarRodovias,
                avoidFerries: opcoesRota.evitarBalsas,
                travelMode: google.maps.TravelMode.DRIVING
            };
            return request;
        }
        function adicionarMarkers(map) {
            const pontosDaRota = enderecosDestinos.value;
            let openedInfoWindow = null;
            pontosDaRota.forEach((ponto, index) => {
                const latLng = {
                    lat: parseFloat(ponto.lat.replace(",", ".")),
                    lng: parseFloat(ponto.lng.replace(",", "."))
                };
                let infoWindowContent;
                let title;
                let isSaidaOrDestino = ponto.endereco === opcoesRota.pontoSaida || ponto.endereco === opcoesRota.pontoDestino;
                if (isSaidaOrDestino) {
                    let tipo;
                    if (ponto.endereco === opcoesRota.pontoSaida && ponto.endereco === opcoesRota.pontoDestino) {
                        tipo = '<strong>Saída (Origem) e Destino (Final)</strong>';
                    } else if (ponto.endereco === opcoesRota.pontoSaida) {
                        tipo = '<strong>Saída (Origem)</strong>';
                    } else if (ponto.endereco === opcoesRota.pontoDestino) {
                        tipo = '<strong>Destino (Final)</strong>';
                    }
                    title = tipo;
                    infoWindowContent = `
                        <div style="font-size: 0.9rem; line-height: 1.3;">
                            <strong>Ponto #${index + 1}</strong>
                            <p><span style="font-weight: bold;">Tipo:</span> ${tipo}</p>
                            <p><span style="font-weight: bold;">Endereço:</span> ${ponto.endereco}</p>
                        </div>
                    `;
                } else if (ponto.sequenciaEntrega) {
                    title = `Parada ${index + 1}: ${ponto.endereco} <br>Pedido #${ponto.numeroPedido}`;
                    infoWindowContent = `
                        <div style="font-size: 0.9rem; line-height: 1.3;">
                            <strong>Parada #${index + 1} - Entrega </strong>
                            <p><span style="font-weight: bold;">Sequência:</span> ${ponto.sequenciaEntrega}</p>
                            <p><span style="font-weight: bold;">Pedido:</span> ${ponto.numeroPedido || 'N/A'}</p>
                            <p><span style="font-weight: bold;">Cliente:</span> ${ponto.cliente || 'N/A'}</p>
                            <p><span style="font-weight: bold;">Endereço:</span> ${ponto.endereco}</p>
                        </div>
                    `;
                }
                const marker = new google.maps.Marker({
                    position: latLng,
                    map: map,
                    title: title,
                });
                const infoWindow = new google.maps.InfoWindow({
                    content: infoWindowContent,
                });
                marker.addListener("click", () => {
                    if (openedInfoWindow) {
                        openedInfoWindow.close();
                    }
                    infoWindow.open(map, marker);
                    openedInfoWindow = infoWindow;
                });
                marker.infoWindow = infoWindow;
                markers.value.push(markRaw(marker));
            });
        }
        function setMetricasResultantesDaRota(legs) {
            const distanceMeters = legs.reduce((total, leg) => total + leg.distance.value, 0);
            const distanceKm = (distanceMeters / 1000).toFixed(2);
            metricasResultantesDaRota.distanciaTotalKm = distanceKm;
            const durationSeconds = legs.reduce((total, leg) => total + leg.duration.value, 0);
            const durationMinutes = Math.ceil(durationSeconds / 60);
            const durationHours = Math.floor(durationMinutes / 60);
            metricasResultantesDaRota.duracaoTotalHoras = `${durationHours} Horas e ${durationMinutes % 60} Minutos`;
        }
        const temCoordenadas = computed(() => {
            return enderecosDestinos.value.some(endereco => 
                endereco.lat != "0" && endereco.lng != "0"
            );
        });
        const pedidosRef = ref(pedidos);
        const enderecosEmpresaRef = ref(enderecosEmpresa);
        const pedidosUnicos = computed(() => {
            const vistos = new Set();
            return pedidosRef.value.filter(item => {
                const chave = `${item.pedido.lat}-${item.pedido.lng}`;
                if (vistos.has(chave)) {
                    return false;
                }
                vistos.add(chave);
                return true;
            }).sort((a, b) => a.sequenciaEntrega - b.sequenciaEntrega);
        });
        const enderecosDocumentos = computed(() => {
            return pedidosUnicos.value.map(pedidoObj => ({
                possivelSaida: false,
                endereco: pedidoObj.pedido.endereco,
                lat: pedidoObj.pedido.lat,
                lng: pedidoObj.pedido.lng,
                sequenciaEntrega: pedidoObj.pedido.sequenciaEntrega,
                numeroPedido: pedidoObj.pedido.numeroPedido,
                cliente: pedidoObj.pedido.cliente,
            }));
        });
        const enderecosDestinos = computed(() => {
            const enderecosEmpresaIncluidosNaRota = enderecosEmpresaRef.value.filter(item =>
                item.endereco === opcoesRota.pontoSaida ||
                item.endereco === opcoesRota.pontoDestino
            );
            const todosEnderecosIncluidosNaRota = enderecosEmpresaIncluidosNaRota.concat(enderecosDocumentos.value);
            const saidaOrigem = todosEnderecosIncluidosNaRota.find(item => item.endereco === opcoesRota.pontoSaida);
            const destinoFinal = todosEnderecosIncluidosNaRota.find(item => item.endereco === opcoesRota.pontoDestino);
            const waypoints = todosEnderecosIncluidosNaRota.filter(item =>
                item.endereco !== opcoesRota.pontoSaida &&
                item.endereco !== opcoesRota.pontoDestino
            ).sort((a, b) => a.sequenciaEntrega - b.sequenciaEntrega);
            
            let listaOrdenada = [saidaOrigem].concat(waypoints).concat([destinoFinal]);
            
            return listaOrdenada;
        });
        const enderecosDistintos = computed(() => {
            const todosEnderecos = enderecosDestinos.value.concat(enderecosEmpresaRef.value);
            return [...new Set(todosEnderecos.map(item => item.endereco))];
        })
        function setParametrosStorage(chave, dataObject) {
            try {
                const jsonString = JSON.stringify(dataObject);
                localStorage.setItem(chave, jsonString);
            } catch (error) {
                console.error("❌ Erro ao salvar no localStorage:", error);
            }
        };
        watch(opcoesRota, async () => {
                setParametrosStorage("opcoesRota", opcoesRota);
                if (typeof google !== "undefined" && typeof google.maps !== "undefined") {
                    await calcularRota();
                }
            }, { deep: true }
        );
        function getParametrosStorage(chave) {
            try {
                const jsonString = localStorage.getItem(chave);
                if (jsonString === null) {
                    throw new Error("Chave não encontrada na storage");
                }
                const dataObject = JSON.parse(jsonString);
                initOpcoesRota(dataObject);
            } catch (error) {
                console.error(error);
                initOpcoesRota(null);
                return null;
            }
        };
        onBeforeMount(() => {
            getParametrosStorage("opcoesRota");
        });
        onMounted(async () => {
            const aguardarGoogle = setInterval(async () => {
                if (typeof google !== "undefined" && typeof google.maps !== "undefined") {
                    clearInterval(aguardarGoogle);
                    await initMap();
                }
            }, 200);
        });
        return {
            loading,
            map,
            mapDiv,
            initMap,
            markers,
            temCoordenadas,
            opcoesRota,
            saidaNaEmpresa,
            retornoNaEmpresa,
            metricasResultantesDaRota,
            drawer,
            toggleDrawer,
            dialogState,
            fecharDialog,
            pedidosRef,
            enderecosEmpresaRef,
            enderecosDestinos,
            enderecosDistintos,
        }
    }
});
app.use(vuetify);
app.mount("#app");