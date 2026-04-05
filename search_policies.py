#!/usr/bin/env python3
"""
Policy link finder CLI — CMS Medicare Coverage API (MCD) + optional OpenFDA brand→generic.

References (short):
- argparse: https://docs.python.org/3/library/argparse.html
- requests: https://requests.readthedocs.io/en/latest/user/quickstart/
- CMS Coverage API: https://api.coverage.cms.gov/docs/
- Release notes (report paths): https://api.coverage.cms.gov/docs/release_notes
- openFDA drug labels: https://open.fda.gov/apis/drug/label/

Calling GET /v1/metadata/license-agreement/ and using the returned Bearer token follows
CMS guidance for Local Coverage detail endpoints (see API 1.5 release notes).
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Sequence
from urllib.parse import parse_qs, quote, urlparse

import requests

CMS_API_BASE = "https://api.coverage.cms.gov"
MCD_PUBLIC_BASE = "https://www.cms.gov/medicare-coverage-database"
OPENFDA_LABEL = "https://api.fda.gov/drug/label.json"

REPORT_NCD = f"{CMS_API_BASE}/v1/reports/national-coverage-ncd/"
REPORT_LCD = f"{CMS_API_BASE}/v1/reports/local-coverage-final-lcds/"
REPORT_ARTICLE = f"{CMS_API_BASE}/v1/reports/local-coverage-articles/"
LICENSE_URL = f"{CMS_API_BASE}/v1/metadata/license-agreement/"

DEFAULT_USER_AGENT = (
    "CoverMyPharmaPolicyFinder/0.1 (+https://github.com/; hackathon demo; policy discovery)"
)

TITLE_SEARCH_WARNING = (
    "[*] Note: Currently searching by policy title only. Broad policies that cover this drug "
    "under a class name may not appear."
)

# Title-only search: we do not scan full LCD/article body text in the report list rows.
# Matches are substring hits on the policy title (case-insensitive).


@dataclass
class PolicyRecord:
    title: str
    payer_label: str
    doc_type: str
    url: str
    subtitle: str = ""
    document_display_id: str = ""
    brand_query: str = ""
    generic_name: str | None = None
    effective_date: str = ""
    retirement_date: str = ""
    note: str = ""
    diagnosis_codes_excerpt: str = ""
    clinical_excerpt: str = ""
    prior_auth_hint: str = ""
    clinical_criteria_hint: str = ""
    enrichment_status: str = "list_only"


def _strip_html_to_text(raw: str, max_len: int = 600) -> str:
    if not raw:
        return ""
    s = html.unescape(raw)
    s = re.sub(r"(?is)<script.*?>.*?</script>", " ", s)
    s = re.sub(r"(?is)<style.*?>.*?</style>", " ", s)
    s = re.sub(r"<[^>]+>", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    if len(s) > max_len:
        s = s[: max_len - 3].rstrip() + "..."
    return s


def _prior_auth_hint(text: str) -> str:
    if not text:
        return "Not extracted; see MCD document."
    low = text.lower()
    keys = (
        "prior authorization",
        "prior authorisation",
        "precertification",
        "pre-certification",
        "preauthorization",
    )
    if any(k in low for k in keys):
        return "Possible prior auth language in policy text (verify in document)."
    return "Not extracted; see MCD document."


def _clinical_criteria_hint(text: str) -> str:
    if not text:
        return "Not extracted; see MCD document."
    low = text.lower()
    keys = (
        "step therapy",
        "inadequate response",
        "failed",
        "failure of",
        "must try",
        "documented trial",
        "contraindication",
    )
    if any(k in low for k in keys):
        return "Possible step therapy / failure criteria language (verify in document)."
    return "Not extracted; see MCD document."


def _session(timeout: float) -> requests.Session:
    s = requests.Session()
    s.headers.update(
        {
            "Accept": "application/json",
            "User-Agent": DEFAULT_USER_AGENT,
        }
    )
    return s


def _atomic_write(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_bytes(data)
    tmp.replace(path)


def _cache_fresh(path: Path, ttl_seconds: float) -> bool:
    if not path.is_file():
        return False
    return (time.time() - path.stat().st_mtime) < ttl_seconds


def load_or_fetch_json(
    url: str,
    cache_path: Path,
    session: requests.Session,
    timeout: float,
    ttl_seconds: float,
) -> dict[str, Any]:
    """
    Return parsed JSON from cache if mtime within TTL; otherwise GET url and write cache atomically.
    """
    if _cache_fresh(cache_path, ttl_seconds):
        return json.loads(cache_path.read_text(encoding="utf-8"))

    timeout = float(timeout)
    r = session.get(url, timeout=timeout)
    r.raise_for_status()
    payload = r.json()
    _atomic_write(cache_path, json.dumps(payload).encode("utf-8"))
    return payload


def fetch_report_merged(
    report_url: str,
    cache_path: Path,
    session: requests.Session,
    timeout: float,
    ttl_seconds: float,
) -> list[dict[str, Any]]:
    """
    Load cached merged report if fresh; else follow meta.next_token until exhausted.
    """
    if _cache_fresh(cache_path, ttl_seconds):
        doc = json.loads(cache_path.read_text(encoding="utf-8"))
        return list(doc.get("data") or [])

    rows: list[dict[str, Any]] = []
    next_token: str | None = ""
    first_meta: dict[str, Any] | None = None

    while True:
        params: dict[str, str] = {}
        if next_token:
            params["next_token"] = next_token
        r = session.get(report_url, params=params or None, timeout=timeout)
        r.raise_for_status()
        chunk = r.json()
        meta = chunk.get("meta") or {}
        if first_meta is None:
            first_meta = meta
        rows.extend(chunk.get("data") or [])
        next_token = (meta.get("next_token") or "").strip() or None
        if not next_token:
            break

    merged = {"meta": first_meta or {}, "data": rows}
    _atomic_write(cache_path, json.dumps(merged).encode("utf-8"))
    return rows


def load_or_fetch_json_cached_detail(
    url: str,
    cache_path: Path,
    session: requests.Session,
    timeout: float,
    ttl_seconds: float,
    extra_headers: dict[str, str] | None = None,
) -> dict[str, Any]:
    if _cache_fresh(cache_path, ttl_seconds):
        return json.loads(cache_path.read_text(encoding="utf-8"))
    headers = dict(session.headers)
    if extra_headers:
        headers.update(extra_headers)
    r = session.get(url, headers=headers, timeout=timeout)
    r.raise_for_status()
    payload = r.json()
    _atomic_write(cache_path, json.dumps(payload).encode("utf-8"))
    return payload


def get_cms_bearer_token(
    cache_dir: Path,
    session: requests.Session,
    timeout: float,
) -> str:
    """
    CMS issues a short-lived Bearer token after GET /v1/metadata/license-agreement/.
    By calling this endpoint we acknowledge the license terms stated in the API response.
    """
    tok_path = cache_dir / "cms_bearer_token.json"
    if _cache_fresh(tok_path, 50 * 60):
        try:
            return str(json.loads(tok_path.read_text(encoding="utf-8"))["token"])
        except (KeyError, json.JSONDecodeError, OSError):
            pass

    r = session.get(LICENSE_URL, timeout=timeout)
    r.raise_for_status()
    token = str((r.json().get("data") or [{}])[0]["Token"])
    tok_path.write_text(json.dumps({"token": token}), encoding="utf-8")
    return token


def resolve_openfda_generic(brand: str, session: requests.Session, timeout: float) -> str | None:
    """
    openFDA drug label by brand name (best effort).
    https://open.fda.gov/apis/drug/label/
    """
    if not brand.strip():
        return None
    # Exact phrase search on openfda.brand_name
    search = f'openfda.brand_name:"{brand.strip()}"'
    params = {"search": search, "limit": 1}
    r = session.get(OPENFDA_LABEL, params=params, timeout=timeout)
    if r.status_code != 200:
        return None
    try:
        js = r.json()
    except json.JSONDecodeError:
        return None
    results = js.get("results") or []
    if not results:
        return None
    openfda = results[0].get("openfda") or {}
    names = openfda.get("generic_name") or []
    if not names:
        return None
    g = str(names[0]).strip()
    return g or None


def build_search_needles(brand: str, generic: str | None) -> list[str]:
    out: list[str] = []
    b = brand.strip().casefold()
    if b:
        out.append(b)
    if generic:
        g = generic.strip().casefold()
        if g and g not in out:
            out.append(g)
    return out


def title_matches_needles(title: str, needles: Sequence[str]) -> bool:
    if not title or not needles:
        return False
    t = title.casefold()
    return any(n in t for n in needles)


def ncd_list_url_to_viewer_url(relative_or_abs: str) -> str:
    """
    Report rows give NCD url like /data/ncd?ncdid=108&ncdver=1 → MCD viewer URL.
    """
    if relative_or_abs.startswith("http"):
        return relative_or_abs
    path = relative_or_abs if relative_or_abs.startswith("/") else "/" + relative_or_abs
    full = f"{CMS_API_BASE}/v1{path}" if path.startswith("/data/") else f"{CMS_API_BASE}/v1/{path}"
    parsed = urlparse(full)
    q = parse_qs(parsed.query)
    ncdid = (q.get("ncdid") or q.get("NCDId") or [""])[0]
    ver = (q.get("ncdver") or q.get("ncdver".lower()) or [""])[0]
    if not ncdid or not ver:
        return f"{MCD_PUBLIC_BASE}/search.aspx"
    return (
        f"{MCD_PUBLIC_BASE}/details/ncd/details.aspx?"
        f"NCDId={quote(str(ncdid), safe='')}&ncdver={quote(str(ver), safe='')}"
    )


def parse_article_url(url: str) -> tuple[str | None, str | None]:
    try:
        q = parse_qs(urlparse(url).query)
        aid = (q.get("articleid") or [None])[0]
        ver = (q.get("ver") or [None])[0]
        return (str(aid) if aid else None, str(ver) if ver else None)
    except Exception:
        return None, None


def parse_lcd_url(url: str) -> tuple[str | None, str | None]:
    try:
        q = parse_qs(urlparse(url).query)
        lid = (q.get("lcdid") or [None])[0]
        ver = (q.get("ver") or [None])[0]
        return (str(lid) if lid else None, str(ver) if ver else None)
    except Exception:
        return None, None


def format_icd_article_rows(data: list[dict[str, Any]], limit: int = 12) -> str:
    if not data:
        return "No ICD-10 covered rows returned by API for this article (see MCD document)."
    parts: list[str] = []
    for row in data[:limit]:
        code = row.get("range") or row.get("description") or row.get("icd10_covered_group")
        if code:
            parts.append(str(code).strip())
    if not parts:
        return "ICD endpoint returned rows without display fields (see MCD document)."
    return ", ".join(parts)


def enrich_ncd(
    ncdid: str,
    ncdver: str,
    cache_dir: Path,
    session: requests.Session,
    timeout: float,
    ttl_seconds: float,
) -> dict[str, Any]:
    url = f"{CMS_API_BASE}/v1/data/ncd"
    detail_url = f"{url}?ncdid={quote(ncdid, safe='')}&ncdver={quote(ncdver, safe='')}"
    cache_path = cache_dir / f"cms_detail_ncd_{ncdid}_{ncdver}.json"
    doc = load_or_fetch_json_cached_detail(detail_url, cache_path, session, timeout, ttl_seconds)
    row = (doc.get("data") or [{}])[0]
    ind = str(row.get("indications_limitations") or "")
    svc = str(row.get("item_service_description") or "")
    blob = f"{ind}\n{svc}"
    excerpt = _strip_html_to_text(blob, max_len=600)
    return {
        "effective_date": str(row.get("effective_date") or ""),
        "clinical_excerpt": excerpt,
        "prior_auth_hint": _prior_auth_hint(blob),
        "clinical_criteria_hint": _clinical_criteria_hint(blob),
        "diagnosis_codes_excerpt": "NCD detail does not expose ICD-10 lists in this endpoint; see MCD document.",
    }


def enrich_lcd(
    lcdid: str,
    lcdver: str,
    bearer: str,
    cache_dir: Path,
    session: requests.Session,
    timeout: float,
    ttl_seconds: float,
) -> dict[str, Any]:
    detail_url = (
        f"{CMS_API_BASE}/v1/data/lcd?"
        f"lcdid={quote(lcdid, safe='')}&lcdver={quote(lcdver, safe='')}"
    )
    cache_path = cache_dir / f"cms_detail_lcd_{lcdid}_{lcdver}.json"
    headers = {"Authorization": f"Bearer {bearer}"}
    doc = load_or_fetch_json_cached_detail(
        detail_url, cache_path, session, timeout, ttl_seconds, extra_headers=headers
    )
    row = (doc.get("data") or [{}])[0]
    parts = [
        str(row.get("indication") or ""),
        str(row.get("cms_cov_policy") or ""),
        str(row.get("util_guide") or ""),
        str(row.get("summary_of_evidence") or ""),
    ]
    blob = "\n".join(parts)
    excerpt = _strip_html_to_text(blob, max_len=600)
    icd_bits = str(row.get("add_icd10_info") or "") + str(row.get("icd10_doc") or "")
    icd_excerpt = _strip_html_to_text(icd_bits, max_len=400) if icd_bits.strip() else ""
    if len(icd_excerpt.strip()) < 8:
        icd_excerpt = ""
    diag = icd_excerpt or "See MCD document for ICD-10 / coding tables (API fields sparse for this LCD)."
    return {
        "effective_date": str(row.get("rev_eff_date") or row.get("orig_det_eff_date") or ""),
        "clinical_excerpt": excerpt or "See MCD document for full LCD narrative.",
        "prior_auth_hint": _prior_auth_hint(blob),
        "clinical_criteria_hint": _clinical_criteria_hint(blob),
        "diagnosis_codes_excerpt": diag,
    }


def enrich_article(
    article_id: str,
    ver: str,
    bearer: str,
    cache_dir: Path,
    session: requests.Session,
    timeout: float,
    ttl_seconds: float,
) -> dict[str, Any]:
    detail_url = (
        f"{CMS_API_BASE}/v1/data/article?"
        f"articleid={quote(article_id, safe='')}&ver={quote(ver, safe='')}"
    )
    cache_path = cache_dir / f"cms_detail_article_{article_id}_{ver}.json"
    headers = {"Authorization": f"Bearer {bearer}"}
    doc = load_or_fetch_json_cached_detail(
        detail_url, cache_path, session, timeout, ttl_seconds, extra_headers=headers
    )
    row = (doc.get("data") or [{}])[0]
    blob = "\n".join(
        [
            str(row.get("description") or ""),
            str(row.get("other_comments") or ""),
        ]
    )
    excerpt = _strip_html_to_text(blob, max_len=600)

    icd_url = (
        f"{CMS_API_BASE}/v1/data/article/icd10-covered?"
        f"articleid={quote(article_id, safe='')}&ver={quote(ver, safe='')}"
    )
    icd_cache = cache_dir / f"cms_detail_article_icd10_{article_id}_{ver}.json"
    icd_doc = load_or_fetch_json_cached_detail(
        icd_url, icd_cache, session, timeout, ttl_seconds, extra_headers=headers
    )
    icd_rows = list(icd_doc.get("data") or [])
    icd_text = format_icd_article_rows(icd_rows)

    return {
        "effective_date": str(row.get("article_eff_date") or ""),
        "clinical_excerpt": excerpt or "See MCD document for full article text.",
        "prior_auth_hint": _prior_auth_hint(blob),
        "clinical_criteria_hint": _clinical_criteria_hint(blob),
        "diagnosis_codes_excerpt": icd_text,
    }


class CmsCoverageConnector:
    name = "CMS (Medicare Coverage Database via Coverage API)"

    def __init__(
        self,
        cache_dir: Path,
        timeout: float,
        ttl_seconds: float,
        sources: set[str],
    ) -> None:
        self.cache_dir = cache_dir
        self.timeout = timeout
        self.ttl_seconds = ttl_seconds
        self.sources = sources

    def search(
        self,
        needles: Sequence[str],
        brand_query: str,
        generic_name: str | None,
        max_per_source: int,
        enrich_max: int,
        no_enrich: bool,
        session: requests.Session,
    ) -> list[PolicyRecord]:
        records: list[PolicyRecord] = []

        if "ncd" in self.sources:
            rows = fetch_report_merged(
                REPORT_NCD,
                self.cache_dir / "cms_ncds.json",
                session,
                self.timeout,
                self.ttl_seconds,
            )
            n_ncd = 0
            for row in rows:
                if not title_matches_needles(str(row.get("title") or ""), needles):
                    continue
                url = ncd_list_url_to_viewer_url(str(row.get("url") or ""))
                rec = PolicyRecord(
                    title=str(row.get("title") or ""),
                    payer_label="CMS",
                    doc_type="NCD",
                    url=url,
                    subtitle="National Coverage Determination",
                    document_display_id=str(row.get("document_display_id") or ""),
                    brand_query=brand_query,
                    generic_name=generic_name,
                    effective_date=str(row.get("last_updated") or ""),
                    retirement_date="",
                    note=str(row.get("chapter") or ""),
                )
                records.append(rec)
                n_ncd += 1
                if n_ncd >= max_per_source:
                    break

        if "lcd" in self.sources:
            rows = fetch_report_merged(
                REPORT_LCD,
                self.cache_dir / "cms_lcds.json",
                session,
                self.timeout,
                self.ttl_seconds,
            )
            n_lcd = 0
            for row in rows:
                if not title_matches_needles(str(row.get("title") or ""), needles):
                    continue
                rec = PolicyRecord(
                    title=str(row.get("title") or ""),
                    payer_label="CMS",
                    doc_type="LCD",
                    url=str(row.get("url") or ""),
                    subtitle=_one_line_mac(str(row.get("contractor_name_type") or "")),
                    document_display_id=str(row.get("document_display_id") or ""),
                    brand_query=brand_query,
                    generic_name=generic_name,
                    effective_date=str(row.get("effective_date") or ""),
                    retirement_date=str(row.get("retirement_date") or ""),
                    note=str(row.get("note") or ""),
                )
                records.append(rec)
                n_lcd += 1
                if n_lcd >= max_per_source:
                    break

        if "article" in self.sources:
            rows = fetch_report_merged(
                REPORT_ARTICLE,
                self.cache_dir / "cms_articles.json",
                session,
                self.timeout,
                self.ttl_seconds,
            )
            n_art = 0
            for row in rows:
                if not title_matches_needles(str(row.get("title") or ""), needles):
                    continue
                rec = PolicyRecord(
                    title=str(row.get("title") or ""),
                    payer_label="CMS",
                    doc_type="Article",
                    url=str(row.get("url") or ""),
                    subtitle=_one_line_mac(str(row.get("contractor_name_type") or "")),
                    document_display_id=str(row.get("document_display_id") or ""),
                    brand_query=brand_query,
                    generic_name=generic_name,
                    effective_date=str(row.get("effective_date") or ""),
                    retirement_date=str(row.get("retirement_date") or ""),
                    note=str(row.get("note") or ""),
                )
                records.append(rec)
                n_art += 1
                if n_art >= max_per_source:
                    break

        if no_enrich or enrich_max <= 0:
            for r in records:
                r.enrichment_status = "list_only"
            return records

        need_bearer = False
        if not no_enrich and enrich_max > 0:
            for r in records:
                if r.doc_type in ("LCD", "Article"):
                    need_bearer = True
                    break
        bearer: str | None = None
        if need_bearer:
            try:
                bearer = get_cms_bearer_token(self.cache_dir, session, self.timeout)
            except requests.RequestException:
                bearer = None

        by_type: dict[str, list[PolicyRecord]] = {"NCD": [], "LCD": [], "Article": []}
        for r in records:
            by_type.setdefault(r.doc_type, []).append(r)

        for dtype, bucket in by_type.items():
            for rec in bucket[:enrich_max]:
                self._enrich_one(rec, bearer, session)

        return records

    def _enrich_one(self, rec: PolicyRecord, bearer: str | None, session: requests.Session) -> None:
        try:
            if rec.doc_type == "NCD":
                parsed = urlparse(rec.url)
                q = parse_qs(parsed.query)
                nid = (q.get("NCDId") or q.get("ncdid") or [""])[0]
                ver = (q.get("ncdver") or [""])[0]
                if not nid or not ver:
                    rec.enrichment_status = "detail_failed"
                    return
                info = enrich_ncd(
                    str(nid),
                    str(ver),
                    self.cache_dir,
                    session,
                    self.timeout,
                    self.ttl_seconds,
                )
                rec.effective_date = info.get("effective_date") or rec.effective_date
                rec.clinical_excerpt = info.get("clinical_excerpt") or ""
                rec.prior_auth_hint = info.get("prior_auth_hint") or ""
                rec.clinical_criteria_hint = info.get("clinical_criteria_hint") or ""
                rec.diagnosis_codes_excerpt = info.get("diagnosis_codes_excerpt") or ""
                rec.enrichment_status = "full"
                return

            if rec.doc_type == "LCD":
                lid, ver = parse_lcd_url(rec.url)
                if not lid or not ver or not bearer:
                    rec.diagnosis_codes_excerpt = (
                        "LCD detail requires CMS Bearer token; token fetch failed or unavailable. "
                        "Open the MCD link for ICD / coding."
                    )
                    rec.enrichment_status = "detail_failed"
                    return
                info = enrich_lcd(
                    lid, ver, bearer, self.cache_dir, session, self.timeout, self.ttl_seconds
                )
                rec.clinical_excerpt = info.get("clinical_excerpt") or ""
                rec.prior_auth_hint = info.get("prior_auth_hint") or ""
                rec.clinical_criteria_hint = info.get("clinical_criteria_hint") or ""
                rec.diagnosis_codes_excerpt = info.get("diagnosis_codes_excerpt") or ""
                if info.get("effective_date"):
                    rec.effective_date = info["effective_date"]
                rec.enrichment_status = "full"
                return

            if rec.doc_type == "Article":
                aid, ver = parse_article_url(rec.url)
                if not aid or not ver or not bearer:
                    rec.diagnosis_codes_excerpt = (
                        "Article detail / ICD requires CMS Bearer token; token fetch failed. "
                        "Open the MCD link."
                    )
                    rec.enrichment_status = "detail_failed"
                    return
                info = enrich_article(
                    aid, ver, bearer, self.cache_dir, session, self.timeout, self.ttl_seconds
                )
                rec.clinical_excerpt = info.get("clinical_excerpt") or ""
                rec.prior_auth_hint = info.get("prior_auth_hint") or ""
                rec.clinical_criteria_hint = info.get("clinical_criteria_hint") or ""
                rec.diagnosis_codes_excerpt = info.get("diagnosis_codes_excerpt") or ""
                if info.get("effective_date"):
                    rec.effective_date = info["effective_date"]
                rec.enrichment_status = "full"
                return
        except requests.RequestException:
            rec.enrichment_status = "detail_failed"
        except (KeyError, IndexError, TypeError, ValueError):
            rec.enrichment_status = "detail_failed"


def _one_line_mac(s: str) -> str:
    return " ".join(s.replace("\r", " ").split())


class CommercialUrlPlaceholderConnector:
    """Demonstrates formatted payer portal search URLs (no scraping)."""

    name = "Commercial payers (search URL placeholder)"

    def search(self, brand_query: str, generic_name: str | None) -> list[PolicyRecord]:
        q = brand_query.strip()
        enc = quote(q, safe="")
        aetna = (
            "https://www.aetna.com/cpb/medical/data/cpb_alpha.html"
            f"?search={enc}"
        )
        uhc = f"https://www.uhcprovider.com/en/policies-protocols/commercial-policies.html?q={enc}"
        gnote = generic_name or "(generic not resolved)"
        return [
            PolicyRecord(
                title=f'Aetna — policy search for "{q}"',
                payer_label="Aetna (placeholder URL)",
                doc_type="CommercialSearch",
                url=aetna,
                subtitle="Not scraped; open portal and verify document.",
                brand_query=q,
                generic_name=generic_name,
                clinical_excerpt=f"Generic (context): {gnote}",
                enrichment_status="list_only",
            ),
            PolicyRecord(
                title=f'UnitedHealthcare — policy search for "{q}"',
                payer_label="UnitedHealthcare (placeholder URL)",
                doc_type="CommercialSearch",
                url=uhc,
                subtitle="Not scraped; open portal and verify document.",
                brand_query=q,
                generic_name=generic_name,
                clinical_excerpt=f"Generic (context): {gnote}",
                enrichment_status="list_only",
            ),
        ]


def format_results(
    brand: str,
    needles: Sequence[str],
    generic: str | None,
    cms_hits: list[PolicyRecord],
    commercial_hits: list[PolicyRecord],
) -> str:
    """Plain-text report (UTF-8 safe) for stdout or --output file."""
    lines: list[str] = []
    w = lines.append
    w(f"Search brand/query: {brand}")
    w(f"Search terms used (case-insensitive): {', '.join(needles)}")
    if generic:
        w(f"OpenFDA generic (best effort): {generic}")
    else:
        w("OpenFDA generic (best effort): (not resolved)")
    w("")

    all_hits = [*cms_hits, *commercial_hits]
    if not all_hits:
        w("No matching policies found for the given title search.")
        w("Try a different keyword, include the generic name, or search the MCD directly:")
        w(f"  {MCD_PUBLIC_BASE}/search.aspx")
        return "\n".join(lines) + "\n"

    for i, rec in enumerate(all_hits, start=1):
        w(f"--- Result {i} ---")
        w(f"Title: {rec.title}")
        w(f"Type: {rec.doc_type}  |  Payer: {rec.payer_label}")
        if rec.subtitle:
            w(f"MAC / note: {rec.subtitle}")
        if rec.document_display_id:
            w(f"Document ID: {rec.document_display_id}")
        w(f"URL: {rec.url}")
        w(f"Effective date (best available): {rec.effective_date or 'N/A'}")
        if rec.retirement_date and rec.retirement_date.upper() not in ("N/A", ""):
            w(f"Retirement date: {rec.retirement_date}")
        if rec.note:
            w(f"Status note: {rec.note}")
        gen_disp = rec.generic_name if rec.generic_name else "N/A"
        w(
            f"Brand / generic (search context, may not appear in policy title): "
            f"{rec.brand_query or brand} / {gen_disp}"
        )
        w(f"Diagnosis / codes: {rec.diagnosis_codes_excerpt or 'N/A'}")
        w(f"Clinical / coverage excerpt: {rec.clinical_excerpt or 'N/A'}")
        w(f"Prior authorization: {rec.prior_auth_hint or 'N/A'}")
        w(f"Clinical criteria hint: {rec.clinical_criteria_hint or 'N/A'}")
        w(f"Enrichment: {rec.enrichment_status}")
        w("")

    return "\n".join(lines).rstrip() + "\n"


def parse_sources(raw: str) -> set[str]:
    parts = {p.strip().lower() for p in raw.split(",") if p.strip()}
    allowed = {"ncd", "lcd", "article"}
    bad = parts - allowed
    if bad:
        raise argparse.ArgumentTypeError(f"Invalid --sources values: {bad}. Use: ncd,lcd,article")
    return parts or allowed


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Find Medicare Coverage Database (MCD) policy links by drug/keyword (title search).",
    )
    parser.add_argument("--drug", "-d", required=True, help="Brand or keyword to search (e.g. Remicade).")
    parser.add_argument(
        "--sources",
        type=parse_sources,
        default=parse_sources("ncd,lcd,article"),
        help="Comma-separated CMS sources: ncd,lcd,article (default: all).",
    )
    parser.add_argument("--timeout", type=float, default=120.0, help="HTTP timeout seconds (default: 120).")
    parser.add_argument("--max-results", type=int, default=25, help="Max matches per CMS source (default: 25).")
    parser.add_argument("--no-openfda", action="store_true", help="Skip OpenFDA generic resolution.")
    parser.add_argument("--cache-dir", type=Path, default=Path(".cache"), help="Cache directory (default: .cache).")
    parser.add_argument(
        "--cache-ttl-hours",
        type=float,
        default=24.0,
        help="TTL for cached report/detail JSON in hours (default: 24).",
    )
    parser.add_argument(
        "--enrich-max",
        type=int,
        default=3,
        help="Max enriched records per doc type (NCD/LCD/Article), after title match (default: 3).",
    )
    parser.add_argument(
        "--no-enrich",
        action="store_true",
        help="Skip detail enrichment; list-row fields only (faster).",
    )
    parser.add_argument(
        "--no-commercial",
        action="store_true",
        help="Skip commercial payer placeholder URLs.",
    )
    parser.add_argument(
        "--output",
        "-o",
        type=Path,
        default=None,
        metavar="FILE",
        help="Write the same result text to this .txt file (UTF-8). Still prints to stdout unless --quiet.",
    )
    parser.add_argument(
        "--quiet",
        "-q",
        action="store_true",
        help="With --output, do not print the report to stdout (stderr warnings still shown).",
    )
    args = parser.parse_args(list(argv) if argv is not None else None)

    timeout = float(args.timeout)
    ttl_seconds = float(args.cache_ttl_hours) * 3600.0
    session = _session(timeout)

    generic: str | None = None
    if not args.no_openfda:
        try:
            generic = resolve_openfda_generic(args.drug, session, timeout)
        except requests.RequestException:
            generic = None

    needles = build_search_needles(args.drug, generic)

    print(TITLE_SEARCH_WARNING, file=sys.stderr)
    print(file=sys.stderr)

    cms = CmsCoverageConnector(args.cache_dir.resolve(), timeout, ttl_seconds, args.sources)
    try:
        cms_hits = cms.search(
            needles=needles,
            brand_query=args.drug.strip(),
            generic_name=generic,
            max_per_source=int(args.max_results),
            enrich_max=0 if args.no_enrich else int(args.enrich_max),
            no_enrich=bool(args.no_enrich),
            session=session,
        )
    except requests.RequestException as e:
        print(f"CMS Coverage API request failed: {e}", file=sys.stderr)
        return 2

    commercial: list[PolicyRecord] = []
    if not args.no_commercial:
        commercial = CommercialUrlPlaceholderConnector().search(args.drug.strip(), generic)

    report = format_results(args.drug.strip(), needles, generic, cms_hits, commercial)
    if args.output is not None:
        out_path = args.output.expanduser().resolve()
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(report, encoding="utf-8")
        print(f"Wrote results to {out_path}", file=sys.stderr)
    if not (args.quiet and args.output is not None):
        print(report, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
