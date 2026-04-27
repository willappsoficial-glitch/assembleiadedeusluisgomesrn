const API_URL = 'https://script.google.com/macros/s/AKfycbyg4gz8cGyrRpDEG989Kgw1fAnrjzzz7jYAyqbuLTXig2iO396iTMYJiukmkoei5GU8/exec'; 

window.onload = function() {
    if (localStorage.getItem('churchAdminPass')) {
        verificarSessaoAdmin();
    } else {
        verificarAcessoMembro();
    }
    carregarDados();
};

// --- DIGITAÇÃO E PROCESSAMENTO COM IA ---
function iniciarDitadoIA() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert("Navegador não suporta voz.");
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    
    const statusText = document.getElementById('statusIA');
    statusText.style.display = 'block';
    statusText.innerText = "Escutando... Pode falar a escala completa.";
    statusText.style.color = "#ffab40";

    recognition.start();

    recognition.onresult = async function(event) {
        const textoFalado = event.results[0][0].transcript;
        statusText.innerText = "Processando com IA...";
        statusText.style.color = "#25d366";

        const res = await fetchData('processarTextoGemini', { texto: textoFalado });
        
        if(res && res.success) {
            document.getElementById('dataEscala').value = res.dados.data || '';
            document.getElementById('horaEscala').value = res.dados.hora || '';
            document.getElementById('eventoEscala').value = res.dados.evento || '';
            document.getElementById('dirigentesEscala').value = res.dados.dirigentes || '';
            document.getElementById('porteirosEscala').value = res.dados.porteiros || '';
            statusText.innerText = "Campos preenchidos!";
        } else {
            statusText.innerText = "IA falhou. Tente novamente.";
            statusText.style.color = "red";
        }
        setTimeout(() => { statusText.style.display = 'none'; }, 4000);
    };
}

// --- LÓGICA DE DADOS ---
async function fetchData(action, params = {}) {
    if (['getEscalas', 'getAvisos'].includes(action)) {
        try {
            const response = await fetch(`${API_URL}?action=${action}`);
            return await response.json();
        } catch (e) { return []; }
    } else {
        const payload = { action: action, ...params };
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            return await response.json();
        } catch (e) { return { erro: true }; }
    }
}

async function carregarDados() {
    const avisos = await fetchData('getAvisos');
    renderizarAvisos('avisosContainer', avisos);      
    renderizarAvisos('avisosContainerAdmin', avisos); 

    const escalas = await fetchData('getEscalas');
    let escalasSemana = filtrarSemanaAtual(escalas);

    escalasSemana.sort((a, b) => {
        const dataA = parseDataSegura(a.data);
        const dataB = parseDataSegura(b.data);
        if (dataA.getTime() !== dataB.getTime()) return dataA - dataB;
        return formatarHoraGoogle(a.hora).localeCompare(formatarHoraGoogle(b.hora));
    });

    renderizarEscala('tabelaEscalasBody', escalasSemana, false);      
    renderizarEscala('tabelaEscalasAdminBody', escalasSemana, true); 
}

