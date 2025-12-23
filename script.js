// --- CONFIGURAÇÃO ---
const API_URL = 'https://script.google.com/macros/s/AKfycbyg4gz8cGyrRpDEG989Kgw1fAnrjzzz7jYAyqbuLTXig2iO396iTMYJiukmkoei5GU8/exec'; 

// --- INICIALIZAÇÃO ---
window.onload = function() {
    verificarAcessoMembro();
    verificarSessaoAdmin();
};

// --- LÓGICA DE LOGIN (MEMBRO) ---
function verificarAcessoMembro() {
    const email = localStorage.getItem('ad_membro_email');
    if (email) {
        // Se já tem email salvo, libera o acesso
        const nome = localStorage.getItem('ad_membro_nome');
        mostrarAreaMembro(nome);
    } else {
        // Se não, mostra a tela de login
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

    // 1. Envia para o Google Sheets (para salvar na lista de avisos)
    // Não esperamos a resposta para não travar o usuário, enviamos em "background"
    fetchData('cadastrarMembro', { nome: nome, email: email });

    // 2. Salva no navegador do usuário
    localStorage.setItem('ad_membro_nome', nome);
    localStorage.setItem('ad_membro_email', email);

    // 3. Libera o acesso
    mostrarAreaMembro(nome);
}

function mostrarAreaMembro(nome) {
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('memberArea').classList.remove('hidden');
    
    // Atualiza o menu superior
    document.getElementById('userInfo').classList.remove('hidden');
    document.getElementById('userNameDisplay').innerText = "Paz, " + nome.split(' ')[0]; // Só o primeiro nome

    // Carrega os dados da igreja
    carregarDados();
}

function sairMembro() {
    if(confirm("Deseja sair? Você terá que digitar seus dados novamente.")) {
        localStorage.removeItem('ad_membro_nome');
        localStorage.removeItem('ad_membro_email');
        location.reload();
    }
}

// --- FUNÇÕES DE DADOS (API) ---
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
    // Carregar Escalas
    const escalas = await fetchData('getEscalas');
    const tbody = document.getElementById('tabelaEscalasBody');
    tbody.innerHTML = "";
    
    if (escalas.length === 0) {
        tbody.innerHTML = "<tr><td colspan='3' style='text-align:center'>Nenhuma escala publicada.</td></tr>";
    } else {
        escalas.forEach(e => {
            // Formatação segura da data
            let dataF = e.data;
            try { dataF = new Date(e.data).toLocaleDateString('pt-BR'); } catch(x){}
            
            // Formatação da hora
            let horaF = e.hora;
            if (e.hora && e.hora.toString().includes('T')) {
                horaF = new Date(e.hora).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
            }

            tbody.innerHTML += `
                <tr>
                    <td><strong>${dataF}</strong><br><span style="color:#666">${horaF}</span></td>
                    <td><strong style="color:var(--primary)">${e.evento}</strong></td>
                    <td>
                        <div><small>Dirigente:</small> ${e.dirigentes}</div>
                        <div style="margin-top:5px"><small>Porteiro:</small> ${e.porteiros}</div>
                    </td>
                </tr>`;
        });
    }

    // Carregar Avisos
    const avisos = await fetchData('getAvisos');
    const divAvisos = document.getElementById('avisosContainer');
    divAvisos.innerHTML = "";
    
    if (avisos.length === 0) divAvisos.innerHTML = "<p>Sem avisos no momento.</p>";
    else {
        avisos.forEach(a => {
            const dataPost = new Date(a.dataPostagem).toLocaleDateString('pt-BR');
            divAvisos.innerHTML += `
                <div class="aviso-item">
                    <div class="aviso-header">
                        <span class="aviso-title">${a.titulo}</span>
                        <span class="aviso-date">${dataPost}</span>
                    </div>
                    <p>${a.mensagem}</p>
                </div>`;
        });
    }
}

// --- LÓGICA DE ADMIN (OBREIRO) ---
function toggleAdminLogin() {
    const modal = document.getElementById('loginModal');
    const loginSection = document.getElementById('loginSection');
    const memberArea = document.getElementById('memberArea');

    // Alterna o Modal (Abre/Fecha)
    modal.classList.toggle('hidden');

    // TRUQUE VISUAL:
    // Se a área de membros NÃO está visível (ou seja, estou na tela de login "Hero")
    if (memberArea.classList.contains('hidden')) {
        // Alterna a visibilidade do fundo também (para limpar a tela)
        loginSection.classList.toggle('hidden');
    }
}

