import { contractTypeLabel } from "../contracts/types";
import { findAmounts } from "../text/amounts";
import type { DocText } from "../text/locate";
import type { Finding, KeyTerm } from "../review/types";

const DATE = String.raw`(\d{1,2}(?:st|nd|rd|th)?\s+(?:day of\s+)?[A-Z][a-z]+,?\s+\d{4}|[A-Z][a-z]+ \d{1,2},? \d{4}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4})`;

function clean(s: string): string {
  return s.replace(/\s+/g, " ").replace(/^[\s,:;"“”'(]+|[\s,:;"“”')]+$/g, "").trim();
}

// Party names usually sit just before "(hereinafter referred to as ...)".
export function findParties(doc: DocText): KeyTerm[] {
  const out: KeyTerm[] = [];
  const re = /hereinafter (?:jointly |collectively )?(?:referred to as|called)\s*(?:the\s+)?["“'‘]?([A-Za-z/&.\- ]{2,40})["”'’]?/gi;
  for (const m of doc.findAll(re, 6)) {
    const role = clean(m.match[1]).replace(/^the /i, "");
    if (/parties|party$/i.test(role) && !/first|second/i.test(role)) continue;
    const before = doc.full.slice(Math.max(0, m.match.index - 400), m.match.index);
    const lastJoin = Math.max(before.lastIndexOf("BETWEEN"), before.toLowerCase().lastIndexOf("between"), before.lastIndexOf("AND"), before.lastIndexOf("\nand"), before.toLowerCase().lastIndexOf(" and\n"));
    let name = lastJoin >= 0 ? before.slice(lastJoin).replace(/^(between|and)\s*:?/i, "") : before.split("\n").slice(-2).join(" ");
    name = clean(name.split(/,|\(|\n\n/)[0]).slice(0, 90);
    if (!name || name.length < 3) continue;
    if (out.some((p) => p.value.startsWith(name))) continue;
    out.push({ label: role.length < 30 ? role.replace(/\b\w/g, (c) => c.toUpperCase()) : "Party", value: name, quote: m.quote, page: m.page });
  }
  return out.slice(0, 4);
}

export function extractKeyTerms(doc: DocText): KeyTerm[] {
  const terms: KeyTerm[] = [...findParties(doc)];

  const date = doc.find(new RegExp(String.raw`(?:dated|made (?:on|this)|entered into (?:on|this)|executed (?:on|this)|effective (?:date|from|as of)[^.\d]{0,30}|commenc\w* (?:on|from))[^.\d]{0,25}` + DATE, "i"));
  if (date) terms.push({ label: "Date", value: clean(date.match[1]), quote: date.quote, page: date.page });

  const term = doc.find(/(?:period|term|duration|tenure) of\s+((?:\w+\s+)?\(?\d{0,3}\)?\s*(?:calendar )?(?:months?|years?|days))/i);
  if (term) terms.push({ label: "Term", value: clean(term.match[1]).replace(/\s*\(\d+\)/, ""), quote: term.quote, page: term.page });
  else {
    const until = doc.find(new RegExp(String.raw`(?:until|till|up to|ending on|expire on)\s+` + DATE, "i"));
    if (until) terms.push({ label: "Ends", value: clean(until.match[1]), quote: until.quote, page: until.page });
  }

  const amounts = findAmounts(doc);
  const inr = amounts.filter((a) => a.currency === "INR").sort((a, b) => b.value - a.value)[0];
  const foreign = amounts.filter((a) => a.currency !== "INR").sort((a, b) => b.value - a.value)[0];
  if (inr) terms.push({ label: "Value", value: inr.display, quote: inr.at.quote, page: inr.at.page });
  if (foreign) terms.push({ label: inr ? "Foreign value" : "Value", value: foreign.display, quote: foreign.at.quote, page: foreign.at.page });

  const tranches = doc.findAll(/\b(?:tranche|instal+ment)s?\b/i, 50).length;
  if (tranches >= 2) terms.push({ label: "Payments", value: "In tranches" });

  const notice = doc.find(/(\w+(?:\s*\(\d+\))?)\s+(?:calendar\s+)?days['’]?\s+(?:prior\s+|advance\s+)?(?:written\s+)?notice/i);
  if (notice) {
    const digits = /\((\d+)\)/.exec(notice.match[1])?.[1] ?? (/^\d+$/.test(notice.match[1]) ? notice.match[1] : null);
    terms.push({ label: "Notice period", value: `${digits ?? notice.match[1].toLowerCase()} days`, quote: notice.quote, page: notice.page });
  }

  const law = doc.find(/(?:governed by|construed in accordance with)[^.]{0,40}laws? of (?:the )?(?:republic of )?([A-Za-z ]{3,30}?)(?:[.,;]| and )/i);
  if (law) terms.push({ label: "Governing law", value: clean(law.match[1]).replace(/\b\w/g, (c) => c.toUpperCase()), quote: law.quote, page: law.page });

  const forum = doc.find(/(?:seat|venue) of (?:the )?arbitration (?:shall be|is|will be)\s+(?:at |in )?([A-Z][A-Za-z ]{2,25})|courts? (?:at|of|in) ([A-Z][a-z]+(?: [A-Z][a-z]+)?)/);
  if (forum) terms.push({ label: "Disputes", value: clean(forum.match[1] ?? forum.match[2]), quote: forum.quote, page: forum.page });

  return terms;
}

export function ruleSummary(contractType: string, terms: KeyTerm[], findings: Finding[]): string {
  const parties = terms.filter((t) => !["Date", "Term", "Ends", "Value", "Foreign value", "Payments", "Notice period", "Governing law", "Disputes"].includes(t.label));
  const value = terms.find((t) => t.label === "Value");
  const term = terms.find((t) => t.label === "Term" || t.label === "Ends");
  let s = contractTypeLabel(contractType);
  if (parties.length >= 2) s += ` between ${parties[0].value} and ${parties[1].value}`;
  if (value) s += `, worth ${value.value}`;
  if (term) s += term.label === "Term" ? `, for ${term.value}` : `, until ${term.value}`;
  s += ".";
  const issues = findings.filter((f) => f.status === "issue");
  const serious = issues.filter((f) => f.severity === "critical" || f.severity === "high");
  if (!issues.length) s += " No issues were found by the automated checks; warnings are worth a read before signing.";
  else {
    s += ` ${issues.length} issue${issues.length === 1 ? "" : "s"} found`;
    s += serious.length
      ? `, ${serious.length} of them serious. Start with: ${serious.slice(0, 3).map((f) => (/^[A-Z][a-z]/.test(f.title) ? f.title.charAt(0).toLowerCase() + f.title.slice(1) : f.title)).join("; ")}.`
      : ", none of them serious.";
  }
  return s;
}
