// ============ 全局开关 ============
let soundEnabled = true;
let skipAnimation = false;

// ============ 音效系统 ============
let audioCtx = null;
let buffers = {};
let tickTimer = null;
let activeSources = [];

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        loadAllSounds();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

async function loadSound(name, url) {
    try {
        const res = await fetch(url);
        const arr = await res.arrayBuffer();
        buffers[name] = await audioCtx.decodeAudioData(arr);
    } catch (e) { console.warn('音效加载失败:', name); }
}

function loadAllSounds() {
    loadSound('crateOpen', './assets/sounds/crate_open.wav');
    loadSound('crateScroll', './assets/sounds/crate_scroll.wav');
    loadSound('crateDisplay', './assets/sounds/crate_display.wav');
    loadSound('dropUncommon', './assets/sounds/item_drop_uncommon.wav');
    loadSound('dropRare', './assets/sounds/item_drop_rare.wav');
}

function playBuffer(name, volume) {
    if (!soundEnabled) return;
    if (!audioCtx || !buffers[name]) return;
    const vol = volume === undefined ? 1 : volume;
    activeSources = activeSources.filter(s => {
        if (s.name === name) { try { s.source.stop(); } catch(e) {} return false; }
        return true;
    });
    const src = audioCtx.createBufferSource();
    src.buffer = buffers[name];
    const gain = audioCtx.createGain();
    gain.gain.value = vol;
    src.connect(gain);
    gain.connect(audioCtx.destination);
    src.start();
    const entry = { name, source: src };
    activeSources.push(entry);
    src.onended = () => { activeSources = activeSources.filter(s => s !== entry); };
}

function startTickSound(duration) {
    if (!soundEnabled || !audioCtx) return;
    stopTickSound();
    const start = performance.now();
    function next() {
        const elapsed = performance.now() - start;
        if (elapsed >= duration * 1000) { tickTimer = null; return; }
        playBuffer('crateScroll', 0.75);
        const p = elapsed / (duration * 1000);
        const interval = 18 + Math.pow(p, 4) * 450;
        tickTimer = setTimeout(next, interval);
    }
    next();
}

function stopTickSound() {
    if (tickTimer) { clearTimeout(tickTimer); tickTimer = null; }
}

function playCaseOpen() { playBuffer('crateOpen'); }
function playReelStop() { playBuffer('crateDisplay'); }

function playDropSound(rarity) {
    if (rarity === 'gold' || rarity === 'red') playBuffer('dropRare');
    else if (rarity === 'pink' || rarity === 'purple') playBuffer('dropUncommon');
}

// 音效开关
document.getElementById('soundBtn').addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    document.getElementById('soundBtn').textContent = soundEnabled ? '🔊 音效开' : '🔇 音效关';
});

// 跳过动画开关
document.getElementById('skipAnim').addEventListener('change', (e) => {
    skipAnimation = e.target.checked;
});

// ============ 开箱记录统计 ============
const STATS_KEY = 'cs2_case_stats';

function loadStats() {
    try {
        const raw = localStorage.getItem(STATS_KEY);
        if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { total: 0, counts: {gold:0, red:0, pink:0, purple:0, blue:0}, history: [] };
}

function saveStats(stats) {
    try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch (e) {}
}

function recordOpen(caseName, skinName, rarity, floatVal, skinImage) {
    const stats = loadStats();
    stats.total++;
    stats.counts[rarity] = (stats.counts[rarity] || 0) + 1;
    stats.history.unshift({
        case: caseName,
        skin: skinName,
        rarity: rarity,
        float: floatVal,
        image: skinImage,
        time: new Date().toLocaleString('zh-CN', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})
    });
    if (stats.history.length > 100) stats.history = stats.history.slice(0, 100);
    saveStats(stats);
}

const RARITY_META = [
    { key: 'gold',   label: '罕见 ★', color: '#ffd700' },
    { key: 'red',    label: '隐秘',   color: '#eb4b4b' },
    { key: 'pink',   label: '保密',   color: '#d32ce6' },
    { key: 'purple', label: '受限',   color: '#8847ff' },
    { key: 'blue',   label: '军规级', color: '#4b69ff' }
];

function rarityColor(rarity) {
    const m = RARITY_META.find(r => r.key === rarity);
    return m ? m.color : '#fff';
}

