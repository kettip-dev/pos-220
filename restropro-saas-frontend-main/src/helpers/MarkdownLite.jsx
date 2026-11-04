import React from "react";

/**
 * Minimal Markdown renderer for the in-app user guide.
 * Supports: headings, paragraphs, **bold**, `code`, [links](href), > quotes,
 * nested ordered/unordered lists, task lists (- [ ]), tables and --- rules.
 * Kept dependency-free on purpose; it only needs to cover the guide files.
 */

export function slugify(text) {
  return String(text)
    .replace(/\*\*|`/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s-]/gu, "")
    .replace(/\s/g, "-");
}

/** Split a document into sections at each "## " heading (first section = intro). */
export function splitSections(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const sections = [];
  let current = { title: null, slug: null, lines: [] };
  for (const line of lines) {
    const m = /^##\s+(.*)$/.exec(line);
    if (m) {
      sections.push(current);
      current = { title: m[1].trim(), slug: slugify(m[1].trim()), lines: [line] };
    } else {
      current.lines.push(line);
    }
  }
  sections.push(current);
  return sections
    .map((s) => ({ ...s, raw: s.lines.join("\n") }))
    .filter((s) => s.raw.trim() && s.raw.trim() !== "---");
}

const isTableLine = (l) => /^\s*\|/.test(l);
const isQuoteLine = (l) => /^>\s?/.test(l);
const isHr = (l) => /^-{3,}\s*$/.test(l);
const isHeading = (l) => /^#{1,6}\s+/.test(l);
const LIST_RE = /^([-*]|\d+\.)\s+(.*)$/;

function isBlockStart(l) {
  return isHr(l) || isHeading(l) || isTableLine(l) || isQuoteLine(l) || LIST_RE.test(l);
}

function splitRow(line) {
  const cells = line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|");
  return cells.map((c) => c.trim());
}

export function parseBlocks(lines) {
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    if (isHr(line)) { blocks.push({ type: "hr" }); i++; continue; }

    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) { blocks.push({ type: "heading", level: h[1].length, text: h[2].trim() }); i++; continue; }

    if (isTableLine(line)) {
      const rows = [];
      while (i < lines.length && isTableLine(lines[i])) { rows.push(lines[i]); i++; }
      const header = splitRow(rows[0]);
      const body = rows.slice(1).filter((r) => !/^\s*\|?\s*:?-{2,}/.test(r)).map(splitRow);
      blocks.push({ type: "table", header, body });
      continue;
    }

    if (isQuoteLine(line)) {
      const inner = [];
      while (i < lines.length && isQuoteLine(lines[i])) { inner.push(lines[i].replace(/^>\s?/, "")); i++; }
      blocks.push({ type: "quote", children: parseBlocks(inner) });
      continue;
    }

    const first = LIST_RE.exec(line);
    if (first) {
      const ordered = /^\d+\./.test(first[1]);
      const items = [];
      while (i < lines.length) {
        const m = LIST_RE.exec(lines[i]);
        if (!m || /^\d+\./.test(m[1]) !== ordered) break;
        const width = m[1].length + 1;
        const content = [m[2]];
        i++;
        while (i < lines.length) {
          const l = lines[i];
          if (!l.trim()) {
            let j = i + 1;
            while (j < lines.length && !lines[j].trim()) j++;
            if (j < lines.length && /^\s{2,}/.test(lines[j])) { content.push(""); i++; continue; }
            break;
          }
          const lead = l.length - l.trimStart().length;
          if (lead >= 2) { content.push(l.slice(Math.min(lead, width))); i++; continue; }
          if (!isBlockStart(l)) { content.push(l); i++; continue; }
          break;
        }
        let task = null;
        const t = /^\[( |x)\]\s+(.*)$/i.exec(content[0]);
        if (t) { task = t[1].toLowerCase() === "x"; content[0] = t[2]; }
        items.push({ task, children: parseBlocks(content) });
      }
      blocks.push({ type: "list", ordered, start: ordered ? parseInt(first[1], 10) : 1, items });
      continue;
    }

    const para = [];
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) { para.push(lines[i].trim()); i++; }
    blocks.push({ type: "paragraph", text: para.join(" ") });
  }
  return blocks;
}

function renderInline(text, ctx, keyBase = "i") {
  const re = /(`[^`]+`)|(\*\*.+?\*\*)|(\[[^\]]+\]\([^)]+\))/g;
  const out = [];
  let last = 0;
  let m;
  let n = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `${keyBase}-${n++}`;
    if (m[1]) {
      out.push(
        <code key={key} className="rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[0.85em] text-gray-800 dark:bg-zinc-800 dark:text-zinc-100">
          {m[1].slice(1, -1)}
        </code>
      );
    } else if (m[2]) {
      out.push(
        <strong key={key} className="font-bold text-gray-900 dark:text-white">
          {renderInline(m[2].slice(2, -2), ctx, key)}
        </strong>
      );
    } else {
      const lm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(m[3]);
      const href = lm[2];
      const external = /^https?:/i.test(href);
      out.push(
        <a
          key={key}
          href={external ? href : "#"}
          target={external ? "_blank" : undefined}
          rel={external ? "noreferrer" : undefined}
          onClick={external ? undefined : (e) => { e.preventDefault(); ctx.onLink?.(href); }}
          className="font-semibold text-restro-green underline decoration-restro-green/40 underline-offset-2 hover:decoration-restro-green"
        >
          {renderInline(lm[1], ctx, key)}
        </a>
      );
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const HEADING_CLASS = {
  1: "text-2xl md:text-3xl font-black tracking-tight text-gray-900 dark:text-white mb-2",
  2: "text-xl md:text-2xl font-black tracking-tight text-gray-900 dark:text-white mt-2 mb-3 scroll-mt-20",
  3: "text-lg font-extrabold text-gray-900 dark:text-white mt-6 mb-2 scroll-mt-20",
  4: "text-base font-bold text-gray-900 dark:text-white mt-4 mb-2",
};

function Block({ block, ctx, k, tight }) {
  switch (block.type) {
    case "hr":
      return <hr className="my-6 border-gray-200 dark:border-zinc-800" />;
    case "heading": {
      const Tag = `h${Math.min(block.level, 4)}`;
      return (
        <Tag id={slugify(block.text)} className={HEADING_CLASS[Math.min(block.level, 4)]}>
          {renderInline(block.text, ctx, k)}
        </Tag>
      );
    }
    case "paragraph":
      return tight
        ? <>{renderInline(block.text, ctx, k)}</>
        : <p className="my-3 leading-relaxed">{renderInline(block.text, ctx, k)}</p>;
    case "quote":
      return (
        <div className="my-4 rounded-xl border-l-4 border-restro-green bg-emerald-500/5 px-4 py-3 text-gray-700 dark:bg-emerald-400/5 dark:text-zinc-300 [&>p]:my-1">
          <Blocks blocks={block.children} ctx={ctx} k={k} />
        </div>
      );
    case "table":
      return (
        <div className="my-4 overflow-x-auto rounded-xl border border-gray-200 dark:border-zinc-800">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="bg-gray-50 dark:bg-zinc-900">
              <tr>
                {block.header.map((c, i) => (
                  <th key={i} className="px-3 py-2.5 font-bold text-gray-900 dark:text-white">{renderInline(c, ctx, `${k}-h${i}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.body.map((row, r) => (
                <tr key={r} className="border-t border-gray-100 align-top dark:border-zinc-800">
                  {row.map((c, i) => (
                    <td key={i} className="px-3 py-2.5 leading-relaxed">{renderInline(c, ctx, `${k}-${r}-${i}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      const isTasks = block.items.some((it) => it.task !== null);
      return (
        <Tag
          start={block.ordered ? block.start : undefined}
          className={`my-3 space-y-1.5 pl-6 ${isTasks ? "list-none pl-1" : block.ordered ? "list-decimal" : "list-disc"} marker:text-gray-400 dark:marker:text-zinc-500`}
        >
          {block.items.map((item, i) => (
            <li key={i} className="pl-1 leading-relaxed">
              {item.task !== null ? (
                <label className="flex items-start gap-2.5">
                  <input type="checkbox" defaultChecked={item.task} className="checkbox checkbox-sm checkbox-success mt-0.5 shrink-0" />
                  <span><Blocks blocks={item.children} ctx={ctx} k={`${k}-${i}`} tightFirst /></span>
                </label>
              ) : (
                <Blocks blocks={item.children} ctx={ctx} k={`${k}-${i}`} tightFirst />
              )}
            </li>
          ))}
        </Tag>
      );
    }
    default:
      return null;
  }
}

export function Blocks({ blocks, ctx, k = "b", tightFirst = false }) {
  return blocks.map((b, i) => (
    <Block key={`${k}-${i}`} block={b} ctx={ctx} k={`${k}-${i}`} tight={tightFirst && i === 0 && b.type === "paragraph"} />
  ));
}

export default function MarkdownLite({ source, onLink }) {
  const blocks = React.useMemo(() => parseBlocks(source.replace(/\r\n/g, "\n").split("\n")), [source]);
  return <Blocks blocks={blocks} ctx={{ onLink }} />;
}