async function validarAdmin() {
    const pass = document.getElementById('adminPassword').value;
    const btn = document.querySelector('#loginModal .btn-primary');
    const modal = document.getElementById('loginModal');
    
    btn.innerText = "Verificando...";
    
    const res = await fetchData('login', { senha: pass });
    
    if (res.success) {
        localStorage.setItem('churchAdminPass', pass);
        
        // Sucesso: Esconde o modal de senha
        modal.classList.add('hidden'); 
        
        // Mostra o painel do obreiro
        verificarSessaoAdmin();
        showToast("Bem-vindo, Obreiro!");
        
        // Nota: Não reexibimos o 'loginSection' aqui para manter o foco no Painel Admin
    } else {
        alert("Senha incorreta.");
        document.getElementById('adminPassword').value = '';
    }
    btn.innerText = "Entrar no Painel";
}

function verificarSessaoAdmin() {
    const pass = localStorage.getItem('churchAdminPass');
    if (pass) {
        document.getElementById('adminPanel').classList.remove('hidden');
    }
}

function logoutAdmin() {
    localStorage.removeItem('churchAdminPass');
    location.reload();
}

async function submitEscala() {
    const senha = localStorage.getItem('churchAdminPass');
    const dados = {
        senha: senha,
        data: document.getElementById('dataEscala').value,
        hora: document.getElementById('horaEscala').value,
        evento: document.getElementById('eventoEscala').value,
        dirigentes: document.getElementById('dirigentesEscala').value,
        porteiros: document.getElementById('porteirosEscala').value
    };
    if(!dados.data) return showToast("Preencha a data.");
    
    showToast("Publicando...");
    const res = await fetchData('salvarEscala', dados);
    showToast(res.msg);
    if(res.success) { 
        document.getElementById('eventoEscala').value = ''; 
        carregarDados();
    }
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

// Variável global para armazenar a lista temporária
let itensEscalaTemp = [];

function adicionarItemEscala() {
    // Pega os valores
    const data = document.getElementById('dataEscala').value;
    const hora = document.getElementById('horaEscala').value;
    const evento = document.getElementById('eventoEscala').value;
    const dirigentes = document.getElementById('dirigentesEscala').value;
    const porteiros = document.getElementById('porteirosEscala').value;

    if (!data || !evento) {
        showToast("Preencha pelo menos Data e Evento.");
        return;
    }

    // Adiciona ao array
    itensEscalaTemp.push({
        data: data,
        hora: hora,
        evento: evento,
        dirigentes: dirigentes,
        porteiros: porteiros
    });

    // Atualiza visualmente
    atualizarPreview();
    
    // Limpa os campos para o próximo
    document.getElementById('eventoEscala').value = '';
    document.getElementById('dirigentesEscala').value = '';
    document.getElementById('porteirosEscala').value = '';
    // (Opcional: manter a data ou limpar, depende da preferência. Vou manter a data pra facilitar lançar vários cultos no mesmo dia se tiver)
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
        btn.innerText = `Publicar Semana Inteira (${itensEscalaTemp.length} itens)`;

        itensEscalaTemp.forEach((item, index) => {
            // Formata data rapidinho pra visualização
            let dataPt = item.data.split('-').reverse().join('/');
            ul.innerHTML += `<li>${dataPt} - ${item.evento} <span style="color:red; cursor:pointer; font-weight:bold;" onclick="removerItem(${index})">X</span></li>`;
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
    if (!confirm(`Confirma a publicação de ${itensEscalaTemp.length} escalas? Isso enviará 1 e-mail para todos.`)) return;

    const btn = document.getElementById('btnPublicarTudo');
    btn.innerText = "Enviando...";
    btn.disabled = true;

    const dados = {
        senha: senha,
        itens: itensEscalaTemp // Envia o array todo
    };

    showToast("Processando lote...");
    
    const res = await fetchData('salvarEscalaLote', dados); // Nova ação no Apps Script
    
    showToast(res.msg);
    
    if (res.success) {
        itensEscalaTemp = []; // Zera a lista
        atualizarPreview();
        carregarDados(); // Recarrega a tabela do site
    }
    
    btn.innerText = "Publicar Semana Inteira";
}