function showStats() {
    const stats = loadStats();
    document.getElementById('statsTotal').textContent = stats.total;

    let bdHtml = '';
    RARITY_META.forEach(r => {
        const count = stats.counts[r.key] || 0;
        const pct = stats.total > 0 ? (count / stats.total * 100) : 0;
        bdHtml += `<div class="rarity-row">
            <span class="rarity-label" style="color:${r.color};">${r.label}</span>
            <div class="rarity-bar-bg"><div class="rarity-bar" style="width:${pct}%;background:${r.color};"></div></div>
            <span class="rarity-count">${count} (${pct.toFixed(1)}%)</span>
        </div>`;
    });
    document.getElementById('statsBreakdown').innerHTML = bdHtml;

    let hHtml = '';
    if (stats.history.length === 0) {
        hHtml = '<div style="color:#5c7e95;text-align:center;padding:20px;">暂无开箱记录</div>';
    } else {
        stats.history.slice(0, 30).forEach(h => {
            const color = rarityColor(h.rarity);
            hHtml += `<div class="history-item">
                <img src="${h.image}" alt="">
                <div class="h-info">
                    <div class="h-name" style="color:${color};">${h.skin}</div>
                    <div class="h-case">${h.case} · 磨损 ${h.float}</div>
                </div>
                <div class="h-time">${h.time}</div>
            </div>`;
        });
    }
    document.getElementById('statsHistory').innerHTML = hHtml;
    document.getElementById('statsModal').style.display = 'flex';
}

document.getElementById('statsBtn').addEventListener('click', showStats);
document.getElementById('closeStats').addEventListener('click', () => {
    document.getElementById('statsModal').style.display = 'none';
});
document.getElementById('clearStats').addEventListener('click', () => {
    if (confirm('确定清空所有开箱记录？')) {
        localStorage.removeItem(STATS_KEY);
        showStats();
    }
});

// ============ 业务逻辑 ============
let skinsData = [];
let cratesData = [];
let caseContentsData = {};
let dataReady = false;
let currentCase = null;
let isOpening = false;

const REEL_ITEM_WIDTH = 208;
const REEL_COUNT = 80;
const WIN_INDEX = 65;
const BASE_DURATION = 6.5;

const rarityClass = {
    "Covert": "rarity-red",
    "Classified": "rarity-pink",
    "Restricted": "rarity-purple",
    "Mil-Spec Grade": "rarity-blue"
};

const rarityCN = {
    "Consumer Grade": "消费级",
    "Industrial Grade": "工业级",
    "Mil-Spec Grade": "军规级",
    "Restricted": "受限",
    "Classified": "保密",
    "Covert": "隐秘"
};

const specialPatterns = {
    "Doppler": ["Phase 1","Phase 2","Phase 3","Phase 4","Ruby","Sapphire","Black Pearl"],
    "Gamma Doppler": ["Phase 1","Phase 2","Phase 3","Phase 4","Emerald"]
};

const KNIFE_TYPES = [
    "bayonet", "bowie knife", "butterfly knife", "classic knife",
    "falchion knife", "flip knife", "gut knife", "huntsman knife",
    "karambit", "kukri knife", "m9 bayonet", "navaja knife",
    "nomad knife", "paracord knife", "shadow daggers", "skeleton knife",
    "stiletto knife", "survival knife", "talon knife", "ursus knife"
];

const GLOVE_TYPES = [
    "hand wraps", "moto gloves", "specialist gloves", "sport gloves",
    "driver gloves", "hydra gloves", "broken fang gloves", "bloodhound gloves"
];

function isGoldSkin(skin) {
    const n = skin.name.toLowerCase();
    if (skin.name.startsWith("★ ")) return true;
    if (KNIFE_TYPES.some(t => n.startsWith(t))) return true;
    if (GLOVE_TYPES.some(t => n.startsWith(t))) return true;
    return false;
}

async function loadData() {
    try {
        const [s, c, cc] = await Promise.all([
            fetch('./js/skins.json'),
            fetch('./js/crates.json'),
            fetch('./js/caseContents.json')
        ]);
        skinsData = await s.json();
        cratesData = await c.json();
        caseContentsData = await cc.json();
        renderCaseGrid();
        dataReady = true;
        document.getElementById('loadingTip').style.display = 'none';
    } catch (err) {
        document.getElementById('loadingTip').textContent = '数据加载失败，请检查js文件夹内的JSON文件';
        console.error(err);
    }
}

function renderCaseGrid() {
    const grid = document.getElementById('caseGrid');
    const weaponCases = cratesData.filter(c => c.type === "Case");
    grid.innerHTML = '';
    weaponCases.forEach(c => {
        const div = document.createElement('div');
        div.className = 'case-item';
        div.innerHTML = `<img src="${c.image}" alt="${c.name}"><p>${c.name}</p>`;
        div.addEventListener('click', () => selectCase(c));
        grid.appendChild(div);
    });
}

