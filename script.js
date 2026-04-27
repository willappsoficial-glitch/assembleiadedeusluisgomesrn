const API_URL = 'https://script.google.com/macros/s/AKfycbyg4gz8cGyrRpDEG989Kgw1fAnrjzzz7jYAyqbuLTXig2iO396iTMYJiukmkoei5GU8/exec'; 

window.onload = function() {
    initTheme();
    carregarVersiculo();
    if (localStorage.getItem('churchAdminPass')) {
        verificarSessaoAdmin();
    } else {
        verificarAcessoMembro();
    }
    carregarDados();
};

function initTheme() {
    const isDark = localStorage.getItem('ad_theme_dark') === 'true';
    if (isDark) {
        document.body.classList.add('dark-mode');
        document.getElementById('themeIcon').innerText = 'light_mode';
    }
}

function toggleDarkMode() {
    const body = document.body;
    body.classList.toggle('dark-mode');
    const isDark = body.classList.contains('dark-mode');
    localStorage.setItem('ad_theme_dark', isDark);
    document.getElementById('themeIcon').innerText = isDark ? 'light_mode' : 'dark_mode';
}

function switchTab(tabId, btnElement) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    if(btnElement) btnElement.classList.add('active');
}

function iniciarDitadoIA() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Navegador incompatível.");
    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    const statusText = document.getElementById('statusIA');
    statusText.innerText = "Escutando...";
    recognition.start();

    recognition.onresult = async function(event) {
        const texto = event.results[0][0].transcript;
        statusText.innerText = "IA Processando...";
        const res = await fetchData('processarTextoGemini', { texto: texto });
        if(res && res.success) {
            document.getElementById('dataEscala').value = res.dados.data || '';
            document.getElementById('horaEscala').value = res.dados.hora || '';
            document.getElementById('eventoEscala').value = res.dados.evento || '';
            document.getElementById('dirigentesEscala').value = res.dados.dirigentes || '';
            document.getElementById('porteirosEscala').value = res.dados.porteiros || '';
            statusText.innerText = "Pronto!";
        } else {
            statusText.innerText = "Erro na IA";
        }
        setTimeout(() => statusText.innerText = '', 3000);
    };
}

async function fetchData(action, params = {}) {
    if (['getEscalas', 'getAvisos', 'getAniversariantesDia'].includes(action)) {
        try {
            const r = await fetch(`${API_URL}?action=${action}`);
            return await r.json();
        } catch (e) { return []; }
    } else {
        const p = { action: action, ...params };
        try {
            const r = await fetch(API_URL, { method: 'POST', body: JSON.stringify(p) });
            return await r.json();
        } catch (e) { return { erro: true }; }
    }
}

async function carregarDados() {
    // Carrega Escalas e Avisos
    const avisos = await fetchData('getAvisos');
    renderizarAvisos('avisosContainer', avisos);
    const escalas = await fetchData('getEscalas');
    let filtradas = filtrarSemanaAtual(escalas);
    filtradas.sort((a, b) => parseDataSegura(a.data) - parseDataSegura(b.data));
    renderizarEscalaCards('tabelaEscalasBody', filtradas);
    renderizarEscalaAdmin('tabelaEscalasAdminBody', filtradas);
    
    // Carrega Aniversariantes do Dia
    const aniversariantes = await fetchData('getAniversariantesDia');
    renderizarAniversariantes(aniversariantes);
}

function renderizarAniversariantes(lista) {
    const box = document.getElementById('boxAniversariantes');
    const container = document.getElementById('listaAniversariantes');
    
    if(!lista || lista.length === 0) {
        box.style.display = 'none';
        return;
    }
    
    box.style.display = 'block';
    container.innerHTML = '';
    
    // Verifica se o usuário logado é o Pastor (Admin)
    const isAdmin = localStorage.getItem('churchAdminPass') !== null;
    
    lista.forEach(p => {
        let btnZap = '';
        if(isAdmin && p.telefone) {
            let msgText = encodeURIComponent(`A Paz do Senhor, ${p.nome}! A liderança da AD Luís Gomes deseja um Feliz Aniversário! Que Deus te abençoe grandemente.`);
            btnZap = `<a href="https://wa.me/55${p.telefone}?text=${msgText}" target="_blank" class="btn-tiny" style="background:#25d366; text-decoration:none; display:inline-flex; align-items:center; gap:5px; color:white;"><span class="material-icons-round" style="font-size:16px">chat</span> Enviar Zap</a>`;
        }
        
        container.innerHTML += `
            <div class="app-card" style="padding:15px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <strong style="font-size:1.1rem; color:var(--text-main);">${p.nome}</strong>
                    <p class="text-sm text-muted">Ficando mais experiente hoje! 🎉</p>
                </div>
                ${btnZap}
            </div>
        `;
    });
}

