import { t, getLocale } from './i18n.mjs';
export const uid = () => crypto.randomUUID();
export const modeLabels = { classic: 'Classic', forced: 'Forced', spell: 'Spell', 'forced-spell': 'Forced + Spell' };
export const roleLabels = { get A() { return t('Tożsamość'); }, get B() { return t('Intencja'); }, get C() { return t('Wyobrażenie'); } };
export const templateLines = {
    classic: [['A', 'Jestem spokojny i obecny w tej chwili.'], ['B', 'Oddycham swobodnie i rozluźniam napięcie.'], ['C', 'Wyobrażam sobie, jak z łatwością wracam do skupienia.']],
    forced: [['A', 'Wybieram pewność siebie. To moja decyzja.'], ['B', 'Skup się. Oddychaj. Działaj z przekonaniem.'], ['B', 'Wracaj do celu za każdym razem, gdy uwaga odpływa.'], ['C', 'Widzę siebie działającego spokojnie i zdecydowanie.']],
    'forced-spell': [['A', 'Moja decyzja jest jasna. Wybieram spokój i pewność.'], ['B', 'Skup się na intencji. Wprowadzaj ją w życie krok po kroku.'], ['C', 'Z każdym oddechem nadaję swojej intencji wyraźny kształt.'], ['C', 'Wyobrażam sobie, jak działam pewnie, w swoim rytmie.']],
    spell: [['A', 'Z każdym oddechem wracam do swojej przestrzeni.'], ['B', 'Niech ta chwila będzie początkiem mojego skupienia.'], ['C', 'Wyobrażam sobie światło, które łagodnie wypełnia przestrzeń.'], ['C', 'Zamykam tę intencję w spokojnym rytmie oddechu.']]
};
export function createProject(name = t("Nowa sesja"), mode = 'classic') {
    const now = new Date().toISOString();
    return { schemaVersion: 2, id: uid(), name, mode, createdAt: now, updatedAt: now, script: templateLines[mode].map(([role, text]) => ({ id: uid(), role, text: t(text) })), layers: [], duration: 180, variant: 'LOW', targetLufs: -24, background: { kind: (mode === 'spell' || mode === 'forced-spell') ? 'pink' : 'brown', gainDb: -18 }, pulse: { enabled: false, hz: 6, depth: 0.2 }, exports: [] };
}
export function applyMode(p, mode) { return { ...p, mode }; }
export function duplicateProject(p) { const now = new Date().toISOString(); return { ...structuredClone(p), id: uid(), name: t("{0} · kopia", [p.name.slice(0, 185)]), createdAt: now, updatedAt: now, exports: [], comparisons: [], script: p.script.map(l => ({ ...l, id: uid() })), layers: p.layers.map(l => ({ ...l, id: uid() })) }; }
export function findRepeatedLines(lines) { const seen = new Set(); const repeated = []; for (const line of lines) {
    const key = line.text.toLocaleLowerCase('pl').replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
    if (!key)
        continue;
    if (seen.has(key))
        repeated.push(line.id);
    seen.add(key);
} return repeated; }
export function personalizeScript(lines, name) { return lines.map(l => ({ ...l, text: l.text.replace(/\{(?:imię|imie|name)\}/gi, () => name.trim()) })); }
export function parseScript(text) {
    let role = 'A';
    const roles = { a: 'A', b: 'B', c: 'C', identity: 'A', intention: 'B', imagination: 'C', 'tożsamość': 'A', tozsamosc: 'A', intencja: 'B', 'wyobrażenie': 'C', wyobrazenie: 'C', 'wyobraźnia': 'C', wyobraznia: 'C' };
    const roleFor = (label) => roles[label.trim().replace(/^(\*\*|__)(.*?)\1$/, '$2').toLowerCase()];
    const result = [];
    for (const raw of text.split(/\r\n?|\n/)) {
        let line = raw.trim();
        if (!line || /^(?:`{3,}|~{3,})/.test(line) || /^(?:[-*_]\s*){3,}$/.test(line))
            continue;
        // A table is interpreted only when its first cell is an explicit role.
        if (line.includes('|') && !/^(?:\[[ABC]\]|[ABC])\s*\|/i.test(line)) {
            const cells = line.replace(/^\|/, '').replace(/(?<!\\)\|$/, '').split(/(?<!\\)\|/).map(cell => cell.trim().replace(/\\\|/g, '|'));
            if (cells.length >= 2) {
                if (cells.every(cell => /^:?-{3,}:?$/.test(cell)))
                    continue;
                if (/^(?:role|rola|layer|warstwa)$/i.test(cells[0]) && /^(?:affirmation|afirmacja|text|tekst)$/i.test(cells[1]))
                    continue;
                const tableRole = roleFor(cells[0].replace(/^\[|\]$/g, ''));
                if (tableRole && cells[1]) {
                    result.push({ id: uid(), role: tableRole, text: cells.slice(1).join(' | ') });
                    if (result.length === 500)
                        break;
                    continue;
                }
            }
        }
        const heading = /^#{1,6}\s+/.test(line);
        line = line.replace(/^#{1,6}\s+/, '').replace(/\s+#+$/, '').replace(/^(?:[-*+•]\s+|\d+[.)]\s+)/, '');
        const section = line.replace(/^(?:\*\*|__)(.*?)(?:\*\*|__)$/, '$1').replace(/:$/, '').trim();
        const namedRole = roleFor(section);
        const layer = section.match(/^(?:warstwa|layer)\s+([ABC])\b(?:\s.*)?$/i);
        const marked = section.match(/^\[([ABC])\]$/i);
        const titled = heading ? section.match(/^([ABC])\s*[-—–:.)]\s*.+$/i) : null;
        if (namedRole || layer || marked || titled) {
            role = namedRole || (layer?.[1] || marked?.[1] || titled?.[1]).toUpperCase();
            continue;
        }
        if (heading)
            continue;
        const prefix = line.match(/^(?:\[([ABC])\]\s*|([ABC])\s*[:|)]\s*)(.*)$/i);
        if (prefix) {
            const inlineRole = (prefix[1] || prefix[2]).toUpperCase();
            if (!prefix[3].trim()) {
                role = inlineRole;
                continue;
            }
            result.push({ id: uid(), role: inlineRole, text: prefix[3].trim() });
        }
        else if (line)
            result.push({ id: uid(), role, text: line });
        if (result.length === 500)
            break;
    }
    return result;
}
function numberIn(value, min, max, name) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
        throw new Error(t("Nieprawidłowa wartość: {0}.", [name]));
    return value;
}
function textIn(value, max, name) {
    if (typeof value !== 'string' || value.length > max)
        throw new Error(t("Nieprawidłowe pole: {0}.", [name]));
    return value;
}
function dateIn(value, name) { textIn(value, 80, name); if (!Number.isFinite(Date.parse(value)))
    throw new Error(t("Nieprawidłowa data: {0}.", [name])); }
export function validateProject(input) {
    if (!input || typeof input !== 'object')
        throw new Error(t("To nie jest plik projektu."));
    const p = structuredClone(input);
    if (p.schemaVersion !== 2)
        throw new Error(t("Nieobsługiwana wersja projektu."));
    textIn(p.id, 100, t("identyfikator"));
    if (!/^[a-zA-Z0-9_-]+$/.test(p.id))
        throw new Error(t("Nieprawidłowy identyfikator projektu."));
    dateIn(p.createdAt, t("utworzenie"));
    dateIn(p.updatedAt, t("ostatni zapis"));
    textIn(p.name, 200, t("nazwa"));
    if (!p.name.trim())
        throw new Error(t("Nadaj projektowi nazwę."));
    if (!['classic', 'forced', 'spell', 'forced-spell'].includes(p.mode) || !['CLEAR', 'LOW', 'MASKED', 'DEEP', 'CONTROL'].includes(p.variant))
        throw new Error(t("Nieprawidłowy tryb projektu."));
    numberIn(p.duration, 5, 3600, t("czas"));
    numberIn(p.targetLufs, -36, -14, t("głośność"));
    if (!p.background || !['brown', 'pink', 'none', 'file'].includes(p.background.kind))
        throw new Error(t("Nieprawidłowe tło."));
    numberIn(p.background.gainDb, -60, 0, t("poziom tła"));
    for (const [key, min, max] of [['highpassHz', 20, 2000], ['lowpassHz', 1000, 20000], ['fadeIn', 0, 10], ['fadeOut', 0, 10], ['pan', -1, 1], ['speed', .5, 2]]) {
        const value = p.background[key];
        if (value !== undefined)
            numberIn(value, min, max, key);
    }
    for (const key of ['muted', 'solo', 'reverse'])
        if (p.background[key] !== undefined && typeof p.background[key] !== 'boolean')
            throw new Error(t('Nieprawidłowe tło.'));
    if ((p.background.highpassHz ?? 55) >= (p.background.lowpassHz ?? 10000))
        throw new Error(t('Nieprawidłowe tło.'));
    if (!p.pulse || typeof p.pulse.enabled !== 'boolean')
        throw new Error(t("Nieprawidłowa modulacja."));
    numberIn(p.pulse.hz, 1, 30, t("puls"));
    numberIn(p.pulse.depth, 0, 0.5, t("głębokość"));
    if (!Array.isArray(p.script) || p.script.length > 500)
        throw new Error(t("Projekt może mieć do 500 zdań."));
    for (const line of p.script) {
        textIn(line.id, 100, t("identyfikator zdania"));
        textIn(line.text, 3000, t("tekst"));
        if (!['A', 'B', 'C'].includes(line.role))
            throw new Error(t("Nieprawidłowa rola zdania."));
    }
    if (!Array.isArray(p.layers) || p.layers.length > 32)
        throw new Error(t("Projekt może mieć do 32 warstw."));
    for (const l of p.layers) {
        textIn(l.id, 100, t("identyfikator warstwy"));
        textIn(l.assetId, 100, t("identyfikator nagrania"));
        textIn(l.url, 2500, t("adres nagrania"));
        numberIn(l.duration, 0, 3600, t("czas nagrania"));
        if (!Array.isArray(l.peaks) || l.peaks.length > 2000 || l.peaks.some(n => typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 1))
            throw new Error(t("Nieprawidłowa obwiednia nagrania."));
        textIn(l.path, 2000, t("plik warstwy"));
        textIn(l.name, 300, t("nazwa warstwy"));
        numberIn(l.gainDb, -60, 12, 'gain');
        numberIn(l.pan, -1, 1, t("panorama"));
        numberIn(l.speed, 0.5, 2, t("tempo"));
        numberIn(l.offset, 0, p.duration, t("przesunięcie"));
        if (!['A', 'B', 'C'].includes(l.role) || typeof l.muted !== 'boolean' || typeof l.solo !== 'boolean' || typeof l.reverse !== 'boolean')
            throw new Error(t("Nieprawidłowa konfiguracja warstwy."));
    }
    if (p.notes !== undefined)
        textIn(p.notes, 12000, t("notatki"));
    if (p.musicCredit !== undefined)
        textIn(p.musicCredit, 2000, t("źródło muzyki"));
    if (p.comparisons !== undefined) {
        if (!Array.isArray(p.comparisons) || p.comparisons.length > 1000)
            throw new Error(t("Nieprawidłowe porównania."));
        for (const c of p.comparisons) {
            dateIn(c.createdAt, t("porównanie"));
            textIn(c.id, 100, t("identyfikator porównania"));
            textIn(c.firstId, 100, t("plik A"));
            textIn(c.secondId, 100, t("plik B"));
            for (const n of [c.firstVotes, c.secondVotes, c.ties]) {
                numberIn(n, 0, 10, t("głosy"));
                if (!Number.isInteger(n))
                    throw new Error(t("Nieprawidłowa liczba prób."));
            }
            if (c.firstVotes + c.secondVotes + c.ties !== 10)
                throw new Error(t("Porównanie musi mieć 10 prób."));
        }
    }
    if (!Array.isArray(p.exports))
        p.exports = [];
    if (p.exports.length > 2000)
        throw new Error(t("Zbyt wiele eksportów."));
    for (const r of p.exports) {
        dateIn(r.createdAt, t("eksport"));
        textIn(r.id, 100, t("identyfikator eksportu"));
        textIn(r.path, 2000, t("plik eksportu"));
        textIn(r.url, 2500, t("adres eksportu"));
        numberIn(r.duration, 0, 3600, t("długość eksportu"));
        if (!['wav', 'mp3', 'flac'].includes(r.format) || !['CLEAR', 'LOW', 'MASKED', 'DEEP', 'CONTROL'].includes(r.variant) || !r.metrics)
            throw new Error(t("Nieprawidłowy eksport."));
        for (const v of [r.metrics.integratedLufs, r.metrics.truePeakDbtp, r.metrics.correlation])
            if (v !== null && (typeof v !== 'number' || !Number.isFinite(v)))
                throw new Error(t("Nieprawidłowy pomiar."));
        if (!Array.isArray(r.checks) || r.checks.length > 40)
            throw new Error(t("Nieprawidłowy raport."));
        for (const c of r.checks) {
            textIn(c.label, 500, t("kontrola"));
            textIn(c.detail, 5000, t("opis kontroli"));
            if (!['pass', 'warn', 'fail'].includes(c.status))
                throw new Error(t("Nieprawidłowy wynik kontroli."));
        }
    }
    return p;
}
export function migrateProject(input) {
    if (!input || typeof input !== 'object')
        throw new Error(t("Nieprawidłowy projekt."));
    const old = input;
    if (old.schemaVersion === 2)
        return validateProject(old);
    if (!Array.isArray(old.lines))
        throw new Error(t("Brak rozpoznanej struktury projektu."));
    const p = createProject(typeof old.id === 'string' ? old.id : t("Zaimportowany projekt"));
    p.script = old.lines.map((l) => ({ id: uid(), text: String(l.text ?? ''), role: (['A', 'B', 'C'].includes(String(l.layer)) ? l.layer : 'A') }));
    const mix = (old.mix ?? {});
    if (typeof mix.durationS === 'number')
        p.duration = Math.max(5, Math.min(3600, mix.durationS));
    if (typeof mix.targetLufs === 'number')
        p.targetLufs = Math.max(-36, Math.min(-14, mix.targetLufs));
    return validateProject(p);
}
export function layerFromAsset(a, role = 'A') { return { id: uid(), assetId: a.id, name: a.name, path: a.path, url: a.url, peaks: a.peaks, duration: a.duration, role, gainDb: 0, pan: role === 'A' ? 0 : role === 'B' ? -0.18 : 0.18, speed: 1, reverse: false, offset: 0, muted: false, solo: false }; }
export const clock = (seconds) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
export const formatDate = (s) => new Intl.DateTimeFormat(getLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(s));
export const db = (n) => `${n > 0 ? '+' : ''}${n.toFixed(0)} dB`;