function selectCase(c) {
    currentCase = c;
    document.getElementById('caseGrid').style.display = 'none';
    document.getElementById('openArea').style.display = 'block';
    document.getElementById('caseDetail').style.display = 'flex';
    document.getElementById('caseDetail').classList.remove('opening');
    document.getElementById('reelSection').style.display = 'none';
    document.getElementById('detailCaseImg').src = c.image;
    document.getElementById('detailSubtitle').textContent = '解锁 ' + c.name;
    document.getElementById('detailKeyText').textContent = '使用 ' + c.name + '钥匙';
    document.getElementById('currentCaseImg').src = c.image;
    document.getElementById('currentCaseName').textContent = c.name;
    buildReel(c);
    renderSkinPreview(c.name);
}

function goBack() {
    if (isOpening) return;
    stopTickSound();
    document.getElementById('openArea').style.display = 'none';
    document.getElementById('caseGrid').style.display = 'grid';
}

document.getElementById('backBtn1').addEventListener('click', goBack);
document.getElementById('backBtn2').addEventListener('click', goBack);

function buildPools(caseName) {
    const info = caseContentsData.Cases[caseName];
    if (!info) return null;
    const pools = { gold: [], red: [], pink: [], purple: [], blue: [] };

    let allItems = [...(info.Items || [])];
    if (info.Knives) allItems = allItems.concat(info.Knives);

    allItems.forEach(name => {
        if (typeof name !== 'string' || name.includes('Case Knives')) return;

        let skin = skinsData.find(s => s.name === name);
        if (!skin) skin = skinsData.find(s => s.name === "★ " + name);
        if (!skin) return;

        if (isGoldSkin(skin)) pools.gold.push(skin);
        else if (skin.rarity === "Covert") pools.red.push(skin);
        else if (skin.rarity === "Classified") pools.pink.push(skin);
        else if (skin.rarity === "Restricted") pools.purple.push(skin);
        else if (skin.rarity === "Mil-Spec Grade") pools.blue.push(skin);
    });
    return pools;
}

function rollRarity() {
    const r = Math.random();
    if (r < 0.0026) return "gold";
    if (r < 0.0090) return "red";
    if (r < 0.0410) return "pink";
    if (r < 0.2008) return "purple";
    return "blue";
}

// 单次开箱核心逻辑，返回结果对象
function doSingleOpen(c) {
    const pools = buildPools(c.name);
    if (!pools) return null;
    let rarity = rollRarity();
    const order = ["gold","red","pink","purple","blue"];
    while (pools[rarity].length === 0) {
        rarity = order[Math.min(order.indexOf(rarity) + 1, 4)];
    }
    const skin = pools[rarity][Math.floor(Math.random() * pools[rarity].length)];
    const floatVal = (Math.random() * (skin.max_float - skin.min_float) + skin.min_float).toFixed(4);
    const isStatTrak = rarity !== "gold" && skin.stattrak && Math.random() < 0.1;
    const displayName = isStatTrak ? "StatTrak™ " + skin.name : skin.name;
    return { skin, rarity, floatVal, displayName };
}

function buildReel(c) {
    const reel = document.getElementById('reel');
    const pools = buildPools(c.name);
    if (!pools) {
        reel.innerHTML = '<div style="color:#888;padding:40px;text-align:center;width:100%;">该箱子数据暂缺</div>';
        return;
    }
    let rarity = rollRarity();
    const order = ["gold","red","pink","purple","blue"];
    while (pools[rarity].length === 0) {
        rarity = order[Math.min(order.indexOf(rarity) + 1, 4)];
    }
    const winSkin = pools[rarity][Math.floor(Math.random() * pools[rarity].length)];

    function pickWeightedSkin() {
        const r = Math.random();
        let pool;
        if (r < 0.0026 && pools.gold.length > 0) pool = pools.gold;
        else if (r < 0.0090 && pools.red.length > 0) pool = pools.red;
        else if (r < 0.0410 && pools.pink.length > 0) pool = pools.pink;
        else if (r < 0.2008 && pools.purple.length > 0) pool = pools.purple;
        else pool = pools.blue;
        return pool[Math.floor(Math.random() * pool.length)];
    }

    reel.innerHTML = '';
    for (let i = 0; i < REEL_COUNT; i++) {
        const skin = (i === WIN_INDEX) ? winSkin : pickWeightedSkin();
        const cls = isGoldSkin(skin) ? "rarity-gold" : (rarityClass[skin.rarity] || "");
        const item = document.createElement('div');
        item.className = `reel-item ${cls}`;
        item.innerHTML = `<img src="${skin.image}" alt="${skin.name}"><p>${skin.name}</p>`;
        reel.appendChild(item);
    }
    reel.style.transition = 'none';
    reel.style.transform = 'translateX(0)';
    reel.dataset.winRarity = rarity;
    reel.dataset.winSkinName = winSkin.name;
}

