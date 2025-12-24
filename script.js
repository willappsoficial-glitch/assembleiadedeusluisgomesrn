// --- CONFIGURAÇÃO ---
const API_URL = 'https://script.google.com/macros/s/AKfycbyg4gz8cGyrRpDEG989Kgw1fAnrjzzz7jYAyqbuLTXig2iO396iTMYJiukmkoei5GU8/exec'; 

// --- INICIALIZAÇÃO ---
window.onload = function() {
    if (localStorage.getItem('churchAdminPass')) {
        verificarSessaoAdmin();
    } else {
        verificarAcessoMembro();
    }
    carregarDados();
};

// ======================================================
// 1. LÓGICA DE LOGIN (MEMBRO)
// ======================================================

function verificarAcessoMembro() {
    const email = localStorage.getItem('ad_membro_email');
    if (email) {
        const nome = localStorage.getItem('ad_membro_nome');
        mostrarAreaMembro(nome);
    } else {
        document.getElementById('loginSection').classList.remove('hidden');
        document.getElementById('memberArea').classList.add('hidden');
    }
}

async function entrarMembro() {
    const nome = document.getElementById('inputNome').value;
    const email = document.getElementById('inputEmail').value;
    const btn = document.getElementById('btnEntrar');

    if (!nome || !email) {
        alert("Por favor, preencha nome e e-mail.");
        return;
    }

    btn.innerText = "Registrando...";
    btn.disabled = true;

    fetchData('cadastrarMembro', { nome: nome, email: email });

    localStorage.setItem('ad_membro_nome', nome);
    localStorage.setItem('ad_membro_email', email);

    mostrarAreaMembro(nome);
}

function mostrarAreaMembro(nome) {
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('memberArea').classList.remove('hidden');

    document.getElementById('userInfo').classList.remove('hidden');
    document.getElementById('userNameDisplay').innerText = "Paz, " + nome.split(' ')[0]; 
    
    carregarDados();
}

function sairMembro() {
    if(confirm("Deseja sair?")) {
        localStorage.removeItem('ad_membro_nome');
        localStorage.removeItem('ad_membro_email');
        location.reload();
    }
}

// ======================================================
// 2. LÓGICA DE DADOS (ESCALAS E AVISOS)
// ======================================================

async function fetchData(action, params = {}) {
    if (['getEscalas', 'getAvisos'].includes(action)) {
        try {
            const response = await fetch(`${API_URL}?action=${action}`);
            return await response.json();
        } catch (e) { console.error(e); return []; }
    } else {
        const payload = { action: action, ...params };
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            return await response.json();
        } catch (e) { return { erro: true, msg: "Erro de conexão." }; }
    }
}

async function carregarDados() {
    // A. AVISOS
    const avisos = await fetchData('getAvisos');
    renderizarAvisos('avisosContainer', avisos);      
    renderizarAvisos('avisosContainerAdmin', avisos); 

    // B. ESCALAS
    const escalas = await fetchData('getEscalas');
    let escalasSemana = filtrarSemanaAtual(escalas);

    // --- NOVA LÓGICA DE ORDENAÇÃO (O SEGREDO ESTÁ AQUI) ---
    // Organiza do dia mais antigo para o mais novo
    escalasSemana.sort((a, b) => {
        const dataA = parseDataSegura(a.data);
        const dataB = parseDataSegura(b.data);
        
        // Se as datas forem diferentes, ordena pela data
        if (dataA.getTime() !== dataB.getTime()) {
            return dataA - dataB;
        }
        
        // Se for o mesmo dia (ex: dois cultos no domingo), ordena pela hora
        // Convertendo para texto simples para comparar (08:00 vem antes de 19:00)
        let horaA = formatarHoraGoogle(a.hora);
        let horaB = formatarHoraGoogle(b.hora);
        return horaA.localeCompare(horaB);
    });
    // ------------------------------------------------------

    renderizarEscala('tabelaEscalasBody', escalasSemana);      
    renderizarEscala('tabelaEscalasAdminBody', escalasSemana); 
}

// --- FUNÇÃO PARA LIMPAR DATA (Ignora Fuso) ---
function parseDataSegura(dataString) {
    if (!dataString) return null;
    let dataObj = new Date(dataString);
    if (isNaN(dataObj.getTime()) || dataString.length === 10) {
        const partes = dataString.split('-'); 
        dataObj = new Date(partes[0], partes[1] - 1, partes[2]);
    }
    return dataObj;
}