function renderizarEscala(elementId, dados, isAdmin = false) {
    const tbody = document.getElementById(elementId);
    if (!tbody) return; 
    tbody.innerHTML = "";

    const hoje = new Date();
    hoje.setHours(0,0,0,0);
    const nomesDias = ['DOMINGO', 'SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO'];

    dados.forEach(e => {
        const dataEvento = parseDataSegura(e.data);
        const isHoje = dataEvento && dataEvento.toDateString() === hoje.toDateString();
        const isPassado = dataEvento && dataEvento < hoje;

        let classeRow = isHoje ? "destaque-hoje" : (isPassado ? "item-passado" : "");
        let horaFormatada = formatarHoraGoogle(e.hora);
        
        let acoesAdmin = isAdmin ? `
            <div style="margin-top:10px; border-top:1px dashed #ccc; padding-top:5px; text-align:center;">
                <button onclick="abrirModalEdit('${e.linha}', '${e.data}', '${horaFormatada}', '${e.evento}', '${e.dirigentes}', '${e.porteiros}')" class="btn-tiny" style="background:var(--primary); color:white;">
                   <span class="material-icons" style="font-size:12px">edit</span> Editar
                </button>
            </div>` : "";

        tbody.innerHTML += `
            <tr class="${classeRow}">
                <td>
                    <small>${nomesDias[dataEvento.getDay()]}</small><br>
                    <b>${dataEvento.toLocaleDateString('pt-BR')}</b><br>
                    <span style="color:var(--primary)">${horaFormatada}</span>
                </td>
                <td><strong>${e.evento}</strong></td>
                <td>
                    <small>Dir:</small> <b>${e.dirigentes}</b><br>
                    <small>Port:</small> ${e.porteiros}
                    ${acoesAdmin}
                </td>
            </tr>`;
    });
}

// --- FUNÇÕES DE EDIÇÃO ---
function abrirModalEdit(id, data, hora, evento, dirigentes, porteiros) {
    document.getElementById('edit-id').value = id;
    if(data.includes('/')) {
        const p = data.split('/');
        document.getElementById('edit-data').value = `${p[2]}-${p[1]}-${p[0]}`;
    } else {
        document.getElementById('edit-data').value = data.substring(0,10);
    }
    document.getElementById('edit-hora').value = hora;
    document.getElementById('edit-evento').value = evento;
    document.getElementById('edit-dirigentes').value = dirigentes;
    document.getElementById('edit-porteiros').value = porteiros;
    document.getElementById('modalEditEscala').style.display = 'flex';
}

function fecharModalEdit() { document.getElementById('modalEditEscala').style.display = 'none'; }

async function salvarEdicaoEscala(event) {
    event.preventDefault();
    const btn = document.getElementById('btn-salvar-edicao');
    btn.innerText = "Salvando...";
    
    const res = await fetchData('editarEscala', {
        senha: localStorage.getItem('churchAdminPass'),
        linha: document.getElementById('edit-id').value,
        data: document.getElementById('edit-data').value,
        hora: document.getElementById('edit-hora').value,
        evento: document.getElementById('edit-evento').value,
        dirigentes: document.getElementById('edit-dirigentes').value,
        porteiros: document.getElementById('edit-porteiros').value
    });

    if(res.success) {
        fecharModalEdit();
        showToast("Atualizado!");
        carregarDados();
    }
    btn.innerText = "Salvar Alterações";
}

// --- RESTANTE DAS FUNÇÕES (LOGIN, PREVIEW, ETC) ---
function entrarMembro() {
    const n = document.getElementById('inputNome').value;
    const e = document.getElementById('inputEmail').value;
    if(!n || !e) return alert("Preencha tudo.");
    localStorage.setItem('ad_membro_nome', n);
    localStorage.setItem('ad_membro_email', e);
    mostrarAreaMembro(n);
}

function mostrarAreaMembro(n) {
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('memberArea').classList.remove('hidden');
    document.getElementById('userNameDisplay').innerText = "Paz, " + n.split(' ')[0];
    document.getElementById('userInfo').classList.remove('hidden');
}

function sairMembro() { localStorage.clear(); location.reload(); }

async function validarAdmin() {
    const p = document.getElementById('adminPassword').value;
    const res = await fetchData('login', { senha: p });
    if(res.success) {
        localStorage.setItem('churchAdminPass', p);
        location.reload();
    } else alert("Senha incorreta");
}

function verificarSessaoAdmin() {
    if(localStorage.getItem('churchAdminPass')) {
        document.getElementById('adminPanel').classList.remove('hidden');
        document.getElementById('loginSection').classList.add('hidden');
        document.getElementById('memberArea').classList.add('hidden');
    }
}

function logoutAdmin() { localStorage.removeItem('churchAdminPass'); location.reload(); }