function renderSkinPreview(caseName) {
    const container = document.getElementById('skinPreview');
    const pools = buildPools(caseName);
    if (!pools) { container.innerHTML = ''; return; }

    const groups = [
        { key: 'gold',   label: '★ 罕见（刀 / 手套）', color: '#ffd700' },
        { key: 'red',    label: '隐秘',                color: '#eb4b4b' },
        { key: 'pink',   label: '保密',                color: '#d32ce6' },
        { key: 'purple', label: '受限',                color: '#8847ff' },
        { key: 'blue',   label: '军规级',              color: '#4b69ff' }
    ];

    let html = '';
    groups.forEach(g => {
        if (pools[g.key].length === 0) return;
        html += `<h3 style="color:${g.color};">${g.label} · ${pools[g.key].length}款</h3>`;
        html += '<div class="skin-row">';
        pools[g.key].forEach(skin => {
            html += `<div class="skin-mini" style="border-bottom-color:${g.color};">
                <img src="${skin.image}" alt="${skin.name}">
                <p>${skin.name}</p>
            </div>`;
        });
        html += '</div>';
    });
    container.innerHTML = html;
}

// 展示单抽结果
function showSingleResult(result) {
    const { skin, rarity, floatVal, displayName } = result;
    const color = rarityColor(rarity);

    let pattern = null;
    for (const [kw, phases] of Object.entries(specialPatterns)) {
        if (skin.name.includes(kw)) { pattern = phases[Math.floor(Math.random() * phases.length)]; break; }
    }

    document.getElementById('resultImg').src = skin.image;
    document.getElementById('resultName').textContent = displayName;
    document.getElementById('resultName').style.color = color;
    document.getElementById('resultRarity').textContent = `品质：${rarity === "gold" ? "罕见 ★" : rarityCN[skin.rarity]}`;
    document.getElementById('resultRarity').style.color = color;
    document.getElementById('resultFloat').textContent = `磨损值：${floatVal}（${getWearCN(floatVal)}）`;
    document.getElementById('resultPattern').textContent = pattern ? `模板：${pattern}` : '';
    document.getElementById('resultPattern').style.display = pattern ? 'block' : 'none';

    const pct = Math.min(100, Math.max(0, parseFloat(floatVal) * 100));
    document.getElementById('floatMarker').style.left = pct + '%';

    document.getElementById('resultCard').style.border = `3px solid ${color}`;
    document.getElementById('resultCard').style.boxShadow = `0 0 40px ${color}55`;
    document.getElementById('resultModal').style.display = 'flex';

    recordOpen(currentCase.name, displayName, rarity, floatVal, skin.image);
}

// 单抽按钮
document.getElementById('openBtn').addEventListener('click', () => {
    if (isOpening || !dataReady || !currentCase) return;
    initAudio();
    isOpening = true;
    document.getElementById('openBtn').disabled = true;
    document.getElementById('tenBtn').disabled = true;

    const result = doSingleOpen(currentCase);
    if (!result) { isOpening = false; return; }

    if (skipAnimation) {
        // 跳过动画，直接出结果
        playCaseOpen();
        setTimeout(() => {
            playDropSound(result.rarity);
            showSingleResult(result);
            isOpening = false;
            document.getElementById('openBtn').disabled = false;
            document.getElementById('tenBtn').disabled = false;
        }, 300);
    } else {
        // 正常动画流程
        playCaseOpen();
        const detail = document.getElementById('caseDetail');
        const reelSec = document.getElementById('reelSection');
        detail.classList.add('opening');

        setTimeout(() => {
            detail.style.display = 'none';
            reelSec.style.display = 'block';
            buildReelWithResult(currentCase, result);
            setTimeout(() => startSpin(result), 500);
        }, 600);
    }
});

