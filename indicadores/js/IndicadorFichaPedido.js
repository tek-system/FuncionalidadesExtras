const { createApp, ref, reactive, onMounted, computed, watch, nextTick } = Vue;
const { createVuetify } = Vuetify;
const { abas = [], data = [] } = window.DATA_PEDIDO || {};

const vuetify = createVuetify({
    theme: { defaultTheme: "light" }
});

const app = createApp({
    setup() {
        const abasRef = ref(abas);
        const dataRef = ref(data);

        const loading = ref(true);
        const tabAtiva = ref(null);

        const map = ref(null);
        const exibirMapa = ref(false); 
        const mapDiv = ref(null);

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
        };

        function fecharDialog() {
            dialogState.titulo = "";
            dialogState.texto = "";
            dialogState.corTitulo = "";
            dialogState.corTexto = "";
            dialogState.visivel = false;
        };

        function initMap() {
            const dataPedido = dataRef.value.GERAL.VALORES_TABELA[0];
            const dataEntrega = dataRef.value.ENTREGA.VALORES_TABELA[0];

            const lat = dataEntrega[1];
            const lng = dataEntrega[2];

            if (!mapDiv.value || !lat || lat === "0" || lat === 0) {
                abrirDialog("Erro ao carregar o mapa!", "Não foi possível abrir o mapa por falta de coordenadas!", "bg-red-darken-4", "text-red-darken-4")
                console.error("div do mapa ou coordenadas não encontradas.");
                exibirMapa.value = false;
                return;
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

            const infoWindow = new google.maps.InfoWindow({
                content: `
                    <div style="font-size: 0.9rem; line-height: 1.3; color: black;">
                        <p><span style="font-weight: bold;">Tipo:</span><strong> ${ dataPedido[5] }</strong></p>
                        <p><span style="font-weight: bold;">Pedido:</span> ${ dataPedido[0] || "N/A" }</p>
                        <p><span style="font-weight: bold;">Cliente:</span> ${ dataPedido[2] || "N/A" }</p>
                        <p><span style="font-weight: bold;">Endereço:</span> ${ dataEntrega[0] }</p>
                    </div>
                `,
            });

            const marker = new google.maps.Marker({
                position: localizacao,
                map: map.value,
                title: `Entrega do pedido ${ dataPedido[0] } para: ${ dataPedido[2] }`
            });

            marker.addListener("click", () => {
                infoWindow.open(map.value, marker);
            });            

            marker.infoWindow = infoWindow;
        }

        function toggleVisualizarMapa() {
            exibirMapa.value = !exibirMapa.value;
        }

        watch(exibirMapa, (newValue) => {
            if (newValue && entregaTemCoordenadas.value) {
                nextTick(() => {
                    initMap();
                });
            }
        });

        const entregaTemCoordenadas = computed(() => {
            const dataEntrega = dataRef.value.ENTREGA.VALORES_TABELA[0];
            if (!dataEntrega || dataEntrega.length === 0) return false;
            return dataEntrega[1] && dataEntrega[2];
        });

        const dataTabAtual = computed(() => {
            return dataRef.value[tabAtiva.value.toUpperCase()] || {};
        });

        const corAbaAtual = computed(() => {
            const abaEncontrada = abasRef.value.find(aba => aba.value.toUpperCase() === tabAtiva.value.toUpperCase());
            return abaEncontrada.cor ?? 'primary';
        });

        const detalhesRegistroMestre = ref({ 
            HEADERS_TABELA: [],
            VALORES_TABELA: []
        });

        watch(tabAtiva, (newValue) => {
            if (newValue) {
                detalhesRegistroMestre.value = { 
                    HEADERS_TABELA: [],
                    VALORES_TABELA: []
                }
            }
        });        

        function filtrarDetalhes(itemSelecionado) {
            const idItemSelecionado = itemSelecionado[0];
            const data = dataTabAtual.value;

            if (!data || !data.DETALHES || !data.DETALHES.VALORES_TABELA) {
                detalhesRegistroMestre.value = { HEADERS_TABELA: [], VALORES_TABELA: [] };
                return;
            }

            const linhasDetalheFiltradas = data.DETALHES.VALORES_TABELA.filter(linhaDetalhe => {
                return linhaDetalhe[1] == idItemSelecionado;
            });

            detalhesRegistroMestre.value = {
                HEADERS_TABELA: data.DETALHES.HEADERS_TABELA,
                VALORES_TABELA: linhasDetalheFiltradas
            };
        }

        onMounted(() => {
            loading.value = false;
        })

        return {
            abasRef,
            dataRef,
            loading,
            tabAtiva,
            corAbaAtual,
            filtrarDetalhes,
            detalhesRegistroMestre,
            dialogState,
            exibirMapa,
            mapDiv,
            toggleVisualizarMapa,
            fecharDialog,
            entregaTemCoordenadas,
        };
    }
});

app.component("table-generics", {
    props: {
        title: { type: String, default: "" },
        height: { type: Number, default: 400 },
        color: { type: String, default: "primary" },
        headers: { type: Array, required: true },
        items: { type: Array, required: true },
    },
    emits: ['item-selecionado'],
    setup(props, { emit }) {
        const headersTabela = computed(() => {
            return props.headers.map((header, index) => ({
                title: header,
                align: 'start',
                key: String(index),
                minWidth: 300,
                sortable: true
            }));
        });

        const itensTabela = computed(() => props.items);

        const itemSelecionadoId = ref(null);

        const aoClicarNaLinha = (event, { item }) => {
            itemSelecionadoId.value = item[0];
            emit('item-selecionado', item);
        }

        const propsDaLinha = ({ item }) => {
            if (item[0] === itemSelecionadoId.value) {
                return { class: 'linha-selecionada' };
            }
            return {};
        };
        
        return {
            headersTabela,
            itensTabela,
            aoClicarNaLinha,
            propsDaLinha
        }
    },
    template: `
        <v-card flat> 
            <v-card-title class="d-flex justify-center" v-if="title">{{ title }}</v-card-title>
            <v-card-text>
                <v-data-table-virtual
                    hover
                    :height=height
                    fixed-header
                    density="compact"
                    :headers="headersTabela"
                    :items="itensTabela"
                    item-value="itensTabela[0]"
                    :header-props="{ class: 'bg-' + color + ' text-white' }"
                    :row-props="propsDaLinha"
                    @click:row="aoClicarNaLinha"
                    v-if="itensTabela[0].length > 0"
                />
                <v-alert v-else type="info" variant="tonal">Nenhum dado para ser exibido!</v-alert>
            </v-card-text>
        </v-card>            
    `
});
app.use(vuetify);
app.mount("#app");