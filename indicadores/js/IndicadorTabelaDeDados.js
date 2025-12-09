const { createApp, ref, reactive, onMounted, computed, watch, nextTick } = Vue;
const { createVuetify } = Vuetify;
const { data = [] } = window.DATA_TABELA || {};

const vuetify = createVuetify({
    theme: { defaultTheme: "light" }
});

const app = createApp({
    setup() {
        const dataRef = ref(data);
        const loading = ref(true);

        onMounted(() => {
            loading.value = false;
        })

        return {
            dataRef,
            loading,
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