// --- A VACINA DO GOOGLE SHEETS (Correção Matemática) ---
function formatarHoraGoogle(horaISO) {
    if (!horaISO) return "";
    if (!horaISO.includes('T')) return horaISO.substring(0, 5);

    try {
        const parteTempo = horaISO.split('T')[1]; 
        let [horas, minutos] = parteTempo.split(':').map(Number);
        let totalMinutos = (horas * 60) + minutos;

        // SUBTRAI O ERRO HISTÓRICO (3h06m)
        totalMinutos = totalMinutos - 186;

        if (totalMinutos < 0) totalMinutos += 1440; 

        let horasReais = Math.floor(totalMinutos / 60);
        let minutosReais = totalMinutos % 60;

        return `${horasReais.toString().padStart(2, '0')}:${minutosReais.toString().padStart(2, '0')}`;

    } catch (e) {
        console.error("Erro ao converter hora:", e);
        return horaISO.split('T')[1].substring(0, 5);
    }
}

function renderizarEscala(elementId, dados) {
    const tbody = document.getElementById(elementId);
    if (!tbody) return; 

    tbody.innerHTML = "";

    if (!dados || dados.length === 0) {
        tbody.innerHTML = "<tr><td colspan='3' style='text-align:center; padding:20px; color:#666'>Nenhuma escala para esta semana.</td></tr>";
        return;
    }

    const hoje = new Date();
    hoje.setHours(0,0,0,0); 

    const nomesDias = ['DOMINGO', 'SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO'];

    dados.forEach(e => {
        const dataEvento = parseDataSegura(e.data);
        if (!dataEvento) return;

        const isHoje = dataEvento.getDate() === hoje.getDate() && 
                       dataEvento.getMonth() === hoje.getMonth() && 
                       dataEvento.getFullYear() === hoje.getFullYear();

        const classeDestaque = isHoje ? "destaque-hoje" : "";
        const textoDia = nomesDias[dataEvento.getDay()];
        const dataFormatada = dataEvento.toLocaleDateString('pt-BR');

        let horaFormatada = formatarHoraGoogle(e.hora);

        tbody.innerHTML += `
            <tr class="${classeDestaque}">
                <td style="min-width: 90px;">
                    <div style="font-size:0.7rem; color:#888; font-weight:bold; letter-spacing:1px; text-transform:uppercase;">${textoDia}</div>
                    <div style="font-size:1.1rem; font-weight:bold; line-height:1.2;">${dataFormatada}</div>
                    <div style="color:var(--primary); font-weight:500; font-size:0.9rem;">${horaFormatada}</div>
                </td>
                <td style="vertical-align:middle;">
                    <strong style="font-size:1.1rem; color:var(--text);">${e.evento}</strong>
                </td>
                <td>
                    <div style="margin-bottom:6px;"><small style="color:#666; font-size:0.8rem;">Dirigente:</small><br><b style="font-size:0.95rem;">${e.dirigentes}</b></div>
                    <div><small style="color:#666; font-size:0.8rem;">Porteiro:</small><br><span style="font-size:0.95rem;">${e.porteiros}</span></div>
                </td>
            </tr>`;
    });
}

function renderizarAvisos(elementId, dados) {
    const container = document.getElementById(elementId);
    if (!container) return;

    container.innerHTML = "";
    if (!dados || dados.length === 0) container.innerHTML = "<p style='color:#999; text-align:center'>Sem avisos no momento.</p>";
    else {
        dados.forEach(a => {
            let dataPost = parseDataSegura(a.dataPostagem);
            let dataString = dataPost ? dataPost.toLocaleDateString('pt-BR') : "";

            container.innerHTML += `
                <div class="aviso-item">
                    <div class="aviso-header">
                        <span class="aviso-title">${a.titulo}</span>
                        <span class="aviso-date">${dataString}</span>
                    </div>
                    <p>${a.mensagem}</p>
                </div>`;
        });
    }
}

function filtrarSemanaAtual(lista) {
    if(!lista) return [];

    const hoje = new Date();
    const diaSemana = hoje.getDay(); 

    const domingo = new Date(hoje);
    domingo.setDate(hoje.getDate() - diaSemana);
    domingo.setHours(0,0,0,0);

    const sabado = new Date(domingo);
    sabado.setDate(domingo.getDate() + 6);
    sabado.setHours(23,59,59,999);

    return lista.filter(item => {
        const dataItem = parseDataSegura(item.data);
        if(!dataItem) return false;
        return dataItem >= domingo && dataItem <= sabado;
    });
}

// ======================================================
// 3. LÓGICA DE ADMIN (OBREIRO)
// ======================================================

