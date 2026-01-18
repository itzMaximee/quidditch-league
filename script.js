// ==========================================
// 1. NAVIGATION LOGIC
// ==========================================
function showPage(pageId) {
    document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active-page'));
    const targetPage = document.getElementById('page-' + pageId);
    if (targetPage) targetPage.classList.add('active-page');

    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById('nav-' + pageId);
    if (activeBtn) activeBtn.classList.add('active');
}

// ==========================================
// 2. SUPABASE SETUP (RENAMED TO FIX CRASH)
// ==========================================
const SUPABASE_URL = 'https://xugasmrxombmdgnukfky.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1Z2FzbXJ4b21ibWRnbnVrZmt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3MjQ1ODUsImV4cCI6MjA4NDMwMDU4NX0.Ie8qJi_TcEr_ByaSdxXXIPrWmsZCcqjJ5wt0daVsOTA';

// We use a different name here to avoid conflict with the library
let supabaseClient; 

if (window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log("Supabase connected successfully.");
} else {
    console.error("CRITICAL ERROR: Supabase library not found in HTML.");
}

// ==========================================
// 3. STATE MANAGEMENT
// ==========================================
let teams = [];
let matches = [];
let players = [];

// ==========================================
// 4. INITIALIZATION
// ==========================================
async function init() {
    if (!supabaseClient) return;

    await Promise.all([
        fetchTeams(),
        fetchPlayers(),
        fetchMatches()
    ]);
    render();
    
    const heroName = document.getElementById('heroName');
    if(heroName && heroName.innerText === 'Loading...') {
        heroName.innerText = "NO DATA";
    }
}

// ==========================================
// 5. DATABASE FUNCTIONS
// ==========================================
async function fetchTeams() {
    const { data, error } = await supabaseClient.from('teams').select('*');
    if (!error) teams = data || [];
}

async function fetchPlayers() {
    const { data, error } = await supabaseClient.from('players').select('*');
    if (!error) players = data || [];
}

async function fetchMatches() {
    const { data, error } = await supabaseClient.from('matches').select('*');
    if (!error) matches = data || [];
}

// ==========================================
// 6. ACTION FUNCTIONS
// ==========================================
async function addTeam() {
    const input = document.getElementById('teamNameInput');
    const name = input.value.trim();
    if (!name) return alert("Enter Name");

    const { error } = await supabaseClient.from('teams').insert({ name: name });

    if (error) alert("Error: " + error.message);
    else {
        input.value = '';
        await fetchTeams();
        render();
    }
}

async function addPlayer() {
    const name = document.getElementById('playerNameInput').value.trim();
    const team = document.getElementById('playerTeamSelect').value;
    const pos = document.getElementById('playerPositionSelect').value;

    if (!name || team.includes("Select")) return alert("Check inputs");

    const { error } = await supabaseClient.from('players').insert({
        name: name, team: team, position: pos
    });

    if (error) alert("Error: " + error.message);
    else {
        document.getElementById('playerNameInput').value = '';
        await fetchPlayers();
        render();
    }
}

async function updateStat(type) {
    const pid = document.getElementById('statPlayerSelect').value;
    if (!pid) return alert("Select player");

    const p = players.find(x => x.id == pid);
    if (!p) return;

    let update = {};
    if (type === 'goals') update = { goals: p.goals + 1 };
    if (type === 'saves') update = { saves: p.saves + 1 };
    if (type === 'defense') update = { defense: p.defense + 1 };

    const { error } = await supabaseClient.from('players').update(update).eq('id', pid);
    if (!error) {
        await fetchPlayers();
        render();
    }
}

async function addMatch() {
    const home = document.getElementById('homeTeamSelect').value;
    const away = document.getElementById('awayTeamSelect').value;
    const hScore = parseInt(document.getElementById('homeScore').value);
    const aScore = parseInt(document.getElementById('awayScore').value);
    const snitchId = document.getElementById('snitchPlayerSelect').value;
    const defenderId = document.getElementById('defenderSelect').value;

    if (home === away || isNaN(hScore)) return alert("Check inputs");

    const { error: matchErr } = await supabaseClient.from('matches').insert({
        home: home, away: away, h_score: hScore, a_score: aScore,
        snitch_id: snitchId || null, defender_id: defenderId || null
    });

    if (matchErr) return alert(matchErr.message);

    if (snitchId) {
        const p = players.find(x => x.id == snitchId);
        await supabaseClient.from('players').update({ snitches: p.snitches + 1 }).eq('id', snitchId);
    }
    if (defenderId) {
        const p = players.find(x => x.id == defenderId);
        await supabaseClient.from('players').update({ defense: p.defense + 2 }).eq('id', defenderId);
    }

    document.getElementById('homeScore').value = '';
    document.getElementById('awayScore').value = '';
    await Promise.all([fetchMatches(), fetchPlayers()]);
    render();
}