function renderizarEscalaAdmin(id, dados) {
    const tbody = document.getElementById(id);
    if (!tbody) return; tbody.innerHTML = "";
    dados.forEach(e => {
        let h = formatarHoraGoogle(e.hora);
        tbody.innerHTML += `
            <tr>
                <td>${parseDataSegura(e.data).toLocaleDateString('pt-BR')}<br>${h}</td>
                <td>${e.evento}</td>
                <td style="font-size:0.8rem">D: ${e.dirigentes}<br>P: ${e.porteiros}</td>
                <td style="white-space:nowrap">
                    <button onclick="abrirModalEdit('${e.linha}','${e.data}','${h}','${e.evento}','${e.dirigentes}','${e.porteiros}')" class="btn-tiny" style="color:var(--primary)"><span class="material-icons-round" style="font-size:18px">edit</span></button>
                    <button onclick="confirmarExcluir('${e.linha}')" class="btn-tiny" style="color:#ef4444"><span class="material-icons-round" style="font-size:18px">delete</span></button>
                </td>
            </tr>`;
    });
}

async function confirmarExcluir(linha) {
    if(confirm("Deseja realmente excluir este evento?")) {
        showToast("Excluindo...");
        const res = await fetchData('excluirEscala', { senha: localStorage.getItem('churchAdminPass'), linha: linha });
        if(res.success) { showToast("Excluído!"); carregarDados(); }
    }
}

function abrirModalEdit(id, data, hora, evento, dirigentes, porteiros) {
    document.getElementById('edit-id').value = id;
    document.getElementById('edit-data').value = data.includes('/') ? data.split('/').reverse().join('-') : data.substring(0,10);
    document.getElementById('edit-hora').value = hora;
    document.getElementById('edit-evento').value = evento;
    document.getElementById('edit-dirigentes').value = dirigentes;
    document.getElementById('edit-porteiros').value = porteiros;
    document.getElementById('modalEditEscala').classList.remove('hidden');
}
function fecharModalEdit() { document.getElementById('modalEditEscala').classList.add('hidden'); }

async function salvarEdicaoEscala(event) {
    event.preventDefault();
    const res = await fetchData('editarEscala', {
        senha: localStorage.getItem('churchAdminPass'),
        linha: document.getElementById('edit-id').value,
        data: document.getElementById('edit-data').value,
        hora: document.getElementById('edit-hora').value,
        evento: document.getElementById('edit-evento').value,
        dirigentes: document.getElementById('edit-dirigentes').value,
        porteiros: document.getElementById('edit-porteiros').value
    });
    if(res.success) { fecharModalEdit(); showToast("Atualizado!"); carregarDados(); }
}

function carregarVersiculo() {
    const versiculos = [
        { texto: "Tudo posso naquele que me fortalece.", ref: "Filipenses 4:13" },
        { texto: "O Senhor é o meu pastor, nada me faltará.", ref: "Salmos 23:1" },
        { texto: "Mil cairão ao teu lado, e dez mil à tua direita, mas tu não serás atingido.", ref: "Salmos 91:7" }
    ];
    const d = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    const v = versiculos[d % versiculos.length];
    document.getElementById('textoVersiculo').innerText = `"${v.texto}"`;
    document.getElementById('refVersiculo').innerText = v.ref;
}

