#!/usr/bin/env node
import fs from "node:fs";
import process from "node:process";

// Every literal the plan skeleton in the multi-phase-plan playbook must contain.
// Keep this in sync with that skeleton: change a heading, sub-block, or marker
// there, and change it here.
const SKELETON = {
	rule: "Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.",
	sections: {
		howToRead: "How to read this",
		program: "Program checklist",
		close: "Close the program",
		appendixPrefix: "Appendix",
		prototypeAppendix: "Prototype evidence",
	},
	introMaxLines: 10,
	howToReadMarkers: ["One box is one unit of work", "names the evidence", "Check a box only when its evidence exists", "playbooks/"],
	programH3: ["Arm the program", "Spawn owners", "PR mechanics", "Verdict and merge", "Boot recipe"],
	programMarkers: ["Re-read them at every tick", "hourly audit tick", "status message"],
	subBlocks: {
		depends: "Depends on.",
		files: "Files.",
		build: "Build.",
		youSee: "You see.",
		unit: "Verify, unit.",
		live: "Verify, live.",
		perf: "Verify, perf.",
		gate: "Review gate.",
		merge: "Merge.",
	},
	lanes: {
		opening: /Ten lanes at the verification-lane tier at the PR head/,
		openingText: "Ten lanes at the verification-lane tier at the PR head",
		count: 10,
		box: /^Lane (\d+)\. /,
		screenshot: /Save `[^`]+`/,
		pass: "Pass when",
	},
	perfItems: ["Metric.", "Probe.", "Baseline.", "Rule."],
	gate: { none: "None.", words: ["screenshot", "video", "operator"] },
};

const B = SKELETON.subBlocks;
const RULE = SKELETON.rule;
const SUB_BLOCKS = Object.values(B);
const HOW_TO_READ_MARKERS = [...SKELETON.howToReadMarkers, RULE];
const bare = (name) => name.replace(/\.$/, "");
const BOX = /^\s*- \[[ x]\] (.*)$/;

const file = process.argv[2];
if (!file) {
	console.error("Usage: node check-plan.mjs <plan.md>");
	process.exit(2);
}

const raw = fs.readFileSync(file, "utf8").split(/\r?\n/);
const problems = [];
const fail = (line, message) => problems.push(`${file}:${line}: ${message}`);

let start = 0;
if (raw[0] === "---") {
	start = raw.indexOf("---", 1) + 1;
}

const lines = [];
let fence = null;
const openingFence = (text) => {
	const match = text.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
	if (!match || (match[1][0] === "`" && match[2].includes("`"))) return null;
	return { char: match[1][0], length: match[1].length };
};
const closingFence = (text, opening) => {
	const match = text.match(/^ {0,3}(`+|~+)[ \t]*$/);
	return Boolean(
		match &&
		match[1][0] === opening.char &&
		match[1].length >= opening.length,
	);
};
for (let i = start; i < raw.length; i++) {
	const text = raw[i];
	const n = i + 1;
	let code = Boolean(fence);
	if (fence && closingFence(text, fence)) {
		code = false;
		fence = null;
	} else if (!fence) {
		fence = openingFence(text);
		code = Boolean(fence);
	}
	lines.push({ n, text, code });
	if (code) continue;
	const prose = text
		.replace(/`[^`]*`/g, "`")
		.replace(/!\[[^\]]*\]\([^)]*\)/g, "")
		.replace(/\]\([^)]*\)/g, "]");
	if (/[\u2013\u2014]/.test(prose)) fail(n, "long dash");
	if (/[\u2018\u2019\u201c\u201d]/.test(prose)) fail(n, "curly quote");
	if (/: \S/.test(prose)) fail(n, "mid-sentence colon");
}

const h2 = (l) => (!l.code && l.text.startsWith("## ") ? l.text.slice(3).trim() : null);
const sections = [];
for (const l of lines) {
	const title = h2(l);
	if (title !== null) sections.push({ title, n: l.n, body: [] });
	else if (sections.length) sections.at(-1).body.push(l);
}
const find = (title) => sections.find((s) => s.title === title);
const bodyText = (s) => s.body.map((l) => l.text).join("\n");
const boxes = (ls) => ls.filter((l) => !l.code && BOX.test(l.text)).map((l) => ({ n: l.n, text: l.text.match(BOX)[1] }));

const h1 = lines.findIndex((l) => !l.code && l.text.startsWith("# "));
if (h1 === -1) fail(1, "no H1 title");
const howToRead = find(SKELETON.sections.howToRead);
if (!howToRead) fail(1, `no "## ${SKELETON.sections.howToRead}" section`);
if (h1 !== -1 && howToRead) {
	const intro = lines.slice(h1 + 1).filter((l) => l.n < howToRead.n && l.text.trim() !== "");
	if (intro.length >= SKELETON.introMaxLines) fail(lines[h1].n, `intro is ${intro.length} lines, under ten required`);
	for (const marker of HOW_TO_READ_MARKERS) {
		if (!bodyText(howToRead).includes(marker)) fail(howToRead.n, `${SKELETON.sections.howToRead} lacks "${marker}"`);
	}
}

const program = find(SKELETON.sections.program);
if (!program) fail(1, `no "## ${SKELETON.sections.program}" section`);
else {
	const h3s = program.body.filter((l) => !l.code && l.text.startsWith("### ")).map((l) => l.text.slice(4).trim());
	let from = 0;
	for (const name of SKELETON.programH3) {
		const at = h3s.findIndex((t, i) => i >= from && t.startsWith(name));
		if (at === -1) fail(program.n, `${SKELETON.sections.program} lacks "### ${name}" in order`);
		else from = at + 1;
	}
	for (const marker of SKELETON.programMarkers) {
		if (!bodyText(program).includes(marker)) fail(program.n, `${SKELETON.sections.program} lacks "${marker}"`);
	}
}