let itensEscalaTemp = [];
function adicionarItemEscala() {
    const d = document.getElementById('dataEscala').value;
    const ev = document.getElementById('eventoEscala').value;
    if(!d || !ev) return showToast("Falta data ou evento");
    itensEscalaTemp.push({
        data: d, hora: document.getElementById('horaEscala').value,
        evento: ev, dirigentes: document.getElementById('dirigentesEscala').value,
        porteiros: document.getElementById('porteirosEscala').value
    });
    atualizarPreview();
    document.getElementById('eventoEscala').value = '';
}

function atualizarPreview() {
    const ul = document.getElementById('listaPreview');
    const btn = document.getElementById('btnPublicarTudo');
    ul.innerHTML = "";
    if(itensEscalaTemp.length > 0) {
        document.getElementById('previewEscala').style.display = 'block';
        btn.disabled = false;
        itensEscalaTemp.forEach((it, i) => {
            ul.innerHTML += `<li>${it.data} - ${it.evento} <b onclick="itensEscalaTemp.splice(${i},1);atualizarPreview()" style="color:red;cursor:pointer">X</b></li>`;
        });
    } else {
        document.getElementById('previewEscala').style.display = 'none';
        btn.disabled = true;
    }
}

async function submitEscalaSemana() {
    showToast("Publicando...");
    const res = await fetchData('salvarEscalaLote', {
        senha: localStorage.getItem('churchAdminPass'),
        itens: itensEscalaTemp
    });
    if(res.success) { itensEscalaTemp = []; atualizarPreview(); carregarDados(); }
    showToast(res.msg);
}

async function submitAviso() {
    const res = await fetchData('salvarAviso', {
        senha: localStorage.getItem('churchAdminPass'),
        titulo: document.getElementById('tituloAviso').value,
        mensagem: document.getElementById('msgAviso').value
    });
    if(res.success) { document.getElementById('tituloAviso').value=''; document.getElementById('msgAviso').value=''; carregarDados(); }
    showToast(res.msg);
}

function parseDataSegura(s) {
    if(!s) return null;
    let d = new Date(s);
    if(isNaN(d.getTime())) {
        const p = s.split('-');
        d = new Date(p[0], p[1]-1, p[2]);
    }
    return d;
}

function formatarHoraGoogle(h) {
    if(!h || !h.includes('T')) return h || "";
    const t = h.split('T')[1];
    let [hrs, min] = t.split(':').map(Number);
    let tot = (hrs * 60) + min - 186;
    if(tot < 0) tot += 1440;
    return `${Math.floor(tot/60).toString().padStart(2,'0')}:${(tot%60).toString().padStart(2,'0')}`;
}

function filtrarSemanaAtual(l) {
    const h = new Date(); h.setHours(0,0,0,0);
    const dom = new Date(h); dom.setDate(h.getDate() - h.getDay());
    const sab = new Date(dom); sab.setDate(dom.getDate() + 6); sab.setHours(23,59,59);
    return l.filter(i => {
        const di = parseDataSegura(i.data);
        return di >= dom && di <= sab;
    });
}

function renderizarAvisos(id, d) {
    const c = document.getElementById(id);
    if(!c) return;
    c.innerHTML = d.length ? "" : "<p>Sem avisos.</p>";
    d.forEach(a => {
        c.innerHTML += `<div class="aviso-item"><b>${a.titulo}</b><p>${a.mensagem}</p></div>`;
    });
}

function showToast(m) {
    const t = document.getElementById('toast');
    t.innerText = m; t.classList.remove('hidden');
    setTimeout(() => t.classList.add('hidden'), 3000);
}

function abrirModalPix() { document.getElementById('modalPix').style.display='flex'; }
function fecharModalPix() { document.getElementById('modalPix').style.display='none'; }
function copiarPix() {
    navigator.clipboard.writeText(document.getElementById('chavePixTexto').innerText);
    showToast("Pix Copiado!");
}