// 用指定结果构建滚动条（中奖位置固定为该结果）
function buildReelWithResult(c, result) {
    const reel = document.getElementById('reel');
    const pools = buildPools(c.name);
    if (!pools) return;

    function pickWeightedSkin() {
        const r = Math.random();
        let pool;
        if (r < 0.0026 && pools.gold.length > 0) pool = pools.gold;
        else if (r < 0.0090 && pools.red.length > 0) pool = pools.red;
        else if (r < 0.0410 && pools.pink.length > 0) pool = pools.pink;
        else if (r < 0.2008 && pools.purple.length > 0) pool = pools.purple;
        else pool = pools.blue;
        return pool[Math.floor(Math.random() * pool.length)];
    }

    reel.innerHTML = '';
    for (let i = 0; i < REEL_COUNT; i++) {
        const skin = (i === WIN_INDEX) ? result.skin : pickWeightedSkin();
        const cls = isGoldSkin(skin) ? "rarity-gold" : (rarityClass[skin.rarity] || "");
        const item = document.createElement('div');
        item.className = `reel-item ${cls}`;
        item.innerHTML = `<img src="${skin.image}" alt="${skin.name}"><p>${skin.name}</p>`;
        reel.appendChild(item);
    }
    reel.style.transition = 'none';
    reel.style.transform = 'translateX(0)';
    reel.dataset.winRarity = result.rarity;
    reel.dataset.winSkinName = result.skin.name;
}

function startSpin(result) {
    const reel = document.getElementById('reel');
    const containerWidth = reel.parentElement.offsetWidth;
    const targetX = -(WIN_INDEX * REEL_ITEM_WIDTH) + (containerWidth / 2) - (REEL_ITEM_WIDTH / 2);
    const extraSpin = containerWidth * 2;
    const speed = parseFloat(document.getElementById('speedSlider').value);
    const duration = BASE_DURATION / speed;

    startTickSound(duration);

    reel.style.transition = 'none';
    reel.style.transform = `translateX(${extraSpin}px)`;
    reel.offsetHeight;
    reel.style.transition = `transform ${duration}s cubic-bezier(0.06, 0.85, 0.1, 1)`;
    reel.style.transform = `translateX(${targetX}px)`;

    setTimeout(() => {
        stopTickSound();
        playReelStop();
        setTimeout(() => playDropSound(result.rarity), 200);
        showSingleResult(result);
        isOpening = false;
        document.getElementById('openBtn').disabled = false;
        document.getElementById('tenBtn').disabled = false;
    }, duration * 1000 + 100);
}

// 十连开
document.getElementById('tenBtn').addEventListener('click', () => {
    if (isOpening || !dataReady || !currentCase) return;
    isOpening = true;
    document.getElementById('openBtn').disabled = true;
    document.getElementById('tenBtn').disabled = true;

    const results = [];
    for (let i = 0; i < 10; i++) {
        const r = doSingleOpen(currentCase);
        if (r) results.push(r);
    }

    // 记录全部十次
    results.forEach(r => {
        recordOpen(currentCase.name, r.displayName, r.rarity, r.floatVal, r.skin.image);
    });

    // 展示十连结果
    showTenResults(results);

    isOpening = false;
    document.getElementById('openBtn').disabled = false;
    document.getElementById('tenBtn').disabled = false;
});

function showTenResults(results) {
    const grid = document.getElementById('tenGrid');
    let html = '';
    results.forEach(r => {
        const color = rarityColor(r.rarity);
        html += `<div class="ten-item" style="border-bottom-color:${color};">
            <img src="${r.skin.image}" alt="">
            <div class="ten-name" style="color:${color};">${r.displayName}</div>
            <div class="ten-float">磨损 ${r.floatVal}</div>
        </div>`;
    });
    grid.innerHTML = html;
    document.getElementById('tenModal').style.display = 'flex';
}

document.getElementById('closeTen').addEventListener('click', () => {
    document.getElementById('tenModal').style.display = 'none';
});

function getWearCN(f) {
    const v = parseFloat(f);
    if (v < 0.07) return "崭新出厂";
    if (v < 0.15) return "略有磨损";
    if (v < 0.38) return "久经沙场";
    if (v < 0.45) return "破损不堪";
    return "战痕累累";
}

document.getElementById('closeResult').addEventListener('click', () => {
    document.getElementById('resultModal').style.display = 'none';
    const reelSec = document.getElementById('reelSection');
    const detail = document.getElementById('caseDetail');
    reelSec.style.display = 'none';
    detail.classList.remove('opening');
    detail.style.display = 'flex';
});

document.getElementById('speedSlider').addEventListener('input', (e) => {
    document.getElementById('speedValue').textContent = parseFloat(e.target.value).toFixed(1) + 'x';
});

loadData();