// ==========================================
// 7. RENDER & CALCULATIONS
// ==========================================
function openTeamDetails(teamName) {
    showPage('team-details');
    
    const titleEl = document.getElementById('detailTeamName');
    if(titleEl) titleEl.innerText = teamName;

    const standings = getStandings().find(t => t.name === teamName);
    document.getElementById('detailPlayed').innerText = standings ? standings.P : 0;
    document.getElementById('detailWon').innerText = standings ? standings.W : 0;
    document.getElementById('detailLost').innerText = standings ? standings.L : 0;
    document.getElementById('detailPoints').innerText = standings ? standings.Pts : 0;

    const teamPlayers = players.filter(p => p.team === teamName);
    document.getElementById('detailRosterBody').innerHTML = teamPlayers.map(p => `
        <tr>
            <td style="font-weight:bold;">${p.name}</td>
            <td style="text-transform:uppercase; font-size:0.8rem; color:#888;">${p.position}</td>
            <td>${p.goals}</td><td>${p.saves}</td><td>${p.defense}</td>
            <td style="color:#27ae60; font-weight:bold;">$${getPlayerValue(p)}</td>
        </tr>
    `).join('');

    const teamMatches = matches.filter(m => m.home === teamName || m.away === teamName);
    document.getElementById('detailMatchHistory').innerHTML = teamMatches.reverse().map(m => {
        const isHome = m.home === teamName;
        const result = (isHome && m.h_score > m.a_score) || (!isHome && m.a_score > m.h_score) ? 
            '<span style="color:#27ae60">W</span>' : '<span style="color:#c0392b">L</span>';
        return `<li><span>${result} vs ${isHome ? m.away : m.home}</span><span><strong>${m.h_score} - ${m.a_score}</strong></span></li>`;
    }).join('');
}

function getStandings() {
    let stats = {};
    teams.forEach(t => stats[t.name] = { name: t.name, P: 0, W: 0, L: 0, Pts: 0 });

    matches.forEach(m => {
        if (!stats[m.home] || !stats[m.away]) return;
        stats[m.home].P++; stats[m.away].P++;
        stats[m.home].Pts += m.h_score; stats[m.away].Pts += m.a_score;
        if (m.h_score > m.a_score) { stats[m.home].W++; stats[m.away].L++; }
        else if (m.a_score > m.h_score) { stats[m.away].W++; stats[m.home].L++; }
    });
    return Object.values(stats).sort((a, b) => b.Pts - a.Pts);
}

function getPlayerValue(p) {
    let val = 500 + (p.goals * 50) + (p.saves * 30) + (p.defense * 20) + (p.snitches * 150);
    if (p.position === 'Seeker' && p.snitches > 0) val += 200;
    return val;
}

function render() {
    const fill = (id, opts, def) => {
        const el = document.getElementById(id);
        if(!el) return;
        const curr = el.value;
        el.innerHTML = `<option value="">${def}</option>` + opts.map(o => `<option value="${o.val}">${o.txt}</option>`).join('');
        if ([...el.options].some(o => o.value === curr)) el.value = curr;
    };

    const tOpts = teams.map(t => ({ val: t.name, txt: t.name }));
    fill('homeTeamSelect', tOpts, 'Select Home');
    fill('awayTeamSelect', tOpts, 'Select Away');
    fill('playerTeamSelect', tOpts, 'Select Team');

    const pOpts = players.sort((a, b) => a.name.localeCompare(b.name)).map(p => ({ val: p.id, txt: `${p.name} (${p.team})` }));
    fill('statPlayerSelect', pOpts, 'Select Player...');
    fill('defenderSelect', pOpts, '-- None --');

    const kOpts = players.filter(p => p.position === 'Keeper').map(p => ({ val: p.id, txt: `🛡️ ${p.name}` }));
    fill('snitchPlayerSelect', kOpts, '-- None --');

    const standingsBody = document.getElementById('standingsBody');
    if(standingsBody) {
        standingsBody.innerHTML = getStandings().map((t, i) => `
            <tr onclick="openTeamDetails('${t.name}')">
                <td>${i + 1}</td><td style="font-weight:bold;">${t.name}</td>
                <td>${t.P}</td><td>${t.W}</td><td>${t.L}</td>
                <td style="color:#3498db; font-weight:bold;">${t.Pts}</td>
            </tr>
        `).join('');
    }

    const playerBody = document.getElementById('playerTableBody');
    if(playerBody) {
        const ranked = players.map(p => ({ ...p, val: getPlayerValue(p) })).sort((a, b) => b.val - a.val);
        playerBody.innerHTML = ranked.map(p => `
            <tr>
                <td style="font-weight:bold;">${p.name}</td><td>${p.team}</td>
                <td style="font-size:0.8rem; color:#999;">${p.position}</td>
                <td>${p.goals}</td><td>${p.saves}</td><td>${p.defense}</td><td>${p.snitches}</td>
                <td style="color:#27ae60; font-weight:bold;">$${p.val}</td>
            </tr>
        `).join('');

        if (ranked.length > 0) {
            const top = ranked[0];
            const heroName = document.getElementById('heroName');
            if(heroName) {
                heroName.innerText = top.name;
                document.getElementById('heroTeam').innerText = top.team;
                document.getElementById('heroPos').innerText = top.position;
                document.getElementById('heroVal').innerText = "$" + top.val;
                document.getElementById('heroGoals').innerText = top.goals;
                document.getElementById('heroSaves').innerText = top.saves;
            }
        }
    }

    const historyBody = document.getElementById('matchHistory');
    if(historyBody) {
        historyBody.innerHTML = matches.slice().reverse().map(m =>
            `<li><span>${m.home} vs ${m.away}</span><span><strong>${m.h_score} - ${m.a_score}</strong></span></li>`
        ).join('');
    }
}

function clearData() {
    location.reload();
}

function exportStandingsCSV() {
    const data = getStandings().map(t => `${t.name},${t.P},${t.W},${t.L},${t.Pts}`);
    downloadCSV("Team,Played,Won,Lost,Points\n" + data.join("\n"), "standings.csv");
}
function exportPlayersCSV() {
    const data = players.map(p => `${p.name},${p.team},${p.position},${p.goals},${p.saves},${p.defense},${p.snitches},${getPlayerValue(p)}`);
    downloadCSV("Name,Team,Pos,Goals,Saves,Def,Snitches,Value\n" + data.join("\n"), "players.csv");
}
function downloadCSV(c, n) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([c], { type: 'text/csv' })); a.download = n; a.click();
}

// Start
init();