function renderizarEscalaCards(id, dados) {
    const c = document.getElementById(id); c.innerHTML = "";
    if(!dados.length) { c.innerHTML = "<p class='text-center'>Sem agenda.</p>"; return; }
    dados.forEach(e => {
        let h = formatarHoraGoogle(e.hora);
        c.innerHTML += `<div class="app-card">
            <div class="card-data-badge">${parseDataSegura(e.data).toLocaleDateString('pt-BR')} às ${h}</div>
            <h3 class="card-title">${e.evento}</h3>
            <div class="card-details">
                <p><b>D:</b> ${e.dirigentes}</p>
                <p><b>P:</b> ${e.porteiros}</p>
            </div>
        </div>`;
    });
}

function renderizarAvisos(id, d) {
    const c = document.getElementById(id); c.innerHTML = d.length ? "" : "<p class='text-center'>Sem avisos.</p>";
    d.forEach(a => {
        c.innerHTML += `<div class="aviso-card"><h3>${a.titulo}</h3><p>${a.mensagem}</p></div>`;
    });
}

function entrarMembro() {
    const n = document.getElementById('inputNome').value;
    const e = document.getElementById('inputEmail').value;
    if(!n || !e) return showToast("Preencha tudo.");
    localStorage.setItem('ad_membro_nome', n);
    localStorage.setItem('ad_membro_email', e);
    location.reload();
}

function verificarAcessoMembro() {
    const n = localStorage.getItem('ad_membro_nome');
    if(n) {
        document.getElementById('loginSection').classList.add('hidden');
        document.getElementById('memberArea').classList.remove('hidden');
        document.getElementById('userNameDisplay').innerText = "Paz, " + n.split(' ')[0];
        document.getElementById('userInfo').classList.remove('hidden');
    }
}

function sairMembro() { localStorage.clear(); location.reload(); }
function toggleAdminLogin() { document.getElementById('loginModal').classList.toggle('hidden'); }
async function validarAdmin() {
    const p = document.getElementById('adminPassword').value;
    const res = await fetchData('login', { senha: p });
    if(res.success) { localStorage.setItem('churchAdminPass', p); location.reload(); }
    else showToast("Senha incorreta.");
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
    itensEscalaTemp.push({
        data: document.getElementById('dataEscala').value,
        hora: document.getElementById('horaEscala').value,
        evento: document.getElementById('eventoEscala').value,
        dirigentes: document.getElementById('dirigentesEscala').value,
        porteiros: document.getElementById('porteirosEscala').value
    });
    atualizarPreview();
}

function atualizarPreview() {
    const ul = document.getElementById('listaPreview');
    const box = document.getElementById('previewEscala');
    ul.innerHTML = "";
    if(itensEscalaTemp.length > 0) {
        box.classList.remove('hidden');
        itensEscalaTemp.forEach((it, i) => {
            ul.innerHTML += `<li>${it.evento} <span onclick="itensEscalaTemp.splice(${i},1);atualizarPreview()" style="color:red">X</span></li>`;
        });
    } else box.classList.add('hidden');
}

async function submitEscalaSemana() {
    const res = await fetchData('salvarEscalaLote', { senha: localStorage.getItem('churchAdminPass'), itens: itensEscalaTemp });
    if(res.success) { itensEscalaTemp = []; atualizarPreview(); carregarDados(); showToast("Publicado!"); }
}

async function submitAviso() {
    const res = await fetchData('salvarAviso', {
        senha: localStorage.getItem('churchAdminPass'),
        titulo: document.getElementById('tituloAviso').value,
        mensagem: document.getElementById('msgAviso').value
    });
    if(res.success) { document.getElementById('tituloAviso').value=''; document.getElementById('msgAviso').value=''; carregarDados(); showToast("Enviado!"); }
}

function parseDataSegura(s) {
    if(!s) return new Date();
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

function showToast(m) {
    const t = document.getElementById('toast');
    t.innerText = m; t.classList.remove('hidden');
    setTimeout(() => t.classList.add('hidden'), 3000);
}
function fecharModalPix() { document.getElementById('modalPix').classList.add('hidden'); }
function abrirModalPix() { document.getElementById('modalPix').classList.remove('hidden'); }
function copiarPix() { navigator.clipboard.writeText(document.getElementById('chavePixTexto').innerText); showToast("Copiado!"); }