const close = find(SKELETON.sections.close);
if (!close) fail(1, `no "## ${SKELETON.sections.close}" section`);
const programIndex = sections.indexOf(program);
const closeIndex = sections.indexOf(close);
const prSections = programIndex === -1 || closeIndex === -1 ? [] : sections.slice(programIndex + 1, closeIndex);
if (prSections.length === 0) fail(1, `no PR sections between ${SKELETON.sections.program} and ${SKELETON.sections.close}`);

const report = [];
for (const pr of prSections) {
	const heads = [];
	for (const l of pr.body) {
		if (l.code) continue;
		const m = l.text.match(/^\*\*([^*]+)\*\*(.*)$/);
		if (m && SUB_BLOCKS.includes(m[1])) heads.push({ name: m[1], n: l.n, rest: m[2].trim(), lines: [] });
		else if (heads.length) heads.at(-1).lines.push(l);
	}
	const names = heads.map((h) => h.name);
	if (names.join("|") !== SUB_BLOCKS.join("|")) {
		fail(pr.n, `${pr.title}: sub-blocks are [${names.join(", ")}], expected [${SUB_BLOCKS.join(", ")}]`);
	}
	const block = (name) => heads.find((h) => h.name === name);
	const counts = {};
	for (const h of heads) counts[h.name] = boxes(h.lines).length;

	const depends = block(B.depends);
	if (depends && depends.rest === "") fail(depends.n, `${pr.title}: ${bare(B.depends)} names nothing`);
	for (const name of [B.files, B.build, B.youSee, B.unit, B.merge]) {
		const b = block(name);
		if (b && boxes(b.lines).length === 0) fail(b.n, `${pr.title}: ${name} has no box`);
	}
	for (const name of [B.unit, B.live, B.perf]) {
		const b = block(name);
		if (b && !b.rest.startsWith(RULE)) fail(b.n, `${pr.title}: ${name} does not open with the rule`);
	}

	const live = block(B.live);
	if (live) {
		const L = SKELETON.lanes;
		if (!L.opening.test(live.rest)) fail(live.n, `${pr.title}: ${bare(B.live)} lacks "${L.openingText}"`);
		const lanes = boxes(live.lines).map((b) => ({ ...b, m: b.text.match(L.box) }));
		const numbers = lanes.filter((b) => b.m).map((b) => Number(b.m[1])).sort((a, b) => a - b);
		const expected = Array.from({ length: L.count }, (_, i) => i + 1).join(",");
		if (numbers.join(",") !== expected) fail(live.n, `${pr.title}: lanes are [${numbers.join(",")}], expected 1 to ${L.count}`);
		for (const lane of lanes) {
			if (!lane.m) fail(lane.n, `${pr.title}: live box is not a lane`);
			else if (!L.screenshot.test(lane.text)) fail(lane.n, `${pr.title}: lane ${lane.m[1]} names no screenshot`);
			else if (!lane.text.includes(L.pass)) fail(lane.n, `${pr.title}: lane ${lane.m[1]} has no pass predicate`);
		}
	}

	const perf = block(B.perf);
	if (perf) {
		const items = boxes(perf.lines).map((b) => b.text.split(" ")[0]);
		if (items.join("|") !== SKELETON.perfItems.join("|")) fail(perf.n, `${pr.title}: perf boxes are [${items.join(", ")}], expected [${SKELETON.perfItems.join(", ")}]`);
	}

	const gate = block(B.gate);
	if (gate) {
		const gateBoxes = boxes(gate.lines);
		const gateName = bare(B.gate);
		if (gate.rest.startsWith(SKELETON.gate.none)) {
			if (gateBoxes.length) fail(gate.n, `${pr.title}: ${gateName} says ${bare(SKELETON.gate.none)} but has boxes`);
		} else {
			const text = gate.lines.map((l) => l.text).join("\n");
			if (gateBoxes.length === 0) fail(gate.n, `${pr.title}: ${gateName} has no box`);
			for (const word of SKELETON.gate.words) {
				if (!text.includes(word)) fail(gate.n, `${pr.title}: ${gateName} lacks "${word}"`);
			}
		}
	}

	const total = boxes(pr.body).length;
	const cells = SUB_BLOCKS.filter((s) => s !== B.depends).map((s) => `${s.replace(/[ ,.]+/g, "-").replace(/-$/, "").toLowerCase()}=${counts[s] ?? 0}`);
	report.push(`${pr.title}  boxes=${total}  ${cells.join(" ")}`);
}

if (closeIndex !== -1) {
	const tail = sections.slice(closeIndex + 1);
	for (const s of tail) {
		if (!s.title.startsWith(SKELETON.sections.appendixPrefix)) fail(s.n, `"## ${s.title}" after ${SKELETON.sections.close} is not an appendix`);
	}
	if (!tail.some((s) => s.title.includes(SKELETON.sections.prototypeAppendix))) fail(close.n, `no "## ${SKELETON.sections.appendixPrefix} ... ${SKELETON.sections.prototypeAppendix}" section`);
}

for (const line of report) console.log(line);
console.log(`${prSections.length} PR sections, ${problems.length} problems`);
for (const p of problems) console.error(p);
process.exit(problems.length ? 1 : 0);