function toggleAdminLogin() {
    const modal = document.getElementById('loginModal');
    if (modal.classList.contains('hidden') || modal.style.display === 'none') {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    } else {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
}

async function validarAdmin() {
    const pass = document.getElementById('adminPassword').value;
    const btn = document.querySelector('#loginModal .btn-primary');
    const modal = document.getElementById('loginModal');

    btn.innerText = "Verificando...";
    btn.disabled = true;

    const res = await fetchData('login', { senha: pass });

    btn.disabled = false;
    btn.innerText = "Entrar no Painel";

    if (res.success) {
        localStorage.setItem('churchAdminPass', pass);
        
        modal.classList.add('hidden');
        modal.style.display = 'none';

        verificarSessaoAdmin();
        showToast("Bem-vindo, Obreiro!");
        carregarDados();

    } else {
        alert("Senha incorreta.");
        document.getElementById('adminPassword').value = '';
    }
}

function verificarSessaoAdmin() {
    const pass = localStorage.getItem('churchAdminPass');
    if (pass) {
        document.getElementById('adminPanel').classList.remove('hidden');
        document.getElementById('loginSection').classList.add('hidden');
        document.getElementById('memberArea').classList.add('hidden');
        document.getElementById('userInfo').classList.add('hidden');
    }
}

function logoutAdmin() {
    localStorage.removeItem('churchAdminPass');
    location.reload(); 
}

// --- FUNÇÕES DE ENVIO (ADMIN) ---

let itensEscalaTemp = [];

function adicionarItemEscala() {
    const data = document.getElementById('dataEscala').value;
    const hora = document.getElementById('horaEscala').value;
    const evento = document.getElementById('eventoEscala').value;
    const dirigentes = document.getElementById('dirigentesEscala').value;
    const porteiros = document.getElementById('porteirosEscala').value;

    if (!data || !evento) {
        showToast("Preencha Data e Evento.");
        return;
    }

    itensEscalaTemp.push({
        data: data,
        hora: hora,
        evento: evento,
        dirigentes: dirigentes,
        porteiros: porteiros
    });

    atualizarPreview();

    document.getElementById('eventoEscala').value = '';
    document.getElementById('dirigentesEscala').value = '';
    document.getElementById('porteirosEscala').value = '';
}

function atualizarPreview() {
    const div = document.getElementById('previewEscala');
    const ul = document.getElementById('listaPreview');
    const btn = document.getElementById('btnPublicarTudo');

    ul.innerHTML = "";

    if (itensEscalaTemp.length > 0) {
        div.style.display = 'block';
        btn.disabled = false;
        btn.style.opacity = "1";
        btn.innerText = `Publicar (${itensEscalaTemp.length} itens)`;

        itensEscalaTemp.forEach((item, index) => {
            let dataPt = item.data.split('-').reverse().join('/');
            ul.innerHTML += `<li>${dataPt} - ${item.evento} <span style="color:red; cursor:pointer; font-weight:bold; margin-left:10px;" onclick="removerItem(${index})">X</span></li>`;
        });
    } else {
        div.style.display = 'none';
        btn.disabled = true;
        btn.style.opacity = "0.6";
        btn.innerText = "Publicar Semana Inteira";
    }
}

function removerItem(index) {
    itensEscalaTemp.splice(index, 1);
    atualizarPreview();
}

async function submitEscalaSemana() {
    const senha = localStorage.getItem('churchAdminPass');

    if (itensEscalaTemp.length === 0) return;
    if (!confirm(`Confirma a publicação de ${itensEscalaTemp.length} escalas?`)) return;

    const btn = document.getElementById('btnPublicarTudo');
    btn.innerText = "Enviando...";
    btn.disabled = true;

    const dados = {
        senha: senha,
        itens: itensEscalaTemp
    };

    showToast("Salvando...");
    const res = await fetchData('salvarEscalaLote', dados);
    showToast(res.msg);

    if (res.success) {
        itensEscalaTemp = [];
        atualizarPreview();
        carregarDados(); 
    }

    btn.innerText = "Publicar Semana Inteira";
}

async function submitAviso() {
    const senha = localStorage.getItem('churchAdminPass');
    const dados = {
        senha: senha,
        titulo: document.getElementById('tituloAviso').value,
        mensagem: document.getElementById('msgAviso').value
    };
    if(!dados.titulo) return showToast("Preencha o título.");

    showToast("Enviando...");
    const res = await fetchData('salvarAviso', dados);
    showToast(res.msg);
    if(res.success) {
        document.getElementById('tituloAviso').value = '';
        document.getElementById('msgAviso').value = '';
        carregarDados();
    }
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.innerText = msg;
    t.classList.remove('hidden');
    setTimeout(() => { t.classList.add('hidden'); }, 3000);
}

// ======================================================
// 4. FUNÇÕES DE DOAÇÃO (PIX)
// ======================================================

function abrirModalPix() {
    const modal = document.getElementById('modalPix');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
}

function fecharModalPix() {
    const modal = document.getElementById('modalPix');
    modal.classList.add('hidden');
    modal.style.display = 'none';
}

function copiarPix() {
    // Pega o texto da div
    const textoPix = document.getElementById('chavePixTexto').innerText.trim();
    
    // Tenta copiar para a área de transferência
    navigator.clipboard.writeText(textoPix).then(() => {
        showToast("Chave Pix copiada!");
        // Opcional: fecha o modal depois de copiar
        setTimeout(fecharModalPix, 2000);
    }).catch(err => {
        console.error('Erro ao copiar: ', err);
        alert("Não foi possível copiar automaticamente. Selecione a chave e copie manualmente.");
    });
}
