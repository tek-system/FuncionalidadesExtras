const { createApp, ref, reactive, onBeforeMount, onMounted, computed, watch, nextTick, markRaw } = Vue;
const { createVuetify } = Vuetify;

const { 
    outrosFretes = [], 
    recolhimentos = [], 
    pedidos = [], 
    enderecosEmpresa = [] 
} = window.DATA_ROTEIRIZAR || {};

const vuetify = createVuetify({
    theme: { defaultTheme: "light" }
});

const app = createApp({
    setup() {
        const loading = ref(false);
        const outrosFretesRef = ref(outrosFretes);
        const recolhimentosRef = ref(recolhimentos);
        const pedidosRef = ref(pedidos);
        const enderecosEmpresaRef = ref(enderecosEmpresa);

        const drawer = ref(false);
        function toggleDrawer() {
            drawer.value = !drawer.value;
        }

        const saidaNaEmpresa = ref(true);
        const retornoNaEmpresa = ref(true);
        const opcoesRota = reactive({
            pontoSaida: null,
            pontoDestino: null,
            evitarPedagios: false,
            evitarRodovias: false,
            evitarBalsas: false,
            apenasCidades: true,
            otimizarDestinos: true
        });

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

        const dialogState = reactive({
            visivel: false,
            titulo: "",
            texto: "",
            corTitulo: "bg-blue-darken-1",
            corTexto: "text-blue-darken-1"
        });

        function abrirDialog(titulo, mensagem, corTitulo, corTexto) {
            dialogState.titulo = String(titulo);
            dialogState.texto = String(mensagem);
            dialogState.corTitulo = String(corTitulo);
            dialogState.corTexto = String(corTexto);
            dialogState.visivel = true;
        }

        function fecharDialog() {
            dialogState.titulo = "";
            dialogState.texto = "";
            dialogState.corTitulo = "";
            dialogState.corTexto = "";
            dialogState.visivel = false;
        }

        const map = ref(null);
        const mapDiv = ref(null);
        const directionsService = ref(null);
        const directionsRenderer = ref(null);
        const markers = ref([]);

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
                mapTypeId: "roadmap",
                fullscreenControl: false,
            });

            await nextTick();

            directionsService.value = new google.maps.DirectionsService();
            directionsRenderer.value = new google.maps.DirectionsRenderer({ suppressMarkers: true });
            directionsRenderer.value.setMap(map.value);

            await calcularRota();
        }

        async function calcularRota() {
            try {
                loading.value = true;

                if (pedidosRef.value.length === 0 && outrosFretesRef.value.length === 0 && recolhimentosRef.value.length === 0)
                    throw new Error("Nenhum ponto de entrega identificado!");

                const result = await desenharRota();
                const novaSequencia = result.routes[0].waypoint_order;

                limparMarkers();
                adicionarMarkers(map.value, novaSequencia);
            } catch (error) {
                console.error("Ocorreu um erro:", error);
                abrirDialog(
                    "Ocorreu um erro!",
                    String(error),
                    "bg-red-darken-4",
                    "text-red-darken-4"
                );
            } finally {
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

            try {
                const renderer = directionsRenderer.value;
                const result = await directionsService.value.route(request);
                renderer.setDirections(result);
                setMetricasResultantesDaRota(result.routes[0].legs);
                return result;
            } catch (status) {
                console.error("Erro ao calcular a rota:", status);
                abrirDialog(
                    "Erro na Rota",
                    `Não foi possível calcular a rota. Status: ${status}`,
                    "bg-red-darken-4",
                    "text-red-darken-4"
                );
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

        function adicionarMarkers(map, novaSequencia) {
            let pontosOrdenados = [];
            let openedInfoWindow = null;
            
            const pontosDaRota = enderecosDestinos.value;

            const pontoSaida = pontosDaRota.find(item => item.endereco === opcoesRota.pontoSaida);
            const pontoDestino = pontosDaRota.find(item => item.endereco === opcoesRota.pontoDestino);

            if (opcoesRota.otimizarDestinos && novaSequencia) {
                const waypoints = pontosDaRota.filter(item => 
                    item.endereco !== opcoesRota.pontoSaida &&
                    item.endereco !== opcoesRota.pontoDestino
                )

                const waypointsComIndex = waypoints.map((item, index) => ({ item, index }));

                waypointsComIndex.sort((a, b) => {
                    return novaSequencia.indexOf(a.index) - novaSequencia.indexOf(b.index);
                });

                const waypointsReordenados = waypointsComIndex.map(obj => obj.item);

                pontosOrdenados = [pontoSaida].concat(waypointsReordenados).concat([pontoDestino]);
            } else {
                pontosOrdenados = pontosDaRota;
            }
            
            pontosOrdenados.forEach((ponto, index) => {
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
                        tipo = "Saída (Origem) e Destino (Final)";
                    } else if (ponto.endereco === opcoesRota.pontoSaida) {
                        tipo = "Saída (Origem)";
                    } else if (ponto.endereco === opcoesRota.pontoDestino) {
                        tipo = "Destino (Final)";
                    }

                    title = tipo;
                    infoWindowContent = `
                        <div style="font-size: 0.9rem; line-height: 1.3;">
                            <strong>Ponto #${index + 1}</strong>
                            <p><span style="font-weight: bold;">Tipo:</span><strong> ${tipo}</strong></p>
                            <p><span style="font-weight: bold;">Endereço:</span> ${ponto.endereco}</p>
                        </div>
                    `;
                } else {
                    title = `Parada ${index + 1}: ${ponto.endereco} - Pedido #${ponto.numeroPedido}`;
                    infoWindowContent = `
                        <div style="font-size: 0.9rem; line-height: 1.3;">
                            <strong>Parada #${index + 1} - Entrega </strong>
                            <p><span style="font-weight: bold;">Sequência:</span> ${ponto.sequenciaEntrega || "N/A"}</p>
                            <p><span style="font-weight: bold;">Tipo:</span><strong> ${ponto.tipo}</strong></p>
                            <p><span style="font-weight: bold;">Pedido:</span> ${ponto.numeroPedido || "N/A"}</p>
                            <p><span style="font-weight: bold;">Cliente:</span> ${ponto.cliente || "N/A"}</p>
                            <p><span style="font-weight: bold;">Endereço:</span> ${ponto.endereco}</p>
                        </div>
                    `;
                } 

                const marker = new google.maps.Marker({
                    position: latLng,
                    map: map,
                    title: title,
                    icon: `http://maps.google.com/mapfiles/ms/micons/${ponto.icon}-dot.png`
                });

                const infoWindow = new google.maps.InfoWindow({
                    content: infoWindowContent,
                });

                marker.addListener("click", () => {
                    if (openedInfoWindow)
                        openedInfoWindow.close();

                    infoWindow.open(map, marker);
                    openedInfoWindow = infoWindow;
                });

                marker.infoWindow = infoWindow;
                markers.value.push(markRaw(marker));
            });
        }

        const metricasResultantesDaRota = reactive({
            distanciaTotalKm: 0.0,
            duracaoTotalHoras: "",
        });

        function setMetricasResultantesDaRota(legs) {
            const distanceMeters = legs.reduce((total, leg) => total + leg.distance.value, 0);
            const distanceKm = (distanceMeters / 1000).toFixed(2);
            metricasResultantesDaRota.distanciaTotalKm = distanceKm;

            const durationSeconds = legs.reduce((total, leg) => total + leg.duration.value, 0);
            const durationMinutes = Math.ceil(durationSeconds / 60);
            const durationHours = Math.floor(durationMinutes / 60);
            metricasResultantesDaRota.duracaoTotalHoras = `${durationHours} Horas e ${durationMinutes % 60} minutos`;
        }

        const temCoordenadas = computed(() => {
            return enderecosDestinos.value.some(endereco => 
                endereco.lat != "0" && endereco.lng != "0"
            );
        });

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

        const recolhimentosUnicos = computed(() => {
            const vistos = new Set();
            return recolhimentosRef.value.filter(item => {
                const chave = `${item.assistencia.lat}-${item.assistencia.lng}`;
                if (vistos.has(chave)) {
                    return false;
                }
                vistos.add(chave);
                return true;
            }).sort((a, b) => a.sequenciaEntrega - b.sequenciaEntrega);
        });

        const outrosFretesColetasUnicas = computed(() => {
            const vistos = new Set();
            return outrosFretesRef.value.filter(item => {
                const chave = `${item.coleta.lat}-${item.coleta.lng}`;
                if (vistos.has(chave)) {
                    return false;
                }
                vistos.add(chave);
                return true;
            }).sort((a, b) => a.numeroPedido - b.numeroPedido);
        });

        const outrosFretesEntregasUnicas = computed(() => {
            const todasAsEntregas = outrosFretesRef.value.flatMap(coletaObj => coletaObj.coleta.entregas);

            const vistos = new Set();            
            return todasAsEntregas.filter(entrega => {
                const chave = `${entrega.lat}-${entrega.lng}`;
                if (vistos.has(chave)) {
                    return false;
                }
                vistos.add(chave);
                return true;
            }).sort((a, b) => a.sequenciaEntrega - b.sequenciaEntrega);
        });

        const enderecosDocumentos = computed(() => {
            let pedidos = [];
            let recolhimentos = [];
            let coletas = [];
            let entregas = [];

            if (filtrosPontos.exibirPedidos && pedidosRef.value) {
                pedidos = pedidosUnicos.value.map(pedidoObj => ({
                    possivelSaida: false,
                    endereco: pedidoObj.pedido.endereco,
                    lat: pedidoObj.pedido.lat,
                    lng: pedidoObj.pedido.lng,
                    sequenciaEntrega: pedidoObj.pedido.sequenciaEntrega,
                    numeroPedido: pedidoObj.pedido.numeroPedido,
                    cliente: pedidoObj.pedido.cliente,
                    tipo: "PEDIDO",
                    icon: "red",
                }));
            }

            if (filtrosPontos.exibirRecolhimentos && recolhimentosRef.value) {
                recolhimentos = recolhimentosUnicos.value.map(recolhimentoObj => ({
                    possivelSaida: false,
                    endereco: recolhimentoObj.assistencia.endereco,
                    lat: recolhimentoObj.assistencia.lat,
                    lng: recolhimentoObj.assistencia.lng,
                    sequenciaEntrega: recolhimentoObj.assistencia.sequenciaEntrega,
                    numeroPedido: recolhimentoObj.assistencia.numeroPedido,
                    cliente: recolhimentoObj.assistencia.cliente,
                    tipo: "RECOLHIMENTO",
                    icon: "green",
                }));
            }

            if (filtrosPontos.exibirOutrosFretesColetas && outrosFretesRef.value) {
                coletas = outrosFretesColetasUnicas.value.map(coletaObj => ({
                    possivelSaida: false,
                    endereco: coletaObj.coleta.endereco,
                    lat: coletaObj.coleta.lat,
                    lng: coletaObj.coleta.lng,
                    numeroPedido: coletaObj.coleta.numeroPedido,
                    cliente: coletaObj.coleta.cliente,
                    tipo: "OUTROS FRETES - COLETA",
                    icon: "orange",
                }));
            }

            if (filtrosPontos.exibirOutrosFretesEntregas && outrosFretesRef.value) {
                    entregas = outrosFretesEntregasUnicas.value.map(entregaObj => ({
                    possivelSaida: false,
                    endereco: entregaObj.endereco,
                    lat: entregaObj.lat,
                    lng: entregaObj.lng,
                    sequenciaEntrega: entregaObj.sequenciaEntrega,
                    numeroPedido: entregaObj.numeroPedido,
                    cliente: entregaObj.cliente,
                    tipo: "OUTROS FRETES - ENTREGA",
                    icon: "purple"
                }));
            }

            const documentos = pedidos.concat(recolhimentos).concat(coletas).concat(entregas);
            const retorno = [...new Set(documentos.map(item => item))];
            return retorno;
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

            return [saidaOrigem].concat(waypoints).concat([destinoFinal]);
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
        }

        watch(opcoesRota, async () => {
            setParametrosStorage("opcoesRota", opcoesRota);
            if (typeof google !== "undefined" && typeof google.maps !== "undefined")
                await calcularRota();
        }, { deep: true } );

        const filtrosPontos = reactive({
            exibirPedidos: true,
            exibirOutrosFretesColetas: true,
            exibirOutrosFretesEntregas: true,
            exibirRecolhimentos: true,
        });

        function initFiltrosPontos(objetoFiltrosPontos) {
            if (objetoFiltrosPontos) {
                filtrosPontos.exibirPedidos = objetoFiltrosPontos.exibirPedidos;
                filtrosPontos.exibirOutrosFretesColetas = objetoFiltrosPontos.exibirOutrosFretesColetas;
                filtrosPontos.exibirOutrosFretesEntregas = objetoFiltrosPontos.exibirOutrosFretesEntregas;
                filtrosPontos.exibirRecolhimentos = objetoFiltrosPontos.exibirRecolhimentos;
            } else {
                filtrosPontos.exibirPedidos = true;
                filtrosPontos.exibirOutrosFretesColetas = true;
                filtrosPontos.exibirOutrosFretesEntregas = true;
                filtrosPontos.exibirRecolhimentos = true;
            }
        }

        watch(filtrosPontos, async () => {
            try {
                setParametrosStorage("filtrosPontos", filtrosPontos);                
                if (typeof google !== "undefined" && typeof google.maps !== "undefined")
                    await calcularRota();
            } catch (error) {
                console.error(error);
            }
        }, { deep: true });        

        function getParametrosStorage(chave) {
            try {
                const jsonString = localStorage.getItem(chave);
                if (jsonString === null) {
                    throw new Error("Chave não encontrada na storage");
                }
                const dataObject = JSON.parse(jsonString);
                if (chave === "opcoesRota")
                    initOpcoesRota(dataObject);
                if (chave === "filtrosPontos")
                    initFiltrosPontos(dataObject);
            } catch (error) {
                console.error(error);
                if (chave === "opcoesRota")
                    initOpcoesRota(null);
                if (chave === "filtrosPontos")
                    initFiltrosPontos(null);
                return null;
            }
        }

        onBeforeMount(() => {
            getParametrosStorage("opcoesRota");
            getParametrosStorage("filtrosPontos");
            
            opcoesRota.pontoSaida = enderecosEmpresaRef.value[0].endereco;
            opcoesRota.pontoDestino = enderecosEmpresaRef.value[0].endereco;
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
            outrosFretesRef,
            recolhimentosRef,
            pedidosRef,
            enderecosEmpresaRef,
            enderecosDistintos,
            filtrosPontos,
        }
    }
});

app.use(vuetify);
app.mount("#app");
