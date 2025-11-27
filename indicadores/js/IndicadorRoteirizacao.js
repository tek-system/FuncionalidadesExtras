const { createApp, ref, reactive, onBeforeMount, onMounted, computed, watch, nextTick } = Vue;
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
            directionsRenderer.value = new google.maps.DirectionsRenderer();
            directionsRenderer.value.setMap(map.value);                    
            await calcularRota();
        };
        function montarRequestRota() {
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
        function setMetricasResultantesDaRota(legs) {
            const distanceMeters = legs.reduce((total, leg) => total + leg.distance.value, 0);
            const distanceKm = (distanceMeters / 1000).toFixed(2);
            metricasResultantesDaRota.distanciaTotalKm = distanceKm;
            const durationSeconds = legs.reduce((total, leg) => total + leg.duration.value, 0);
            const durationMinutes = Math.ceil(durationSeconds / 60);
            const durationHours = Math.floor(durationMinutes / 60);
            metricasResultantesDaRota.duracaoTotalHoras = `${durationHours} Horas e ${durationMinutes % 60} Minutos`;
        }
        async function desenharRota(request) {
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
        async function calcularRota() {
            try {
                loading.value = true;
                const request = montarRequestRota();
                if (!request) {
                    loading.value = false;
                    return; 
                }
                await desenharRota(request);
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
                sequenciaEntrega: pedidoObj.sequenciaEntrega,
            }));
        });
        const enderecosDestinos = computed(() => {
            return enderecosEmpresaRef.value.concat(enderecosDocumentos.value);
        });
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
        }
    }
});
app.use(vuetify);
app.mount("#app");